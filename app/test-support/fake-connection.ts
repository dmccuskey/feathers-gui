// A connection for a test. It connects at once, or fails with `error`, or, with `manual`, waits for the test to say
// what the server does. Its services answer a `find` with what is given.
import { Session, type SessionConnection, type SessionParts } from '../src/app/session.ts'
import type { ServerSetup } from '../src/app/setup.ts'

export interface FakeConnectionOptions {
    /** What each service answers a `find` with, by its path. A path that is not here is refused. */
    services?: Record<string, unknown>
    /** What `connect()` rejects with: the server refuses the connection. */
    error?: Error
    /** Whether `connect()` waits for `accept()`, `refuse()` or `failAttempt()`, as one that keeps trying. */
    manual?: boolean
}

type Listener = () => void
type ErrorListener = (error: Error) => void

export class FakeConnection implements SessionConnection {
    readonly #options: FakeConnectionOptions
    readonly #connected = new Set<Listener>()
    readonly #disconnected = new Set<Listener>()
    readonly #connectErrors = new Set<ErrorListener>()
    #pending: { resolve: () => void; reject: (error: Error) => void } | undefined
    #isConnected = false
    /** How many times `connect()` and `disconnect()` were called. */
    connects = 0
    disconnects = 0

    constructor(options: FakeConnectionOptions = {}) {
        this.#options = options
    }

    get isConnected(): boolean {
        return this.#isConnected
    }

    async connect(): Promise<void> {
        this.connects++

        if (this.#isConnected) return
        if (this.#options.error) throw this.#options.error
        if (!this.#options.manual) return this.accept()

        return new Promise((resolve, reject) => (this.#pending = { resolve, reject }))
    }

    async disconnect(): Promise<void> {
        this.disconnects++
        this.#settle(new Error('Could not connect to the data service: disconnect() was called'))

        if (this.#isConnected) this.drop()
    }

    /** The server answers: `connect()` resolves, or the connection lost comes back. */
    accept(): void {
        this.#isConnected = true
        this.#settle()
        for (const listener of this.#connected) listener()
    }

    /** An attempt to connect fails, and the connection keeps trying. */
    failAttempt(error: Error): void {
        for (const listener of this.#connectErrors) listener(error)
    }

    /** The server refuses the connection: `connect()` rejects. */
    refuse(error: Error): void {
        this.failAttempt(error)
        this.#settle(error)
    }

    /** The connection is lost. */
    drop(): void {
        this.#isConnected = false
        for (const listener of this.#disconnected) listener()
    }

    service: SessionConnection['service'] = path => {
        const refused = async (): Promise<never> => {
            throw new Error('The fake service takes no writes')
        }

        return {
            find: async () => {
                const services = this.#options.services

                if (!services || !(path in services)) throw new Error(`Service not found: ${path}`)

                return services[path]
            },
            get: refused,
            create: refused,
            update: refused,
            patch: refused,
            remove: refused,
            on: () => {},
            off: () => {},
        }
    }

    onConnected(listener: Listener): () => void {
        return on(this.#connected, listener)
    }

    onDisconnected(listener: Listener): () => void {
        return on(this.#disconnected, listener)
    }

    onConnectError(listener: ErrorListener): () => void {
        return on(this.#connectErrors, listener)
    }

    #settle(error?: Error): void {
        const pending = this.#pending

        this.#pending = undefined
        if (error) pending?.reject(error)
        else pending?.resolve()
    }
}

export function fakeConnection(options: FakeConnectionOptions = {}): FakeConnection {
    return new FakeConnection(options)
}

/** For `makeSession`: a session that connects to nothing, with the services given. */
export function fakeSessions(
    options: FakeConnectionOptions = {},
): (server: ServerSetup, parts: SessionParts) => Session {
    return (server, parts) => new Session(server, { ...parts, makeConnection: () => fakeConnection(options) })
}

function on<L>(listeners: Set<L>, listener: L): () => void {
    listeners.add(listener)

    return () => listeners.delete(listener)
}
