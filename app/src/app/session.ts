// The session with the active server: its connection, and the state machine that says where it stands (ADR 004).
// It has no login yet, and reads the first records of a service until the service views take over the reading.
import { FeathersConnection } from '@dmccuskey/feathers-connect'
import { StateMachine } from 'micro-fsm'
import { shallowRef } from 'vue'
import type { Secrets } from './secrets.ts'
import type { ServerSetup, Setup } from './setup.ts'

export interface SessionParts {
    setup: Setup
    secrets: Secrets
    /** Makes the connection to a server. Default: a `FeathersConnection` that keeps trying. */
    makeConnection?: (url: string) => SessionConnection
}

/** What the session uses of a `FeathersConnection`. */
export type SessionConnection = Pick<
    FeathersConnection,
    'connect' | 'disconnect' | 'service' | 'onConnected' | 'onDisconnected' | 'onConnectError'
>

/** A record of a Feathers service, as the app holds it. `raw` is the server's record, untouched. */
export interface RecordEnvelope {
    id: string
    raw: Record<string, unknown>
}

export type SessionPhase =
    | 'closed' // made, not opened; or ended, or refused by the server
    | 'connecting' // keeps trying: `attempts` and `error` say how it goes
    | 'logging-in'
    | 'login-needed' // no password in hand, or the server refused it: waiting for `login()`
    | 'ready' // connected, and logged in where the server has a login
    | 'lost' // the connection is gone, and is being brought back

export interface SessionStatus {
    phase: SessionPhase
    /** The last failure, kept while it explains the phase. */
    error?: { message: string; code?: number }
    /** Failed attempts to connect since the last success. */
    attempts: number
}

/** How many records `firstPage()` returns at most. */
export const FIRST_PAGE = 25

export class Session {
    readonly serverId: string

    readonly #connection: SessionConnection
    readonly #status = shallowRef<SessionStatus>({ phase: 'closed', attempts: 0 })
    readonly #machine: StateMachine<SessionPhase>
    readonly #unsubscribe: (() => void)[]
    // Where the connection's news says the session should be. `#settle()` takes it there
    #wanted: SessionPhase = 'closed'
    #isSettling = false
    #attempts = 0
    #error: SessionStatus['error']
    #destroyed = false
    // The `open()` calls waiting for the session to be ready, or closed again
    #arrivals = new Set<() => void>()

    constructor(server: ServerSetup, parts: SessionParts) {
        this.serverId = server.id
        this.#connection = (parts.makeConnection ?? (url => new FeathersConnection({ url, keepTrying: true })))(
            server.url,
        )
        this.#machine = new StateMachine<SessionPhase>({
            initial: 'closed',
            states: {
                connecting: { from: 'closed', enter: () => this.#connect() },
                ready: { from: ['connecting', 'logging-in', 'lost'] },
                lost: { from: ['ready', 'logging-in'] },
                closed: { from: '*', enter: () => void this.#connection.disconnect() },
            },
        })
        // The listeners only note what is wanted: they must not throw, or the connection would not hear an attempt
        this.#unsubscribe = [
            this.#connection.onConnected(() => {
                this.#attempts = 0
                this.#error = undefined
                this.#want('ready')
            }),
            this.#connection.onDisconnected(() => this.#want('lost')),
            this.#connection.onConnectError(error => {
                this.#attempts++
                this.#error = { message: error.message }
                this.#publish()
            }),
        ]
    }

    /** Reactive. */
    get status(): Readonly<SessionStatus> {
        return this.#status.value
    }

    /**
     * Connects, and keeps trying until the server is there. Resolves once the session is ready, or closed again:
     * the server refused the connection, or the session was destroyed.
     */
    open(): Promise<void> {
        const arrived = new Promise<void>(resolve => this.#arrivals.add(resolve))

        // Opened already: it arrives where that one does
        if (this.#wanted !== 'closed') return arrived
        if (this.#destroyed) {
            this.#arrive()

            return arrived
        }

        this.#error = undefined
        this.#attempts = 0
        this.#want('connecting')

        return arrived
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
        if (this.#destroyed) return

        this.#destroyed = true
        this.#error = undefined
        this.#want('closed')

        for (const unsubscribe of this.#unsubscribe) unsubscribe()
    }

    /** Notes where the session should be, and goes there when no transition is under way. */
    #want(phase: SessionPhase): void {
        // Once destroyed, nothing moves it from `closed`
        if (this.#destroyed && phase !== 'closed') return
        // Closed stays closed, whatever the connection says as it closes, until it is opened again
        if (this.#wanted === 'closed' && phase !== 'connecting' && phase !== 'closed') return

        this.#wanted = phase
        void this.#settle()
    }

    /** Makes transitions until the session is where it is wanted, one at a time. */
    async #settle(): Promise<void> {
        if (this.#isSettling) return

        this.#isSettling = true
        try {
            while (this.#machine.state !== this.#wanted && this.#machine.can(this.#wanted)) {
                await this.#machine.transition(this.#wanted)
                this.#publish()
                this.#arrive()
            }
        } finally {
            this.#isSettling = false
        }
        // What cannot be reached waits for more news: lost while still connecting is connecting
        this.#publish()
    }

    /** Starts to connect. A connection the server refuses closes the session, with the reason. */
    #connect(): void {
        this.#connection.connect().catch((error: unknown) => {
            // A connect() ended by closing the session is not a failure
            if (this.#wanted === 'closed') return

            this.#error = { message: messageOf(error) }
            this.#want('closed')
        })
    }

    #publish(): void {
        const phase = this.#machine.state

        this.#status.value = {
            phase,
            ...(this.#error ? { error: this.#error } : {}),
            attempts: this.#attempts,
        }
    }

    /** Resolves the `open()` calls waiting, when the session has come where one ends. */
    #arrive(): void {
        const phase = this.#machine.state

        if (phase !== 'ready' && phase !== 'login-needed' && phase !== 'closed') return

        for (const resolve of this.#arrivals) resolve()
        this.#arrivals.clear()
    }
}

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}
