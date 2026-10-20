// One service of the session: what the service area shows of it. Nothing is read until it is first shown. For now it
// reads a first page of records each time it is shown, and again each time the session is ready after that, until
// it has a loader of its own (ADR 006).
import { shallowRef } from 'vue'
import { envelopeConversion, rawConversion } from './envelope.ts'
import { guessIdField, probe } from './probe.ts'
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
    /** `no-id-field`: neither `id` nor `_id` will do, and the user is to name the ID field. */
    error?: { message: string; reason?: 'no-id-field' }
}

/** What the view uses of the connection. */
export type ViewConnection = Pick<SessionConnection, 'service' | 'recordSource'>

/** How many records `read()` keeps at most. */
export const FIRST_PAGE = 25

export class ServiceView {
    readonly serviceId: string
    readonly path: string

    readonly #connection: ViewConnection
    // The setup's ID field, if the user named one
    readonly #setIdField: string | undefined
    readonly #idField = shallowRef<string | undefined>(undefined)
    readonly #total = shallowRef<number | undefined>(undefined)
    readonly #status = shallowRef<ViewStatus>({ phase: 'waiting' })
    readonly #records = shallowRef<readonly RecordEnvelope[] | null>(null)
    #isSessionReady = false
    // It has been shown: it reads each time the session is ready
    #isWanted = false
    // Counts the reads started; one that is not the last is ignored when it ends
    #readCount = 0
    #destroyed = false

    constructor(service: ServiceSetup, connection: ViewConnection) {
        this.serviceId = service.id
        this.path = service.path
        this.#connection = connection
        this.#setIdField = service.idField
        this.#idField.value = service.idField
    }

    /** Reactive. The setup's ID field, or else the one guessed from the first read. `undefined` before it. */
    get idField(): string | undefined {
        return this.#idField.value
    }

    /** Whether `idField` is a guess: the setup names none. */
    get idFieldGuessed(): boolean {
        return this.#setIdField === undefined
    }

    /** Reactive. How many records the service has, as of the last read. `undefined` when it does not say. */
    get total(): number | undefined {
        return this.#total.value
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
            const page = await firstPage(this.#connection, this.path, this.#setIdField)

            if (count !== this.#readCount) return
            this.#idField.value = page.idField
            this.#total.value = page.total
            this.#records.value = page.records
            this.#status.value = { phase: 'ready' }
        } catch (error) {
            if (count !== this.#readCount) return
            this.#status.value = { phase: 'failed', error: errorOf(error) }
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

interface FirstPage {
    records: RecordEnvelope[]
    idField: string
    total: number | undefined
}

/**
 * The first records of a service, as the server orders them, by the probe. The ID field is `idField`, or else
 * guessed from what the probe read.
 */
async function firstPage(connection: ViewConnection, path: string, idField?: string): Promise<FirstPage> {
    const source = connection.recordSource(path, { convert: rawConversion })
    const probed = await probe({
        findPage: async limit => {
            const page = await source.findPage({ limit })

            return { records: page.records.map(record => record.raw), total: page.total }
        },
        find: async () => recordsOf(await connection.service(path).find(), path),
    })
    const field = idField ?? guessIdField(probed.records)

    if (field === undefined) throw new NoIdFieldError(path)

    const convert = envelopeConversion(field)

    return {
        records: probed.records.slice(0, FIRST_PAGE).map(raw => convert.read(raw)),
        idField: field,
        total: probed.total,
    }
}

// The records of what a `find()` answered: a page, or an array
function recordsOf(answer: unknown, path: string): Record<string, unknown>[] {
    const records = Array.isArray(answer) ? answer : (answer as { data?: unknown } | null)?.data

    if (!Array.isArray(records)) throw new Error(`The service "${path}" did not answer with records`)

    return records
}

class NoIdFieldError extends Error {
    constructor(path: string) {
        super(
            `The records of "${path}" have no ID field: neither \`id\` nor \`_id\` is on every record, different on each`,
        )
    }
}

function errorOf(error: unknown): NonNullable<ViewStatus['error']> {
    if (error instanceof NoIdFieldError) return { message: error.message, reason: 'no-id-field' }

    return { message: error instanceof Error ? error.message : String(error) }
}
