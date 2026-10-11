import { expect, test } from 'bun:test'
import { mount } from '@vue/test-utils'
import { defineComponent, h, watch } from 'vue'
import { FakeBrowser, type FakeWindow } from '../../test-support/fake-browser.ts'
import { APP_KEY, App, createGuiApp, useApp, type AppOptions } from './app.ts'
import type { Session } from './session.ts'
import { Setup, type ServerSetup } from './setup.ts'

const SERVER: Omit<ServerSetup, 'id'> = { name: 'Local', url: 'http://localhost:3041', readOnly: false }

/** Records the sessions the app makes, and what it does with each. */
function fakeSessions(window: FakeWindow): { options: AppOptions; log: string[] } {
    const log: string[] = []

    return {
        log,
        options: {
            storage: window,
            makeSession: (server): Session => {
                log.push(`make ${server.name}`)

                return {
                    serverId: server.id,
                    open: async () => void log.push(`open ${server.name}`),
                    destroy: () => void log.push(`destroy ${server.name}`),
                }
            },
        },
    }
}

test('a new app has its parts, and no session', () => {
    const app = new App({ storage: new FakeBrowser().open() })

    expect(app.setup.servers).toEqual([])
    expect(app.dialogs.open).toEqual([])
    expect(app.secrets.has('any')).toBe(false)
    expect(app.session).toBeNull()
})

test('activating a server makes its session, opens it, and makes the server current', () => {
    const { options, log } = fakeSessions(new FakeBrowser().open())
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
        makeSession: (server, given) => {
            parts.push(given)

            return { serverId: server.id, open: async () => {}, destroy: () => {} }
        },
    })

    app.activateServer(app.setup.addServer(SERVER).id)

    expect(parts).toEqual([{ setup: app.setup, secrets: app.secrets }])
})

test('activating another server ends the session there is first', () => {
    const { options, log } = fakeSessions(new FakeBrowser().open())
    const app = new App(options)
    const local = app.setup.addServer(SERVER)
    const other = app.setup.addServer({ ...SERVER, name: 'Other' })
    app.activateServer(local.id)

    app.activateServer(other.id)

    expect(app.session?.serverId).toBe(other.id)
    expect(log).toEqual(['make Local', 'open Local', 'destroy Local', 'make Other', 'open Other'])
})

test('a server that is not set up is not activated, and the session there is stays', () => {
    const { options, log } = fakeSessions(new FakeBrowser().open())
    const app = new App(options)
    const server = app.setup.addServer(SERVER)
    app.activateServer(server.id)

    expect(() => app.activateServer('unknown')).toThrow('No server with the ID "unknown"')
    expect(app.session?.serverId).toBe(server.id)
    expect(log).toEqual(['make Local', 'open Local'])
})

test('deactivate() ends the session, and no server is current', () => {
    const { options, log } = fakeSessions(new FakeBrowser().open())
    const app = new App(options)
    app.activateServer(app.setup.addServer(SERVER).id)

    app.deactivate()

    expect(app.session).toBeNull()
    expect(app.setup.currentServerId).toBeNull()
    expect(log).toEqual(['make Local', 'open Local', 'destroy Local'])
})

test('what reads the session is told when it changes', () => {
    const { options } = fakeSessions(new FakeBrowser().open())
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
    const { options } = fakeSessions(new FakeBrowser().open())
    const app = new App(options)
    const local = app.setup.addServer(SERVER)
    const other = app.setup.addServer({ ...SERVER, name: 'Other' })
    app.activateServer(local.id)
    app.secrets.set(local.id, 'typed')

    app.activateServer(other.id)
    app.activateServer(local.id)

    expect(app.secrets.get(local.id)).toBe('typed')
})

test('the secret of a server goes when the server is removed, in this window or another', () => {
    const browser = new FakeBrowser()
    const app = new App({ storage: browser.open() })
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

test('destroy() ends the session, the dialogs and the secrets, and keeps what is current', async () => {
    const browser = new FakeBrowser()
    const { options, log } = fakeSessions(browser.open())
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
    const { options, log } = fakeSessions(new FakeBrowser().open())

    const app = createGuiApp(options)

    expect(app.session).toBeNull()
    expect(log).toEqual([])
})

test('createGuiApp() activates the server that was current in this window', () => {
    const window = new FakeBrowser().open()
    const before = new App({ storage: window })
    const server = before.setup.addServer(SERVER)
    before.activateServer(server.id)
    before.destroy()
    const { options, log } = fakeSessions(window)

    const app = createGuiApp(options)

    expect(app.session?.serverId).toBe(server.id)
    expect(log).toEqual(['make Local', 'open Local'])
})

test('createGuiApp() in a new window activates the server used last in any window', () => {
    const browser = new FakeBrowser()
    const first = new App({ storage: browser.open() })
    const server = first.setup.addServer(SERVER)
    first.activateServer(server.id)

    const app = createGuiApp(fakeSessions(browser.open()).options)

    expect(app.session?.serverId).toBe(server.id)
})

test('useApp() gives a component the app that is provided', () => {
    const app = new App({ storage: new FakeBrowser().open() })
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
