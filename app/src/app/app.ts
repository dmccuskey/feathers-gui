// The app: the one object that always runs. It owns the setup, the secrets, the dialogs and the session with the
// active server, and needs no connection (ADR 004). It is made once by `createGuiApp()` and provided to the
// components, which get it by `useApp()`.
import { effectScope, inject, shallowRef, watch, type InjectionKey } from 'vue'
import { Dialogs } from './dialogs.ts'
import { Secrets, type SecretsOptions } from './secrets.ts'
import { Session, type LoginCredentials, type SessionParts } from './session.ts'
import {
    Setup,
    SetupBlockedError,
    SetupImportError,
    type LoginSetup,
    type ServerSetup,
    type ServiceSetup,
    type SetupOptions,
} from './setup.ts'

/** The app's kinds of dialog: each is added here with the dialog that is built. */
export type AppDialogs = {
    info: { input: null; answer: null }
    ask: { input: Question; answer: string }
    servers: { input: null; answer: null }
    server: { input: ServerDialogInput; answer: ServerDialogAnswer }
    service: { input: ServiceDialogInput; answer: ServiceDialogAnswer }
    login: { input: LoginDialogInput; answer: null }
}

/** A question with a button for each answer. The first button is where the focus starts. */
export interface Question {
    title: string
    text: string
    choices: readonly { value: string; label: string; variant?: 'plain' | 'primary' | 'danger' }[]
}

export interface ServerDialogInput {
    /** The server to edit. Unset: a new one. */
    server?: ServerSetup
    /** Whether a password or a token is in hand for it, so that none has to be typed. */
    hasSecret: boolean
}

export interface ServerDialogAnswer {
    /** Without a password: that is `secret`. */
    server: Omit<ServerSetup, 'id'>
    /** The password or the token typed. `null`: none was typed, and the one in hand stays. */
    secret: string | null
}

export interface ServiceDialogInput {
    /** The service to edit. Unset: a new one. */
    service?: ServiceSetup
    /** The paths of the server's other services: none is set up twice. */
    taken: readonly string[]
}

export type ServiceDialogAnswer = Pick<ServiceSetup, 'path' | 'load'>

export interface LoginDialogInput {
    /** The server to log in to, with its login. */
    server: ServerSetup & { login: LoginSetup }
    /** Why the last login failed, when it did. */
    reason?: string
    /**
     * Logs in, and remembers the password or the token in the setup once the server accepts it, if asked to.
     * Rejects with the server's reason; the dialog stays open for another try.
     */
    logIn(credentials: LoginCredentials, remember: boolean): Promise<void>
}

/** What the app needs of the page: whether it is shown, and when that changes. Default: `document`. */
export type PageVisibility = Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>

export interface AppOptions {
    /** Where the setup is kept. Default: the browser's storage. */
    storage?: SetupOptions
    /** Makes the session with a server. Default: a `Session`. */
    makeSession?: (server: ServerSetup, parts: SessionParts) => Session
    /** How the secrets are shared with the other windows. Default: over the app's `BroadcastChannel`. */
    secrets?: SecretsOptions
    /** Whether the page is shown: a login dialog waits for it. Default: `document`, when there is one. */
    page?: PageVisibility | null
}

/** The key the app is provided under: `vueApp.provide(APP_KEY, app)`. */
export const APP_KEY: InjectionKey<App> = Symbol('feathers-gui.app')

export class App {
    readonly setup: Setup
    readonly secrets: Secrets
    readonly dialogs = new Dialogs<AppDialogs>()

    readonly #makeSession: NonNullable<AppOptions['makeSession']>
    readonly #session = shallowRef<Session | null>(null)
    readonly #scope = effectScope(true)
    readonly #page: PageVisibility | null
    // The login dialog was shown for this session, or the user logged out: it does not open by itself again
    #isLoginAsked = false

