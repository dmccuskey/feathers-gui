import { expect, test } from 'bun:test'
import { mount } from '@vue/test-utils'
import { defineComponent, h, watch } from 'vue'
import { FakeBrowser, type FakeWindow } from '../../test-support/fake-browser.ts'
import { fakeConnection, fakeSessions } from '../../test-support/fake-connection.ts'
import {
    APP_KEY,
    App,
    createGuiApp,
    useApp,
    type AppOptions,
    type LoginDialogInput,
    type PageVisibility,
    type ServiceDialogInput,
} from './app.ts'
import type { OpenDialog } from './dialogs.ts'
import { Session, type SessionParts } from './session.ts'
import { Setup, type ServerSetup } from './setup.ts'

const SERVER: Omit<ServerSetup, 'id'> = { name: 'Local', url: 'http://localhost:3041', readOnly: false }
// Each test's windows keep their secrets to themselves: one about sharing them says so
const ALONE = { channel: null }
const LOGIN = {
    kind: 'local',
    path: 'authentication',
    usernameField: 'email',
    passwordField: 'password',
    username: 'ada@example.com',
    remember: false,
} as const

/** A session that records what the app does with it, and connects to nothing. */
class LoggedSession extends Session {
    readonly #note: (what: string) => void

    constructor(server: ServerSetup, parts: SessionParts, log: string[]) {
        super(server, { ...parts, makeConnection: () => fakeConnection() })
        this.#note = what => void log.push(`${what} ${server.name}`)
    }

    override async open(): Promise<void> {
        this.#note('open')
    }

    override destroy(): void {
        this.#note('destroy')
    }
}

/** Records the sessions the app makes, and what it does with each. */
function loggedSessions(window: FakeWindow): { options: AppOptions; log: string[] } {
    const log: string[] = []

    return {
        log,
        options: {
            storage: window,
            secrets: ALONE,
            makeSession: (server, parts) => {
                log.push(`make ${server.name}`)

                return new LoggedSession(server, parts, log)
            },
        },
    }
}

test('a new app has its parts, and no session', () => {
    const app = new App({ storage: new FakeBrowser().open(), makeSession: fakeSessions(), secrets: ALONE })

    expect(app.setup.servers).toEqual([])
    expect(app.dialogs.open).toEqual([])
    expect(app.secrets.has('any')).toBe(false)
    expect(app.session).toBeNull()
})

test('activating a server makes its session, opens it, and makes the server current', () => {
    const { options, log } = loggedSessions(new FakeBrowser().open())
    const app = new App(options)
    const server = app.setup.addServer(SERVER)

    app.activateServer(server.id)

    expect(app.session?.serverId).toBe(server.id)
    expect(app.setup.currentServerId).toBe(server.id)
    expect(log).toEqual(['make Local', 'open Local'])
})

test('the session is given the setup and the secrets of the app', () => {
    const window = new FakeBrowser().open()
    const parts: unknown[] = []
    const app = new App({
        storage: window,
        secrets: ALONE,
        makeSession: (server, given) => {
            parts.push(given)

            return new LoggedSession(server, given, [])
        },
    })

    app.activateServer(app.setup.addServer(SERVER).id)

    expect(parts).toEqual([{ setup: app.setup, secrets: app.secrets }])
})

test('activating another server ends the session there is first', () => {
    const { options, log } = loggedSessions(new FakeBrowser().open())
    const app = new App(options)
    const local = app.setup.addServer(SERVER)
    const other = app.setup.addServer({ ...SERVER, name: 'Other' })
    app.activateServer(local.id)

    app.activateServer(other.id)

    expect(app.session?.serverId).toBe(other.id)
    expect(log).toEqual(['make Local', 'open Local', 'destroy Local', 'make Other', 'open Other'])
})

