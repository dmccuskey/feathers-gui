// The session with the active server: its connection, and the state machine that says where it stands (ADR 004).
// It logs in where the server has a login, and reads the first records of a service until the service views take
// over the reading.
import { FeathersConnection, type AuthenticationRequest } from '@dmccuskey/feathers-connect'
import { StateMachine } from 'micro-fsm'
import { shallowRef, watch } from 'vue'
import type { Secrets } from './secrets.ts'
import type { LoginSetup, ServerSetup, Setup } from './setup.ts'

export interface SessionParts {
    setup: Setup
    secrets: Secrets
    /** Makes the connection to a server. Default: a `FeathersConnection` that keeps trying. */
    makeConnection?: (server: ServerSetup) => SessionConnection
    /** How long the session waits for the connection to log in again by itself, in milliseconds. */
    loginWait?: number
}

/** What the session uses of a `FeathersConnection`. */
export type SessionConnection = Pick<
    FeathersConnection,
    | 'connect'
    | 'disconnect'
    | 'service'
    | 'onConnected'
    | 'onDisconnected'
    | 'onConnectError'
    | 'authenticate'
    | 'logout'
    | 'onAuthenticated'
    | 'onAuthenticationLost'
    | 'user'
>

/** What the user gives to log in: a username and password, or an access token for a login of kind `token`. */
export type LoginCredentials = { username: string; password: string } | { token: string }

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
    /** The record logged in as, as the server answered. */
    user?: Record<string, unknown>
    /** `retryNow()` was called, and the attempt it made has not yet ended. */
    isRetrying?: boolean
}

/** How many records `firstPage()` returns at most. */
export const FIRST_PAGE = 25

/**
 * How long the session waits for the connection to log in again with its token, by default. A login the connection
 * sends that is not answered says nothing, so the session sends one of its own once this has passed. It is longer
 * than the connection's own wait for an answer, 10 seconds.
 */
export const LOGIN_WAIT = 15_000

/** A secret to log in with, and where it came from. */
interface Credentials {
    username: string
    secret: string
    /** Typed by the user for `login()`, and not yet accepted by the server. */
    isOffered?: boolean
}
export class Session {
    readonly serverId: string

    readonly #connection: SessionConnection
    readonly #status = shallowRef<SessionStatus>({ phase: 'closed', attempts: 0 })
    readonly #machine: StateMachine<SessionPhase>
    readonly #unsubscribe: (() => void)[]
    readonly #setup: Setup
    readonly #secrets: Secrets
    readonly #loginWait: number
    // Where the connection's news says the session should be. `#settle()` takes it there
    #wanted: SessionPhase = 'closed'
    #isSettling = false
    #attempts = 0
    #error: SessionStatus['error']
    #isRetrying = false
    // Counts the `connect()` calls; one that is not the last ended by `retryNow()`, which is not a failure
    #connectCount = 0
    #destroyed = false
    // The `open()` calls waiting for the session to be ready, or closed again
    #arrivals = new Set<() => void>()
    // The secret the server last accepted in this session: the one to log in again with
    #credentials: Credentials | undefined
    // What `login()` was given, until the server answers it
    #offered: Credentials | undefined
    // What the login under way sent, taken as `#credentials` when the server accepts it
    #sending: Credentials | undefined
    // The `login()` calls waiting for the server's answer
    #logins = new Set<{ resolve: () => void; reject: (error: Error) => void }>()
    // The connection holds a token, and logs in with it by itself each time it connects
    #isTokenKept = false
    // The user logged out: the session does not log in again until `login()`
    #isLoggedOut = false
    // Counts the logins started; one that is not the last is ignored when it ends
    #loginCount = 0
    #loginTimer: ReturnType<typeof setTimeout> | undefined

