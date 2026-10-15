// One service of the session: what the service area shows of it. Nothing is read until it is first shown. For now it
// reads a first page of records each time it is shown, and again each time the session is ready after that, until
// it has a loader of its own (ADR 006).
import { shallowRef } from 'vue'
import type { RecordEnvelope, SessionConnection, SessionPhase } from './session.ts'
import type { ServiceSetup } from './setup.ts'

export type ViewPhase =
    | 'waiting' // no records: not shown yet, or the session is not ready
    | 'loading'
    | 'ready'
    | 'stale' // the records last read, kept while the session is not ready
    | 'failed' // the read failed: `error` says why

export interface ViewStatus {
    phase: ViewPhase
    error?: { message: string }
}

/** How many records `read()` keeps at most. */
export const FIRST_PAGE = 25

export class ServiceView {
    readonly serviceId: string
    readonly path: string

    readonly #connection: Pick<SessionConnection, 'service'>
    readonly #status = shallowRef<ViewStatus>({ phase: 'waiting' })
    readonly #records = shallowRef<readonly RecordEnvelope[] | null>(null)
    #isSessionReady = false
    // It has been shown: it reads each time the session is ready
    #isWanted = false
    // Counts the reads started; one that is not the last is ignored when it ends
    #readCount = 0
    #destroyed = false

    constructor(service: ServiceSetup, connection: Pick<SessionConnection, 'service'>) {
        this.serviceId = service.id
        this.path = service.path
        this.#connection = connection
    }

    /** Reactive. */
    get status(): Readonly<ViewStatus> {
        return this.#status.value
    }

    /** Reactive. The records last read, or `null` before there are any. */
    get records(): readonly RecordEnvelope[] | null {
        return this.#records.value
    }

    /**
     * Reads the first records again, while the session is ready and no read is under way, and each time the session
     * is ready from now on. What the view holds is kept until the answer comes.
     */
    async read(): Promise<void> {
        if (!this.#destroyed) this.#isWanted = true
        if (!this.#isSessionReady || this.#destroyed || this.#status.value.phase === 'loading') return

        const count = ++this.#readCount

        this.#status.value = { phase: 'loading' }
        try {
            const records = await firstPage(this.#connection, this.path)

            if (count !== this.#readCount) return
            this.#records.value = records
            this.#status.value = { phase: 'ready' }
        } catch (error) {
            if (count !== this.#readCount) return
            this.#status.value = { phase: 'failed', error: { message: messageOf(error) } }
        }
    }

    /**
     * Told by the session where it is. Ready: the view reads, once it has been shown. Waiting for a login, or closed: the records are
     * dropped, as they may be another user's. Otherwise they are kept, as stale.
     */
    follow(phase: SessionPhase): void {
        if (this.#destroyed) return

        this.#isSessionReady = phase === 'ready'
        if (this.#isSessionReady) {
            if (this.#isWanted) void this.read()

            return
        }

        // A read under way is ignored when it ends
        this.#readCount++
        if (phase === 'login-needed' || phase === 'closed') this.#records.value = null
        this.#status.value = { phase: this.#records.value ? 'stale' : 'waiting' }
    }

    destroy(): void {
        this.follow('closed')
        this.#destroyed = true
    }
}

/**
 * The first records of a service, as the server orders them. The ID is guessed: `_id`, or else `id`.
 *
 * It is read with no query, so what comes is the service's own first page, or all of a service without pages.
 * Not every server knows `$limit`: one that takes each key of a query for a field answers it with nothing.
 */
async function firstPage(connection: Pick<SessionConnection, 'service'>, path: string): Promise<RecordEnvelope[]> {
    const answer = await connection.service(path).find()
    const records = Array.isArray(answer) ? answer : (answer as { data?: unknown } | null)?.data

    if (!Array.isArray(records)) throw new Error(`The service "${path}" did not answer with records`)

    return records.slice(0, FIRST_PAGE).map((raw: Record<string, unknown>) => ({ id: String(raw._id ?? raw.id), raw }))
}

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}