test('a server that is not set up is not activated, and the session there is stays', () => {
    const { options, log } = loggedSessions(new FakeBrowser().open())
    const app = new App(options)
    const server = app.setup.addServer(SERVER)
    app.activateServer(server.id)

    expect(() => app.activateServer('unknown')).toThrow('No server with the ID "unknown"')
    expect(app.session?.serverId).toBe(server.id)
    expect(log).toEqual(['make Local', 'open Local'])
})

test('deactivate() ends the session, and no server is current', () => {
    const { options, log } = loggedSessions(new FakeBrowser().open())
    const app = new App(options)
    app.activateServer(app.setup.addServer(SERVER).id)

    app.deactivate()

    expect(app.session).toBeNull()
    expect(app.setup.currentServerId).toBeNull()
    expect(log).toEqual(['make Local', 'open Local', 'destroy Local'])
})

test('what reads the session is told when it changes', () => {
    const { options } = loggedSessions(new FakeBrowser().open())
    const app = new App(options)
    const server = app.setup.addServer(SERVER)
    const told: (string | null)[] = []
    watch(
        () => app.session,
        session => told.push(session?.serverId ?? null),
        { flush: 'sync' },
    )

    app.activateServer(server.id)
    app.deactivate()

    expect(told).toEqual([server.id, null])
})

test('a secret is kept while going to another server and back', () => {
    const { options } = loggedSessions(new FakeBrowser().open())
    const app = new App(options)
    const local = app.setup.addServer(SERVER)
    const other = app.setup.addServer({ ...SERVER, name: 'Other' })
    app.activateServer(local.id)
    app.secrets.set(local.id, 'typed')

    app.activateServer(other.id)
    app.activateServer(local.id)

    expect(app.secrets.held(local.id)).toBe('typed')
})

test('the secret of a server goes when the server is removed, in this window or another', () => {
    const browser = new FakeBrowser()
    const app = new App({ storage: browser.open(), makeSession: fakeSessions(), secrets: ALONE })
    const elsewhere = new Setup(browser.open())
    const local = app.setup.addServer(SERVER)
    const other = app.setup.addServer({ ...SERVER, name: 'Other' })
    const kept = app.setup.addServer({ ...SERVER, name: 'Kept' })
    for (const server of [local, other, kept]) app.secrets.set(server.id, 'typed')

    app.setup.removeServer(local.id)
    elsewhere.removeServer(other.id)

    expect(app.secrets.has(local.id)).toBe(false)
    expect(app.secrets.has(other.id)).toBe(false)
    expect(app.secrets.has(kept.id)).toBe(true)
})

test('the secret of a server goes when its login changes, in this window or another, and stays otherwise', () => {
    const browser = new FakeBrowser()
    const app = new App({ storage: browser.open(), makeSession: fakeSessions(), secrets: ALONE })
    const elsewhere = new Setup(browser.open())
    const login = { ...SERVER, login: { ...LOGIN } }
    const local = app.setup.addServer(login)
    const other = app.setup.addServer({ ...login, name: 'Other' })
    const kept = app.setup.addServer({ ...login, name: 'Kept' })
    for (const server of [local, other, kept]) app.secrets.set(server.id, 'typed')

    app.setup.updateServer(local.id, { login: { ...LOGIN, username: 'grace@example.com' } })
    elsewhere.updateServer(other.id, { login: { ...LOGIN, path: 'auth' } })
    elsewhere.updateServer(kept.id, { name: 'Renamed', url: 'http://localhost:3999', readOnly: true })

    expect(app.secrets.has(local.id)).toBe(false)
    expect(app.secrets.has(other.id)).toBe(false)
    expect(app.secrets.held(kept.id)).toBe('typed')
})