    constructor(options: AppOptions = {}) {
        this.setup = new Setup(options.storage)
        this.secrets = new Secrets(options.secrets)
        this.#makeSession = options.makeSession ?? ((server, parts) => new Session(server, parts))
        this.#page = options.page === undefined ? (globalThis.document ?? null) : options.page
        this.#page?.addEventListener('visibilitychange', this.#onVisibility)

        this.#scope.run(() => {
            // Whichever window changed the setup: the secret of a server goes with the server or with its login,
            // and the session follows its server.
            watch(
                () => this.setup.servers,
                (servers, before) => {
                    for (const server of before) {
                        const after = servers.find(other => other.id === server.id)

                        if (!after || !sameLogin(after, server)) this.secrets.forget(server.id)
                    }

                    this.#followServer(servers, before)
                },
                { flush: 'sync' },
            )
            // The login dialog opens by itself when the session waits for a login, and goes when it is not needed
            watch(
                () => [this.#session.value, this.#session.value?.status.phase] as const,
                ([session, phase], before) => {
                    // Not while logging in: that is the dialog's own login, and a refusal comes back to it
                    if (session !== before?.[0] || phase === 'ready' || phase === 'closed') this.#closeLogin()
                    if (phase === 'login-needed') this.#askLoginOnce()
                },
                { flush: 'sync' },
            )
        })
    }

    /** The session with the active server, or `null` when no server is active. */
    get session(): Session | null {
        return this.#session.value
    }

    /** Ends the session there is, makes one with this server and opens it. The server is this window's current one. */
    activateServer(serverId: string): void {
        const server = this.setup.server(serverId)

        if (!server) throw new Error(`No server with the ID "${serverId}"`)

        this.#endSession()
        this.setup.currentServerId = serverId
        this.#isLoginAsked = false

        const session = this.#makeSession(server, { setup: this.setup, secrets: this.secrets })

        this.#session.value = session
        void session.open()
    }

    /** Ends the session. No server is current, so a reload of the page starts with none. */
    deactivate(): void {
        this.#endSession()
        this.setup.currentServerId = null
    }

    /**
     * Asks for the password or the token of the session's server, and logs in with it. The dialog stays until the
     * server accepts it or the user cancels, and goes by itself when the session no longer waits for a login.
     */
    async logIn(): Promise<void> {
        const session = this.#session.value
        const server = session ? this.setup.server(session.serverId) : undefined
        const login = server?.login

        if (!session || !server || !login || session.status.phase !== 'login-needed') return
        if (this.dialogs.open.some(dialog => dialog.kind === 'login')) return

        this.#isLoginAsked = true

        const reason = session.status.error?.message

        await this.dialogs.show('login', {
            server: { ...server, login },
            ...(reason === undefined ? {} : { reason }),
            logIn: async (credentials, remember) => {
                await session.login(credentials)

                if (!remember || this.#session.value !== session) return

                const secret = 'token' in credentials ? credentials.token : credentials.password
                const now = this.setup.server(server.id)?.login

                if (!now) return

                // Remembered in the setup, it is no longer held in memory
                await this.#write(() => {
                    this.setup.updateServer(server.id, { login: { ...now, remember: true, password: secret } })
                    this.secrets.forget(server.id)
                })
            },
        })
    }

    /** Logs out of the session's server. The login dialog does not open by itself until the next session. */
    async logOut(): Promise<void> {
        this.#isLoginAsked = true
        this.#closeLogin()
        await this.#session.value?.logout()
    }

    /** Shows what the app is. */
    async showInfo(): Promise<void> {
        await this.dialogs.show('info', null)
    }

    /** Shows the servers, with what adds, edits and removes one, and the export and import of the setup. */
    async manageServers(): Promise<void> {
        await this.dialogs.show('servers', null)
    }

    /** Asks for a new server and adds it. The first server is made the current one. */
    async addServer(): Promise<void> {
        const answer = await this.dialogs.show('server', { hasSecret: false })

        if (!answer) return

        await this.#write(() => {
            const server = this.setup.addServer(withSecret(answer.server, answer.secret))

            this.#keepSecret(server.id, answer.server, answer.secret)

            if (this.setup.currentServerId === null) this.activateServer(server.id)
        })
    }

    /** Asks for the changes to a server and makes them. */
    async editServer(serverId: string): Promise<void> {
        const before = this.setup.server(serverId)

        if (!before) return

        const held = before.login?.password ?? this.secrets.held(serverId)
        const answer = await this.dialogs.show('server', { server: before, hasSecret: held !== undefined })

        if (!answer) return

        // What was in hand stays for the same kind of login, and is nothing to another.
        const kept = before.login?.kind === answer.server.login?.kind ? (held ?? null) : null
        const secret = answer.secret ?? kept

        await this.#write(() => {
            this.setup.updateServer(serverId, { login: undefined, ...withSecret(answer.server, secret) })
            this.#keepSecret(serverId, answer.server, secret)
        })
    }

    /** Removes a server and its services, once the user has agreed. */
    async removeServer(serverId: string): Promise<void> {
        const server = this.setup.server(serverId)

        if (!server) return

        const count = this.setup.servicesOf(serverId).length
        const services = count === 0 ? '' : count === 1 ? ' and its service' : ` and its ${count} services`
        const answer = await this.dialogs.show('ask', {
            title: 'Remove the server?',
            text: `"${server.name || server.url}"${services} will be removed from the setup. Nothing changes on the server.`,
            choices: [
                { value: 'cancel', label: 'Cancel' },
                { value: 'remove', label: 'Remove', variant: 'danger' },
            ],
        })

        if (answer !== 'remove') return

        await this.#write(() => this.setup.removeServer(serverId))
    }

    /** Asks for a new service of the current server and adds it. The first service is made the current one. */
    async addService(): Promise<void> {
        const serverId = this.setup.currentServerId

        if (serverId === null) return

        const taken = this.setup.servicesOf(serverId).map(service => service.path)
        const answer = await this.dialogs.show('service', { taken })

        if (!answer) return

        await this.#write(() => {
            const service = this.setup.addService({ serverId, ...answer, fields: [], pins: [] })

            if (this.setup.currentServiceId(serverId) === null) this.setup.setCurrentService(serverId, service.id)
        })
    }

    /** Asks for the changes to a service and makes them. */
    async editService(serviceId: string): Promise<void> {
        const service = this.setup.service(serviceId)

        if (!service) return

        const taken = this.setup
            .servicesOf(service.serverId)
            .filter(other => other.id !== serviceId)
            .map(other => other.path)
        const answer = await this.dialogs.show('service', { service, taken })

        if (answer) await this.#write(() => this.setup.updateService(serviceId, answer))
    }

    /** Removes a service, once the user has agreed. */
    async removeService(serviceId: string): Promise<void> {
        const service = this.setup.service(serviceId)

        if (!service) return

        const answer = await this.dialogs.show('ask', {
            title: 'Remove the service?',
            text: `"${service.path}" will be removed from the setup, with its fields and pins. Nothing changes on the server.`,
            choices: [
                { value: 'cancel', label: 'Cancel' },
                { value: 'remove', label: 'Remove', variant: 'danger' },
            ],
        })

        if (answer === 'remove') await this.#write(() => this.setup.removeService(serviceId))
    }

    /** Takes in an exported setup, once the user has said how. */
    async importSetup(json: string): Promise<void> {
        const empty = this.setup.servers.length === 0
        const how = empty
            ? 'replace'
            : await this.dialogs.show('ask', {
                  title: 'Import the setup',
                  text: 'Add the servers and services of the file to those set up here, or put the file in place of them?',
                  choices: [
                      { value: 'cancel', label: 'Cancel' },
                      { value: 'replace', label: 'Replace', variant: 'danger' },
                      { value: 'merge', label: 'Add' },
                  ],
              })

        if (how !== 'merge' && how !== 'replace') return

        await this.#write(() => this.setup.import(json, how))
    }

    /** Ends the session and everything the app owns. What is current stays, for the next start. */
    destroy(): void {
        this.#scope.stop()
        this.#page?.removeEventListener('visibilitychange', this.#onVisibility)
        this.#endSession()
        this.dialogs.destroy()
        this.secrets.destroy()
        this.setup.destroy()
    }

    /** Makes a change to the setup, and says so when the setup refuses it. */
    async #write(change: () => void): Promise<void> {
        try {
            change()
        } catch (error) {
            if (!(error instanceof SetupBlockedError) && !(error instanceof SetupImportError)) throw error

            await this.dialogs.show('ask', {
                title: 'The setup was not changed',
                text: error.message,
                choices: [{ value: 'ok', label: 'OK', variant: 'primary' }],
            })
        }
    }

    /** A secret that is not remembered is held here, in memory. One that is remembered is in the setup. */
    #keepSecret(serverId: string, server: Omit<ServerSetup, 'id'>, secret: string | null): void {
        if (server.login && !server.login.remember && secret !== null) this.secrets.set(serverId, secret)
        else this.secrets.forget(serverId)
    }

    /** Ends the session when its server is removed, and makes a new one when its address or login changes. */
    #followServer(servers: readonly ServerSetup[], before: readonly ServerSetup[]): void {
        const serverId = this.#session.value?.serverId

        if (serverId === undefined) return

        const was = before.find(server => server.id === serverId)
        const now = servers.find(server => server.id === serverId)

        if (!now) this.deactivate()
        else if (was && (now.url !== was.url || !sameLogin(now, was))) this.activateServer(serverId)
    }

    /** Opens the login dialog once for the session, when the page is shown; a page hidden waits until it is. */
    #askLoginOnce(): void {
        if (this.#isLoginAsked || this.#page?.visibilityState === 'hidden') return

        void this.logIn()
    }

    #onVisibility = (): void => {
        if (this.#session.value?.status.phase === 'login-needed') this.#askLoginOnce()
    }

    #closeLogin(): void {
        for (const dialog of this.dialogs.open) if (dialog.kind === 'login') dialog.cancel()
    }

    #endSession(): void {
        const session = this.#session.value

        this.#session.value = null
        session?.destroy()
    }
}

