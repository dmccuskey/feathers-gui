// One service of the session: what the service area shows of it. Nothing is read until it is first shown. Its first
// read is the probe; a service small enough is then loaded whole, and kept current by the events from then on
// (ADR 006). Any other shows the probe's first page, read again each time it is shown, until the paged loader. The ID
// field of an empty service is guessed again from the first record by event that does not fit the guess. The view
// holds the selection: an ID, kept whatever happens to the record, until the ID field is guessed again.
import type { RecordSource } from 'live-system/core'
import { shallowRef } from 'vue'
import { envelopeConversion, rawConversion } from './envelope.ts'
import { guessIdField, probe, type ProbeResult } from './probe.ts'
import type { RecordEnvelope, SessionConnection, SessionPhase } from './session.ts'
import type { ServiceSetup } from './setup.ts'
import { WholeLoader, type RecordLoader } from './whole-loader.ts'

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

export interface ViewOptions {
    /** Whether the server is set read-only, asked at each write. Default: never. */
    isReadOnly?: () => boolean
}

/**
 * Why a write failed. `read-only` and `not-ready` are refused by the view, before any call: the server is set
 * read-only, or the session is not ready, or the ID field is not known. `server`: the server refused it, and its
 * error is handed on, with its `name`, `code`, `className`, `data` and `errors`.
 */
export class WriteError extends Error {
    readonly reason: 'read-only' | 'not-ready' | 'server'
    readonly code: number | undefined
    readonly className: string | undefined
    readonly data: unknown
    /** What the server says is wrong, field by field: its `errors`, or else its `data` when that is a list. */
    readonly errors: unknown

    constructor(message: string, reason: WriteError['reason'], cause?: unknown) {
        super(message, cause === undefined ? undefined : { cause })

        const server = (cause ?? {}) as Partial<Record<'name' | 'code' | 'className' | 'data' | 'errors', unknown>>

        this.name = reason === 'server' && typeof server.name === 'string' ? server.name : 'WriteError'
        this.reason = reason
        this.code = typeof server.code === 'number' ? server.code : undefined
        this.className = typeof server.className === 'string' ? server.className : undefined
        this.data = server.data
        this.errors = server.errors ?? (Array.isArray(server.data) ? server.data : undefined)
    }
}

/** How many records of the first page are kept, when the service is not loaded whole. */
export const FIRST_PAGE = 25

/** How many records a service may have, at most, to be loaded whole without asking. */
export const WHOLE_LIMIT = 1000

export class ServiceView {
    readonly serviceId: string
    readonly path: string

    readonly #connection: ViewConnection
    readonly #isReadOnly: () => boolean
    // The setup's ID field, if the user named one
    readonly #setIdField: string | undefined
    readonly #load: ServiceSetup['load']
    readonly #idField = shallowRef<string | undefined>(undefined)
    readonly #total = shallowRef<number | undefined>(undefined)
    readonly #status = shallowRef<ViewStatus>({ phase: 'waiting' })
    // The first page, when there is no loader
    readonly #records = shallowRef<readonly RecordEnvelope[] | null>(null)
    readonly #loader = shallowRef<RecordLoader | undefined>(undefined)
    readonly #selectedId = shallowRef<string | null>(null)
    // A loader whose first load is under way
    #loading: RecordLoader | undefined
    #isSessionReady = false
    // It has been shown: it reads each time the session is ready
    #isWanted = false
    // Counts the reads started; one that is not the last is ignored when it ends
    #readCount = 0
    #destroyed = false

    constructor(service: ServiceSetup, connection: ViewConnection, options: ViewOptions = {}) {
        this.serviceId = service.id
        this.path = service.path
        this.#connection = connection
        this.#isReadOnly = options.isReadOnly ?? (() => false)
        this.#setIdField = service.idField
        this.#load = service.load
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
        return this.#loader.value ? this.#loader.value.total : this.#total.value
    }

    /** Reactive. */
    get status(): Readonly<ViewStatus> {
        return this.#status.value
    }

    /** Reactive. Every record, when loaded whole; else the first page. `null` before there are any. */
    get records(): readonly RecordEnvelope[] | null {
        return this.#loader.value?.rows ?? this.#records.value
    }

    /** Reactive. Whether the view holds every record, kept current by the events. */
    get isWhole(): boolean {
        return this.#loader.value !== undefined
    }

    /** Reactive. The ID of the record selected, or `null`. It need not be one the view holds. */
    get selectedId(): string | null {
        return this.#selectedId.value
    }

    /**
     * Reactive. The record selected, from what the view holds: `undefined` when it is not held, such as one removed,
     * not on the first page, or dropped for a login. It comes back with the record.
     */
    get selected(): RecordEnvelope | undefined {
        const id = this.#selectedId.value

        return id === null ? undefined : this.record(id)
    }

    /** Reactive. A record the view holds, by its ID: no call. */
    record(id: string): RecordEnvelope | undefined {
        return this.#loader.value ? this.#loader.value.record(id) : this.#records.value?.find(each => each.id === id)
    }

    /** Selects a record by its ID, or none with `null`. */
    select(id: string | null): void {
        this.#selectedId.value = id
    }