test('the session follows its server when another window changes it', () => {
    const browser = new FakeBrowser()
    const { options, log } = loggedSessions(browser.open())
    const app = new App(options)
    const elsewhere = new Setup(browser.open())
    const server = app.setup.addServer(SERVER)
    const other = app.setup.addServer({ ...SERVER, name: 'Other' })
    app.activateServer(server.id)
    log.length = 0

    elsewhere.updateServer(server.id, { name: 'Renamed', readOnly: true })
    elsewhere.updateServer(other.id, { url: 'http://localhost:3999' })
    expect(log).toEqual([])

    elsewhere.updateServer(server.id, { url: 'http://localhost:3999' })
    expect(log).toEqual(['destroy Local', 'make Renamed', 'open Renamed'])

    elsewhere.updateServer(server.id, { login: { ...LOGIN } })
    expect(log.slice(3)).toEqual(['destroy Renamed', 'make Renamed', 'open Renamed'])

    elsewhere.removeServer(server.id)
    expect(log.slice(6)).toEqual(['destroy Renamed'])
    expect(app.session).toBeNull()
    expect(app.setup.currentServerId).toBeNull()
})

test('an import replaces the session only when it changes the server, and ends it when it removes it', async () => {
    const { app, log } = flowApp()
    const server = app.setup.addServer(SERVER)
    app.activateServer(server.id)
    log.length = 0

    const exported = (changes: Partial<ServerSetup>) =>
        JSON.stringify({ version: 1, servers: [{ ...server, ...changes }], services: [] })
    const unrelated = JSON.stringify({ version: 1, servers: [{ ...SERVER, id: 'other' }], services: [] })

    let flow = app.importSetup(exported({ name: 'Same place' }))
    await answer(app, 'ask', 'merge')
    await flow
    expect(log).toEqual([])

    flow = app.importSetup(exported({ name: 'Same place', url: 'http://localhost:3999' }))
    await answer(app, 'ask', 'merge')
    await flow
    expect(log).toEqual(['destroy Local', 'make Same place', 'open Same place'])

    flow = app.importSetup(unrelated)
    await answer(app, 'ask', 'replace')
    await flow
    expect(log.slice(3)).toEqual(['destroy Same place'])
    expect(app.session).toBeNull()
})

test('destroy() ends the session, the dialogs and the secrets, and keeps what is current', async () => {
    const browser = new FakeBrowser()
    const { options, log } = loggedSessions(browser.open())
    const app = new App(options)
    const elsewhere = new Setup(browser.open())
    const server = app.setup.addServer(SERVER)
    app.activateServer(server.id)
    app.secrets.set(server.id, 'typed')
    const answer = (app.dialogs as App['dialogs'] & { show(kind: string, input: unknown): Promise<unknown> }).show(
        'any',
        null,
    )

    app.destroy()

    expect(app.session).toBeNull()
    expect(log).toEqual(['make Local', 'open Local', 'destroy Local'])
    expect(await answer).toBeUndefined()
    expect(app.secrets.has(server.id)).toBe(false)
    expect(app.setup.currentServerId).toBe(server.id)

    // It no longer follows the other windows.
    elsewhere.addServer({ ...SERVER, name: 'Other' })

    expect(app.setup.servers).toHaveLength(1)
})

test('createGuiApp() starts with no session when no server was current', () => {
    const { options, log } = loggedSessions(new FakeBrowser().open())

    const app = createGuiApp(options)

    expect(app.session).toBeNull()
    expect(log).toEqual([])
})

test('createGuiApp() activates the server that was current in this window', () => {
    const window = new FakeBrowser().open()
    const before = new App({ storage: window, makeSession: fakeSessions(), secrets: ALONE })
    const server = before.setup.addServer(SERVER)
    before.activateServer(server.id)
    before.destroy()
    const { options, log } = loggedSessions(window)

    const app = createGuiApp(options)

    expect(app.session?.serverId).toBe(server.id)
    expect(log).toEqual(['make Local', 'open Local'])
})