    constructor(server: ServerSetup, parts: SessionParts) {
        this.serverId = server.id
        this.#setup = parts.setup
        this.#secrets = parts.secrets
        this.#loginWait = parts.loginWait ?? LOGIN_WAIT
        this.#connection = (parts.makeConnection ?? makeConnection)(server)
        this.#machine = new StateMachine<SessionPhase>({
            initial: 'closed',
            states: {
                connecting: { from: 'closed', enter: () => this.#connect() },
                'logging-in': {
                    from: ['connecting', 'login-needed', 'lost', 'ready'],
                    enter: () => void this.#logIn(),
                    leave: () => this.#endLogin(),
                },
                'login-needed': { from: ['logging-in', 'ready', 'lost'] },
                // From `login-needed`: a login again that the session stopped waiting for, answered late
                ready: { from: ['connecting', 'logging-in', 'lost', 'login-needed'] },
                lost: { from: ['ready', 'logging-in', 'login-needed'] },
                closed: {
                    from: '*',
                    enter: () => {
                        this.#isRetrying = false
                        this.#endLogin()
                        this.#refuseLogins(new Error('The session was closed'))
                        void this.#connection.disconnect()
                    },
                },
            },
        })
        // The listeners only note what is wanted: they must not throw, or the connection would not hear an attempt
        this.#unsubscribe = [
            this.#connection.onConnected(() => {
                this.#attempts = 0
                this.#error = undefined
                this.#isRetrying = false
                this.#want(server.login ? 'logging-in' : 'ready')
            }),
            this.#connection.onDisconnected(() => this.#want('lost')),
            this.#connection.onAuthenticated(() => {
                if (this.#sending) {
                    this.#credentials = { username: this.#sending.username, secret: this.#sending.secret }
                    if (this.#sending.isOffered) {
                        this.#secrets.set(this.serverId, this.#sending.secret)
                        this.#offered = undefined
                    }
                    this.#sending = undefined
                }
                this.#isTokenKept = true
                this.#error = undefined
                this.#want('ready')
            }),
            this.#connection.onAuthenticationLost(error => {
                this.#isTokenKept = false
                this.#error = errorOf(error)
                // Waiting for the connection to log in by itself, which it will not now: log in with the secret
                if (this.#loginTimer !== undefined) void this.#logIn()
                else this.#want('logging-in')
            }),
            this.#connection.onConnectError(error => {
                this.#attempts++
                this.#error = { message: error.message }
                this.#isRetrying = false
                this.#publish()
            }),
            // A secret that comes while the session waits for one: typed in another window, or remembered
            this.#secrets.onSet(serverId => {
                if (serverId === this.serverId) this.#secretArrived()
            }),
            watch(
                () => {
                    const login = this.#loginSetup()

                    return login?.remember ? login.password : undefined
                },
                password => {
                    if (password !== undefined) this.#secretArrived()
                },
            ),
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
     * Logs in with what the user typed, in place of the login there is. Resolves once the session is ready, and
     * rejects with the server's error when it refuses, the session then waiting for `login()` again. The secret is
     * held for this window once the server accepts it.
     */
    login(credentials: LoginCredentials): Promise<void> {
        const login = this.#loginSetup()
        const phase = this.#machine.state

        if (!login) return Promise.reject(new Error('The server has no login'))
        if (phase !== 'login-needed' && phase !== 'ready' && phase !== 'logging-in') {
            return Promise.reject(new Error(`The session cannot log in while ${phase}`))
        }

        const result = new Promise<void>((resolve, reject) => this.#logins.add({ resolve, reject }))

        this.#offered =
            'token' in credentials
                ? { username: login.username, secret: credentials.token, isOffered: true }
                : { username: credentials.username, secret: credentials.password, isOffered: true }
        this.#isLoggedOut = false
        if (phase === 'logging-in') void this.#logIn()
        else this.#want('logging-in')

        return result
    }

    /**
     * Tries to connect at once, while connecting or lost, in place of waiting for the next attempt. The waits
     * between attempts start again from the shortest.
     */
    retryNow(): void {
        const phase = this.#machine.state

        if ((phase !== 'connecting' && phase !== 'lost') || this.#wanted !== phase) return

        // The `connect()` under way ends now, and is not a failure
        this.#connectCount++
        this.#isRetrying = true
        this.#publish()
        void this.#connection.disconnect().then(() => {
            if (this.#wanted === 'connecting' || this.#wanted === 'lost') this.#connect()
        })
    }

    /** Logs out, and forgets the secret held for this window. The session waits for `login()`. */
    async logout(): Promise<void> {
        if (!this.#loginSetup()) return

        this.#isLoggedOut = true
        this.#isTokenKept = false
        this.#credentials = undefined
        this.#offered = undefined
        this.#error = undefined
        this.#secrets.forget(this.serverId)
        this.#refuseLogins(new Error('Logged out'))
        this.#want('login-needed')
        await this.#connection.logout()
        this.#publish()
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

    /**
     * Logs in, or waits for the connection to: with what `login()` was given, else by the token the connection
     * holds, else with the secret in hand. With none, the session waits for `login()`.
     */
    async #logIn(): Promise<void> {
        const count = ++this.#loginCount

        this.#stopWaiting()
        if (!this.#offered && this.#isTokenKept) {
            this.#loginTimer = setTimeout(() => {
                this.#loginTimer = undefined
                this.#isTokenKept = false
                this.#error = { message: 'The server did not answer the login' }
                void this.#logIn()
            }, this.#loginWait)

            return
        }

        const credentials = this.#offered ?? this.#credentials ?? (await this.#credentialsInHand())

        if (count !== this.#loginCount) return
        if (!credentials || (this.#isLoggedOut && !credentials.isOffered)) {
            this.#want('login-needed')

            return
        }

        this.#sending = credentials
        try {
            await this.#connection.authenticate(requestOf(this.#loginSetup(), credentials))
        } catch (error: unknown) {
            // Ended meanwhile: the connection was lost, the session closed, or another login started
            if (count !== this.#loginCount) return

            const failure = errorOf(error)

            this.#sending = undefined
            if (failure.code === 401) {
                this.#credentials = undefined
                if (!credentials.isOffered) this.#secrets.refused(this.serverId, credentials.secret)
            }
            if (credentials.isOffered) this.#offered = undefined
            this.#error = failure
            this.#refuseLogins(error instanceof Error ? error : new Error(failure.message))
            this.#want('login-needed')
        }
    }

    /**
     * The secret for the server's login: the one remembered in its setup, or the one typed in this window or in
     * another one, which `Secrets` asks for.
     */
    async #credentialsInHand(): Promise<Credentials | undefined> {
        const login = this.#loginSetup()
        const secret = (login?.remember ? login.password : undefined) ?? (await this.#secrets.get(this.serverId))

        return login && secret !== undefined ? { username: login.username, secret } : undefined
    }

    /** The server's login as it is set up now. */
    #loginSetup(): LoginSetup | undefined {
        return this.#setup.server(this.serverId)?.login
    }

    /** Logs in with a new secret, when the session waits for one and the user did not log out. */
    #secretArrived(): void {
        if (this.#machine.state !== 'login-needed' || this.#wanted !== 'login-needed' || this.#isLoggedOut) return

        // What the server last accepted, kept after a login that was not answered, is older
        this.#credentials = undefined
        this.#want('logging-in')
    }

    /** Leaving `logging-in`: what the login under way ends with is ignored. */
    #endLogin(): void {
        this.#loginCount++
        this.#sending = undefined
        this.#stopWaiting()
    }

    #stopWaiting(): void {
        clearTimeout(this.#loginTimer)
        this.#loginTimer = undefined
    }

    #refuseLogins(error: Error): void {
        for (const { reject } of this.#logins) reject(error)
        this.#logins.clear()
    }

    /** Starts to connect. A connection the server refuses closes the session, with the reason. */
    #connect(): void {
        const count = ++this.#connectCount

        this.#connection.connect().catch((error: unknown) => {
            // A connect() ended by closing the session, or by trying again at once, is not a failure
            if (count !== this.#connectCount || this.#wanted === 'closed') return

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
            ...(phase === 'ready' && this.#connection.user ? { user: this.#connection.user } : {}),
            ...(this.#isRetrying ? { isRetrying: true } : {}),
        }
    }

    /** Resolves the `open()` calls waiting, when the session has come where one ends. */
    #arrive(): void {
        const phase = this.#machine.state

        if (phase === 'ready') {
            for (const { resolve } of this.#logins) resolve()
            this.#logins.clear()
        }
        if (phase !== 'ready' && phase !== 'login-needed' && phase !== 'closed') return

        for (const resolve of this.#arrivals) resolve()
        this.#arrivals.clear()
    }
}

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

/** The message of an error, and its code when the server gave one: 401 for a refused login. */
function errorOf(error: unknown): { message: string; code?: number } {
    const code = (error as { code?: unknown } | null)?.code

    return { message: messageOf(error), ...(typeof code === 'number' ? { code } : {}) }
}

/** A `FeathersConnection` to the server, that keeps trying and knows where the server's login is. */
function makeConnection(server: ServerSetup): SessionConnection {
    return new FeathersConnection({
        url: server.url,
        keepTrying: true,
        ...(server.login ? { authentication: { path: server.login.path } } : {}),
    })
}

/** What to send to log in: the token by the `jwt` strategy, or the username and password by `local`. */
function requestOf(login: LoginSetup | undefined, credentials: Credentials): AuthenticationRequest {
    if (login?.kind === 'token') return { strategy: 'jwt', accessToken: credentials.secret }

    return {
        strategy: 'local',
        [login?.usernameField ?? 'email']: credentials.username,
        [login?.passwordField ?? 'password']: credentials.secret,
    }
}