    /**
     * Reads the records, while the session is ready and no read is under way, and each time the session is ready
     * from now on. A view loaded whole has nothing to read again: the events keep it current. Otherwise the first
     * page is read again, and what the view holds is kept until the answer comes.
     */
    async read(): Promise<void> {
        if (!this.#destroyed) this.#isWanted = true
        if (!this.#isSessionReady || this.#destroyed || this.#status.value.phase === 'loading') return
        if (this.#loader.value) return

        const count = ++this.#readCount

        this.#status.value = { phase: 'loading' }
        try {
            const { probed, idField } = await probeService(this.#connection, this.path, this.#setIdField)

            if (count !== this.#readCount) return
            this.#idField.value = idField
            this.#total.value = probed.total

            if (loadsWhole(this.#load, probed)) {
                // A guess made on no records may not fit the first ones to come by event: they are then guessed from
                const guessesAgain = this.idFieldGuessed && probed.records.length === 0
                const loader: WholeLoader = new WholeLoader(
                    this.#connection.recordSource(this.path, {
                        convert: envelopeConversion(idField),
                        idField,
                        ...(guessesAgain ? { onEventError: () => this.#guessAgain(loader) } : {}),
                    }),
                )

                this.#loading = loader
                await loader.load()
                // Stopped by follow(), which made the read stale
                if (count !== this.#readCount) return
                this.#loading = undefined
                this.#loader.value = loader
                this.#records.value = null
            } else {
                const convert = envelopeConversion(idField)

                this.#records.value = probed.records.slice(0, FIRST_PAGE).map(raw => convert.read(raw))
            }
            this.#status.value = { phase: 'ready' }
        } catch (error) {
            if (count !== this.#readCount) return
            this.#loading = undefined
            this.#status.value = { phase: 'failed', error: errorOf(error) }
        }
    }

    /**
     * Told by the session where it is. Ready: a view loaded whole syncs, as events may have been missed; any other
     * reads, once it has been shown. Waiting for a login, or closed: the records are dropped, as they may be another
     * user's. Otherwise they are kept, as stale.
     */
    follow(phase: SessionPhase): void {
        if (this.#destroyed) return

        this.#isSessionReady = phase === 'ready'
        if (this.#isSessionReady) {
            if (this.#loader.value) {
                this.#loader.value.sync()
                this.#status.value = { phase: 'ready' }
            } else if (this.#isWanted) {
                void this.read()
            }

            return
        }

        // A read under way is ignored when it ends, and a first load is stopped: it may never return
        this.#readCount++
        void this.#loading?.stop()
        this.#loading = undefined
        if (phase === 'login-needed' || phase === 'closed') {
            this.#records.value = null
            void this.#loader.value?.stop()
            this.#loader.value = undefined
        }
        this.#status.value = { phase: this.records ? 'stale' : 'waiting' }
    }

    /** Creates a record. Resolves with the server's answer; what the view holds changes only by the event after it. */
    create(raw: Record<string, unknown>): Promise<RecordEnvelope> {
        return this.#write(source => source.create({ raw }))
    }

    /** Changes the top-level fields of a record that `part` has, and no others. As `create()`, by the event. */
    patch(id: string, part: Record<string, unknown>): Promise<RecordEnvelope> {
        return this.#write(source => source.patch(id, { raw: part }))
    }

    /** Puts `raw` in place of the whole record. As `create()`, by the event. */
    update(id: string, raw: Record<string, unknown>): Promise<RecordEnvelope> {
        return this.#write(source => source.update(id, { id, raw }))
    }

    /** Removes a record. As `create()`, by the event. */
    remove(id: string): Promise<RecordEnvelope> {
        return this.#write(source => source.remove(id))
    }

    destroy(): void {
        this.follow('closed')
        this.#destroyed = true
    }

    // The probe again, for a new guess of the ID field, in place of `loader`, the empty service's
    #guessAgain(loader: RecordLoader): void {
        if (this.#loader.value !== loader && this.#loading !== loader) return

        // A first load under way is ignored when it ends
        this.#readCount++
        this.#loading = undefined
        this.#loader.value = undefined
        // An ID under the old guess means nothing under the new one
        this.#selectedId.value = null
        void loader.stop()
        this.#status.value = { phase: 'waiting' }
        void this.read()
    }

    // A write, through a record source of envelopes; refused before any call when it cannot be made
    async #write(call: (source: RecordSource<RecordEnvelope>) => Promise<RecordEnvelope>): Promise<RecordEnvelope> {
        const idField = this.#idField.value

        if (this.#isReadOnly()) {
            throw new WriteError(`The server is read-only: nothing is written to "${this.path}"`, 'read-only')
        }
        if (this.#destroyed || !this.#isSessionReady) {
            throw new WriteError(`Not connected: nothing is written to "${this.path}"`, 'not-ready')
        }
        if (idField === undefined) {
            throw new WriteError(`The ID field of "${this.path}" is not known: nothing is written`, 'not-ready')
        }

        try {
            return await call(
                this.#connection.recordSource(this.path, { convert: envelopeConversion(idField), idField }),
            )
        } catch (error) {
            throw new WriteError(error instanceof Error ? error.message : String(error), 'server', error)
        }
    }
}

/** The probe of a service, and its ID field: `idField`, or else guessed from what the probe read. */
async function probeService(
    connection: ViewConnection,
    path: string,
    idField?: string,
): Promise<{ probed: ProbeResult; idField: string }> {
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

    return { probed, idField: field }
}

/**
 * Whether a service is loaded whole: not set to be paged, and with a count the probe knows, at most `WHOLE_LIMIT`.
 * Over it, or with the count unknown, the user is to be asked first, which is not built yet.
 */
function loadsWhole(load: ServiceSetup['load'], probed: ProbeResult): boolean {
    const count = probed.isWhole ? probed.records.length : probed.total

    return load !== 'paged' && count !== undefined && count <= WHOLE_LIMIT
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