test('createGuiApp() in a new window activates the server used last in any window', () => {
    const browser = new FakeBrowser()
    const first = new App({ storage: browser.open(), makeSession: fakeSessions(), secrets: ALONE })
    const server = first.setup.addServer(SERVER)
    first.activateServer(server.id)

    const app = createGuiApp(loggedSessions(browser.open()).options)

    expect(app.session?.serverId).toBe(server.id)
})

test('useApp() gives a component the app that is provided', () => {
    const app = new App({ storage: new FakeBrowser().open(), makeSession: fakeSessions(), secrets: ALONE })
    let found: App | undefined
    const Reader = defineComponent({
        setup() {
            found = useApp()

            return () => h('div')
        },
    })

    mount(Reader, { global: { provide: { [APP_KEY as symbol]: app } } })

    expect(found).toBe(app)
})

test('useApp() says so when no app is provided', () => {
    const Reader = defineComponent({
        setup() {
            useApp()

            return () => h('div')
        },
    })

    expect(() => mount(Reader, { global: { config: { warnHandler: () => {} } } })).toThrow('The app is not provided')
})

// The flows: each opens a dialog, and writes the setup with its answer.

/** Answers the dialog on top, once it is open. */
async function answer(app: App, kind: string, value: unknown): Promise<void> {
    await Promise.resolve()

    const dialog = app.dialogs.open.at(-1)

    expect(dialog?.kind).toBe(kind)

    if (value === undefined) dialog?.cancel()
    else dialog?.answer(value)
}

function flowApp(): { app: App; log: string[] } {
    const { options, log } = loggedSessions(new FakeBrowser().open())

    return { app: new App(options), log }
}

test('the first server added is made the current one, and later ones are not', async () => {
    const { app, log } = flowApp()

    let flow = app.addServer()
    await answer(app, 'server', { server: SERVER, secret: null })
    await flow

    flow = app.addServer()
    await answer(app, 'server', { server: { ...SERVER, name: 'Other' }, secret: null })
    await flow

    expect(app.setup.servers.map(server => server.name)).toEqual(['Local', 'Other'])
    expect(app.setup.currentServerId).toBe(app.setup.servers[0]?.id ?? null)
    expect(log).toEqual(['make Local', 'open Local'])
})

test('a server dialog that is cancelled adds nothing', async () => {
    const { app } = flowApp()
    const flow = app.addServer()

    await answer(app, 'server', undefined)
    await flow

    expect(app.setup.servers).toEqual([])
})

test('a password is held in memory, and in the setup only when it is to be remembered', async () => {
    const { app } = flowApp()

    let flow = app.addServer()
    await answer(app, 'server', { server: { ...SERVER, login: LOGIN }, secret: 'hunter2' })
    await flow

    const id = app.setup.servers[0]?.id as string

    expect(app.secrets.held(id)).toBe('hunter2')
    expect(app.setup.server(id)?.login?.password).toBeUndefined()

    // "Remember" turned on with nothing typed: the password in hand moves to the setup.
    flow = app.editServer(id)
    await Promise.resolve()
    expect(app.dialogs.open[0]?.input).toMatchObject({ hasSecret: true })
    await answer(app, 'server', { server: { ...SERVER, login: { ...LOGIN, remember: true } }, secret: null })
    await flow

    expect(app.setup.server(id)?.login?.password).toBe('hunter2')
    expect(app.secrets.has(id)).toBe(false)

    // And off again: it moves back.
    flow = app.editServer(id)
    await answer(app, 'server', { server: { ...SERVER, login: LOGIN }, secret: null })
    await flow

    expect(app.setup.server(id)?.login?.password).toBeUndefined()
    expect(app.secrets.held(id)).toBe('hunter2')

    // Another kind of login: the password is nothing to it.
    flow = app.editServer(id)
    await answer(app, 'server', { server: { ...SERVER, login: { ...LOGIN, kind: 'token' } }, secret: null })
    await flow

    expect(app.secrets.has(id)).toBe(false)

    // A pasted token is kept as a password is.
    flow = app.editServer(id)
    await answer(app, 'server', {
        server: { ...SERVER, login: { ...LOGIN, kind: 'token', remember: true } },
        secret: 'a.b.c',
    })
    await flow

    expect(app.setup.server(id)?.login?.password).toBe('a.b.c')
    expect(app.secrets.has(id)).toBe(false)
    expect(app.setup.export()).not.toContain('a.b.c')

    // No login at all.
    flow = app.editServer(id)
    await answer(app, 'server', { server: SERVER, secret: null })
    await flow

    expect(app.setup.server(id)?.login).toBeUndefined()
})