/**
 * Whether two setups of a server log in alike: the same kind, path, fields and user. Whether the password is
 * remembered, and which, is not the login: the session takes a password remembered when it waits for one.
 */
function sameLogin(a: ServerSetup, b: ServerSetup): boolean {
    return JSON.stringify(loginOf(a)) === JSON.stringify(loginOf(b))
}

function loginOf(server: ServerSetup): Omit<LoginSetup, 'password' | 'remember'> | undefined {
    if (!server.login) return undefined

    const { password: _password, remember: _remember, ...login } = server.login

    return login
}

/** The server with its secret as the remembered password, when it has a login that remembers. */
function withSecret(server: Omit<ServerSetup, 'id'>, secret: string | null): Omit<ServerSetup, 'id'> {
    return server.login?.remember && secret !== null
        ? { ...server, login: { ...server.login, password: secret } }
        : server
}

/** Makes the app, and activates the server that was current in this window last time, if there is one. */
export function createGuiApp(options: AppOptions = {}): App {
    const app = new App(options)
    const serverId = app.setup.currentServerId

    if (serverId !== null) app.activateServer(serverId)

    return app
}

/** The app, in a component. */
export function useApp(): App {
    const app = inject(APP_KEY)

    if (!app) throw new Error('The app is not provided: useApp() needs provide(APP_KEY, app)')

    return app
}
