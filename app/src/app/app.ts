// The app: the one object that always runs. It owns the setup, the secrets, the dialogs and the session with the
// active server, and needs no connection (ADR 004). It is made once by `createGuiApp()` and provided to the
// components, which get it by `useApp()`.
import { effectScope, inject, shallowRef, watch, type InjectionKey } from 'vue'
import { Dialogs } from './dialogs.ts'
import { Secrets } from './secrets.ts'
import { Session, type SessionParts } from './session.ts'
import { Setup, type ServerSetup, type SetupOptions } from './setup.ts'

/** The app's kinds of dialog. None yet: each is added here with the dialog that is built. */
export type AppDialogs = {}

export interface AppOptions {
    /** Where the setup is kept. Default: the browser's storage. */
    storage?: SetupOptions
    /** Makes the session with a server. Default: a `Session`. */
    makeSession?: (server: ServerSetup, parts: SessionParts) => Session
}

/** The key the app is provided under: `vueApp.provide(APP_KEY, app)`. */
export const APP_KEY: InjectionKey<App> = Symbol('feathers-gui.app')

export class App {
    readonly setup: Setup
    readonly secrets = new Secrets()
    readonly dialogs = new Dialogs<AppDialogs>()

    readonly #makeSession: NonNullable<AppOptions['makeSession']>
    readonly #session = shallowRef<Session | null>(null)
    readonly #scope = effectScope(true)

    constructor(options: AppOptions = {}) {
        this.setup = new Setup(options.storage)
        this.#makeSession = options.makeSession ?? ((server, parts) => new Session(server, parts))

        this.#scope.run(() => {
            // The secret of a server goes with the server, whichever window removed it.
            watch(
                () => this.setup.servers,
                (servers, before) => {
                    for (const server of before) {
                        if (!servers.some(other => other.id === server.id)) this.secrets.forget(server.id)
                    }
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

        const session = this.#makeSession(server, { setup: this.setup, secrets: this.secrets })

        this.#session.value = session
        void session.open()
    }

    /** Ends the session. No server is current, so a reload of the page starts with none. */
    deactivate(): void {
        this.#endSession()
        this.setup.currentServerId = null
    }

    /** Ends the session and everything the app owns. What is current stays, for the next start. */
    destroy(): void {
        this.#scope.stop()
        this.#endSession()
        this.dialogs.destroy()
        this.secrets.destroy()
        this.setup.destroy()
    }

    #endSession(): void {
        const session = this.#session.value

        this.#session.value = null
        session?.destroy()
    }
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