test('the session starts again when the current server changes its address or login, and only then', async () => {
    const { app, log } = flowApp()
    const server = app.setup.addServer(SERVER)

    app.activateServer(server.id)
    log.length = 0

    let flow = app.editServer(server.id)
    await answer(app, 'server', { server: { ...SERVER, name: 'Renamed', readOnly: true }, secret: null })
    await flow

    expect(log).toEqual([])

    flow = app.editServer(server.id)
    await answer(app, 'server', { server: { ...SERVER, name: 'Renamed', url: 'http://localhost:3999' }, secret: null })
    await flow

    expect(log).toEqual(['destroy Local', 'make Renamed', 'open Renamed'])
})

test('a server is removed with its services only once the user agrees', async () => {
    const { app, log } = flowApp()
    const server = app.setup.addServer(SERVER)

    app.setup.addService({ serverId: server.id, path: 'messages', load: 'auto', fields: [], pins: [] })
    app.activateServer(server.id)

    let flow = app.removeServer(server.id)
    await Promise.resolve()
    expect((app.dialogs.open[0]?.input as { text: string }).text).toContain('"Local" and its service will')
    await answer(app, 'ask', 'cancel')
    await flow

    expect(app.setup.servers).toHaveLength(1)

    flow = app.removeServer(server.id)
    await answer(app, 'ask', 'remove')
    await flow

    expect(app.setup.servers).toEqual([])
    expect(app.setup.servicesOf(server.id)).toEqual([])
    expect(app.session).toBeNull()
    expect(log.at(-1)).toBe('destroy Local')
})

test('a service is added to the current server, the first made current, and edited and removed', async () => {
    const { app } = flowApp()
    const server = app.setup.addServer(SERVER)

    app.activateServer(server.id)

    let flow = app.addService()
    await answer(app, 'service', { path: 'messages', load: 'auto', idField: undefined })
    await flow

    flow = app.addService()
    await Promise.resolve()
    expect(app.dialogs.open[0]?.input).toEqual({ taken: ['messages'] })
    await answer(app, 'service', { path: 'things', load: 'whole', idField: undefined })
    await flow

    const [messages, things] = app.setup.servicesOf(server.id)

    expect(app.setup.currentServiceId(server.id)).toBe(messages?.id ?? null)
    expect(things).toMatchObject({ path: 'things', load: 'whole', fields: [], pins: [] })

    flow = app.editService(things?.id as string)
    await Promise.resolve()
    expect(app.dialogs.open[0]?.input).toMatchObject({ taken: ['messages'] })
    await answer(app, 'service', { path: 'stuff', load: 'paged', idField: 'uuid' })
    await flow

    expect(app.setup.service(things?.id as string)).toMatchObject({ path: 'stuff', load: 'paged', idField: 'uuid' })

    flow = app.removeService(messages?.id as string)
    await answer(app, 'ask', 'remove')
    await flow

    expect(app.setup.servicesOf(server.id).map(service => service.path)).toEqual(['stuff'])
    expect(app.setup.currentServiceId(server.id)).toBeNull()
})

