// The session with the active server. A stub: it connects, with no login, and reads the first records of a service,
// until the session is built with its states (ADR 004) and the service views take over the reading.
import { FeathersConnection } from '@dmccuskey/feathers-connect'
import { shallowRef } from 'vue'
import type { Secrets } from './secrets.ts'
import type { ServerSetup, Setup } from './setup.ts'

export interface SessionParts {
    setup: Setup
    secrets: Secrets
    /** Makes the connection to a server. Default: a `FeathersConnection`. */
    makeConnection?: (url: string) => SessionConnection
}

/** What the session uses of a `FeathersConnection`. */
export type SessionConnection = Pick<FeathersConnection, 'connect' | 'disconnect' | 'service'>

/** A record of a Feathers service, as the app holds it. `raw` is the server's record, untouched. */
export interface RecordEnvelope {
    id: string
    raw: Record<string, unknown>
}

export interface SessionStatus {
    phase: 'closed' | 'connecting' | 'ready'
    /** The last failure, kept while it explains the phase. */
    error?: string
}

/** How many records `firstPage()` returns at most. */
export const FIRST_PAGE = 25

export class Session {
    readonly serverId: string

    readonly #connection: SessionConnection
    readonly #status = shallowRef<SessionStatus>({ phase: 'closed' })
    #destroyed = false

    constructor(server: ServerSetup, parts: SessionParts) {
        this.serverId = server.id
        this.#connection = (parts.makeConnection ?? (url => new FeathersConnection({ url })))(server.url)
    }

    /** Reactive. */
    get status(): Readonly<SessionStatus> {
        return this.#status.value
    }

    async open(): Promise<void> {
        this.#status.value = { phase: 'connecting' }

        try {
            await this.#connection.connect()

            if (!this.#destroyed) this.#status.value = { phase: 'ready' }
        } catch (error) {
            if (!this.#destroyed) this.#status.value = { phase: 'closed', error: messageOf(error) }
        }
    }

    /**
     * The first records of a service, as the server orders them. The ID is guessed: `_id`, or else `id`.
     *
     * It is read with no query, so what comes is the service's own first page, or all of a service without pages.
     * Not every server knows `$limit`: one that takes each key of a query for a field answers it with nothing.
     */
    async firstPage(path: string): Promise<RecordEnvelope[]> {
        const answer = await this.#connection.service(path).find()
        const records = Array.isArray(answer) ? answer : (answer as { data?: unknown } | null)?.data

        if (!Array.isArray(records)) throw new Error(`The service "${path}" did not answer with records`)

        return records
            .slice(0, FIRST_PAGE)
            .map((raw: Record<string, unknown>) => ({ id: String(raw._id ?? raw.id), raw }))
    }

    destroy(): void {
        this.#destroyed = true
        this.#status.value = { phase: 'closed' }
        void this.#connection.disconnect()
    }
}

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}
