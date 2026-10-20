// A connection for a test. It connects at once, or fails with `error`, or, with `manual`, waits for the test to say
// what the server does. Its services answer a `find` with what is given. With `password` it has a login, and logs
// in again by itself with its token each time it connects, as a `FeathersConnection` does.
import {
    FeathersRecordSource,
    type AuthenticationRequest,
    type AuthenticationResult,
} from '@dmccuskey/feathers-connect'
import { Session, type SessionConnection, type SessionParts } from '../src/app/session.ts'
import type { ServerSetup } from '../src/app/setup.ts'

export interface FakeConnectionOptions {
    /** What each service answers a `find` with, by its path. A path that is not here is refused. */
    services?: Record<string, unknown>
    /** What `connect()` rejects with: the server refuses the connection. */
    error?: Error
    /** Whether `connect()` waits for `accept()`, `refuse()` or `failAttempt()`, as one that keeps trying. */
    manual?: boolean
    /** The secret the server accepts to log in, a password or a token, with any username. */
    password?: string
    /** Whether a login waits for `answerLogin()` or `failLogin()`. */
    manualLogin?: boolean
    /** Whether logging in again with the token, as the connection is made, is never answered. */
    silentRelogin?: boolean
    /** What a service answers a write with: the record, or it throws. Without it, a write is refused. */
    onWrite?: (write: FakeWrite) => unknown
}

/** A write a service was sent. */
export interface FakeWrite {
    path: string
    method: 'create' | 'update' | 'patch' | 'remove'
    id?: string
    data?: Record<string, unknown>
}

type Listener = () => void
type ErrorListener = (error: Error) => void

/** An error of the server's, with its code, as Feathers sends it. */
export function serverError(message: string, code: number): Error {
    return Object.assign(new Error(message), { code })
}

export class FakeConnection implements SessionConnection {
    readonly #options: FakeConnectionOptions
    readonly #connected = new Set<Listener>()
    readonly #disconnected = new Set<Listener>()
    readonly #connectErrors = new Set<ErrorListener>()
    #pending: { resolve: () => void; reject: (error: Error) => void } | undefined
    readonly #authenticated = new Set<Listener>()
    readonly #authenticationLost = new Set<ErrorListener>()
    #pendingLogin: { request: AuthenticationRequest; resolve: () => void; reject: (error: Error) => void } | undefined
    #isConnected = false
    #isTokenKept = false
    /** How many times `connect()` and `disconnect()` were called. */
    connects = 0
    disconnects = 0
    /** What each `authenticate()` sent. */
    logins: AuthenticationRequest[] = []
    logouts = 0
    /** The writes the services were sent. */
    writes: FakeWrite[] = []
    user: Record<string, unknown> | undefined

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
        if (this.#isTokenKept && !this.#options.silentRelogin) this.#loggedIn()
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

    async authenticate(request: AuthenticationRequest): Promise<AuthenticationResult> {
        this.logins.push(request)
        if (this.#options.manualLogin) {
            await new Promise<void>((resolve, reject) => (this.#pendingLogin = { request, resolve, reject }))
        }

        const secret = request.strategy === 'jwt' ? request.accessToken : request.password

        if (secret !== this.#options.password) throw serverError('Invalid login', 401)

        const user = { email: request.email }

        this.#loggedIn(user)

        return { accessToken: 'a token', user }
    }

    /** The server answers the login waiting, accepting or refusing it by its secret. */
    answerLogin(): void {
        this.#pendingLogin?.resolve()
        this.#pendingLogin = undefined
    }

    /** The login waiting fails without an answer of the server's. */
    failLogin(error: Error): void {
        this.#pendingLogin?.reject(error)
        this.#pendingLogin = undefined
    }

    async logout(): Promise<void> {
        this.logouts++
        this.#isTokenKept = false
        this.user = undefined
    }

    /** The token runs out: the server closes the socket, it connects again, and the token is refused. */
    expireToken(): void {
        this.drop()
        this.#isTokenKept = false
        this.user = undefined
        this.#isConnected = true
        for (const listener of this.#connected) listener()
        for (const listener of this.#authenticationLost) listener(serverError('jwt expired', 401))
    }

    service: SessionConnection['service'] = path => {
        const refused = async (): Promise<never> => {
            throw new Error('The fake service takes no writes')
        }
        const write = async (method: FakeWrite['method'], id?: string, data?: Record<string, unknown>) => {
            const sent = { path, method, ...(id === undefined ? {} : { id }), ...(data ? { data } : {}) }

            this.writes.push(sent)
            if (!this.#options.onWrite) return refused()

            return this.#options.onWrite(sent)
        }

        return {
            find: async () => {
                const services = this.#options.services

                if (!services || !(path in services)) throw new Error(`Service not found: ${path}`)

                return services[path]
            },
            get: refused,
            create: data => write('create', undefined, data),
            update: (id, data) => write('update', id, data),
            patch: (id, data) => write('patch', id, data),
            remove: id => write('remove', id),
            on: () => {},
            off: () => {},
        }
    }

    recordSource: SessionConnection['recordSource'] = (path, options) =>
        new FeathersRecordSource(this.service(path), { path, ...options })

    onConnected(listener: Listener): () => void {
        return on(this.#connected, listener)
    }

    onDisconnected(listener: Listener): () => void {
        return on(this.#disconnected, listener)
    }

    onConnectError(listener: ErrorListener): () => void {
        return on(this.#connectErrors, listener)
    }

    onAuthenticated(listener: Listener): () => void {
        return on(this.#authenticated, listener)
    }

    onAuthenticationLost(listener: ErrorListener): () => void {
        return on(this.#authenticationLost, listener)
    }

    #loggedIn(user = this.user): void {
        this.#isTokenKept = true
        this.user = user
        for (const listener of this.#authenticated) listener()
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