test('editing a service hands the dialog the ID field the session guessed, if any', async () => {
    const services = { guessed: [{ _id: 'a' }], none: [{ uuid: 'x' }], named: [{ _id: 'a' }], unread: [{ id: 1 }] }
    const app = new App({ storage: new FakeBrowser().open(), makeSession: fakeSessions({ services }), secrets: ALONE })
    const server = app.setup.addServer(SERVER)
    const ids = Object.keys(services).map(
        path =>
            app.setup.addService({
                serverId: server.id,
                path,
                ...(path === 'named' ? { idField: '_id' } : {}),
                load: 'auto',
                fields: [],
                pins: [],
            }).id,
    )

    app.activateServer(server.id)
    for (const id of ids.slice(0, 3)) void app.session?.view(id)?.read()
    for (let i = 0; i < 20; i++) await Promise.resolve()

    const guesses: unknown[] = []

    for (const id of ids) {
        const flow = app.editService(id)

        await Promise.resolve()
        guesses.push(app.dialogs.open[0]?.input)
        await answer(app, 'service', undefined)
        await flow
    }

    expect(guesses.map(input => (input as ServiceDialogInput).guessedIdField)).toEqual([
        '_id',
        null,
        undefined,
        undefined,
    ])
})

test('an import asks how when something is set up, and says so when the file is no setup', async () => {
    const { app } = flowApp()
    const exported = (() => {
        const other = new App({ storage: new FakeBrowser().open(), makeSession: fakeSessions(), secrets: ALONE })

        other.setup.addServer({ ...SERVER, name: 'Imported' })

        return other.setup.export()
    })()

    // Nothing set up: nothing to ask.
    await app.importSetup(exported)
    expect(app.setup.servers.map(server => server.name)).toEqual(['Imported'])

    app.setup.addServer(SERVER)

    let flow = app.importSetup(exported)
    await answer(app, 'ask', 'merge')
    await flow

    expect(app.setup.servers.map(server => server.name)).toEqual(['Imported', 'Local'])

    flow = app.importSetup(exported)
    await answer(app, 'ask', 'replace')
    await flow

    expect(app.setup.servers.map(server => server.name)).toEqual(['Imported'])

    flow = app.importSetup('{"not": "a setup"}')
    await answer(app, 'ask', 'replace')
    await Promise.resolve()
    expect((app.dialogs.open[0]?.input as { text: string }).text).toBe('The file is not an exported setup.')
    await answer(app, 'ask', 'ok')
    await flow

    expect(app.setup.servers.map(server => server.name)).toEqual(['Imported'])
})

// The login: the dialog opens by itself when the session waits for a login.

/** A page that can be hidden and shown again. */
function fakePage(visibilityState: DocumentVisibilityState = 'visible') {
    const page = Object.assign(new EventTarget(), { visibilityState })

    return {
        page: page as unknown as PageVisibility,
        show: () => {
            page.visibilityState = 'visible'
            page.dispatchEvent(new Event('visibilitychange'))
        },
    }
}

/** Lets a session's transitions run. */
async function settled(): Promise<void> {
    for (let i = 0; i < 10; i++) await Promise.resolve()
}

function loginApp(page = fakePage().page): { app: App; server: ServerSetup } {
    const app = new App({
        storage: new FakeBrowser().open(),
        makeSession: fakeSessions({ password: 'secret' }),
        secrets: ALONE,
        page,
    })
    const server = app.setup.addServer({ ...SERVER, login: LOGIN })

    return { app, server }
}

function loginDialog(app: App): (OpenDialog & { input: LoginDialogInput }) | undefined {
    return app.dialogs.open.find(dialog => dialog.kind === 'login') as
        (OpenDialog & { input: LoginDialogInput }) | undefined
}

test('the login dialog opens by itself when the session waits for a login, and logs in with what is typed', async () => {
    const { app, server } = loginApp()

    app.activateServer(server.id)
    await settled()

    const dialog = loginDialog(app)

    expect(app.session?.status.phase).toBe('login-needed')
    expect(dialog?.input.server.id).toBe(server.id)
    expect(dialog?.input.reason).toBeUndefined()

    expect(dialog?.input.logIn({ username: LOGIN.username, password: 'wrong' }, false)).rejects.toThrow('Invalid login')
    await settled()
    expect(loginDialog(app)).toBe(dialog)

    await dialog?.input.logIn({ username: LOGIN.username, password: 'secret' }, false)
    await settled()

    expect(app.session?.status.phase).toBe('ready')
    expect(app.secrets.held(server.id)).toBe('secret')
    expect(app.setup.server(server.id)?.login?.remember).toBe(false)
})

test('a password remembered from the login dialog goes into the setup, and the session stays', async () => {
    const { app, server } = loginApp()

    app.activateServer(server.id)
    await settled()

    const session = app.session

    await loginDialog(app)?.input.logIn({ username: LOGIN.username, password: 'secret' }, true)
    await settled()

    expect(app.session).toBe(session)
    expect(app.session?.status.phase).toBe('ready')
    expect(app.setup.server(server.id)?.login).toMatchObject({ remember: true, password: 'secret' })
    expect(app.secrets.has(server.id)).toBe(false)
})

test('the login dialog, once cancelled, does not open by itself again for the session', async () => {
    const { app, server } = loginApp()

    app.activateServer(server.id)
    await settled()
    loginDialog(app)?.cancel()
    await settled()

    // A refusal brings the session back to waiting: still no dialog
    await expect(app.session?.login({ username: LOGIN.username, password: 'wrong' })).rejects.toThrow()
    await settled()
    expect(loginDialog(app)).toBeUndefined()

    // Asked for, it opens, with the reason of the refusal
    void app.logIn()
    expect(loginDialog(app)?.input.reason).toBe('Invalid login')

    // A new session opens it by itself again
    loginDialog(app)?.cancel()
    app.activateServer(server.id)
    await settled()
    expect(loginDialog(app)).toBeDefined()
})

test('after logOut() the login dialog does not open by itself', async () => {
    const { app, server } = loginApp()

    app.activateServer(server.id)
    await settled()
    await loginDialog(app)?.input.logIn({ username: LOGIN.username, password: 'secret' }, false)
    await settled()

    await app.logOut()
    await settled()

    expect(app.session?.status.phase).toBe('login-needed')
    expect(loginDialog(app)).toBeUndefined()
})

test('the login dialog goes by itself when the session logs in without it, or ends', async () => {
    const { app, server } = loginApp()

    app.activateServer(server.id)
    await settled()
    expect(loginDialog(app)).toBeDefined()

    // A password typed in another window, or remembered meanwhile
    app.secrets.set(server.id, 'secret')
    await settled()
    expect(app.session?.status.phase).toBe('ready')
    expect(loginDialog(app)).toBeUndefined()

    await app.logOut()
    void app.logIn()
    expect(loginDialog(app)).toBeDefined()
    app.deactivate()
    expect(loginDialog(app)).toBeUndefined()
})

test('in a hidden page the login dialog waits until the page is shown', async () => {
    const { page, show } = fakePage('hidden')
    const { app, server } = loginApp(page)

    app.activateServer(server.id)
    await settled()
    expect(app.session?.status.phase).toBe('login-needed')
    expect(loginDialog(app)).toBeUndefined()

    show()
    expect(loginDialog(app)).toBeDefined()
})

test('remembering a password, or changing the one remembered, does not replace the session', async () => {
    const { app, log } = flowApp()
    const server = app.setup.addServer({ ...SERVER, login: LOGIN })

    app.activateServer(server.id)
    log.length = 0

    app.setup.updateServer(server.id, { login: { ...LOGIN, remember: true, password: 'one' } })
    app.setup.updateServer(server.id, { login: { ...LOGIN, remember: true, password: 'two' } })
    app.setup.updateServer(server.id, { login: LOGIN })

    expect(log).toEqual([])
})
