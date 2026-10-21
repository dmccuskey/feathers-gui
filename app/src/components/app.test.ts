import { expect, test } from 'bun:test'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { FakeBrowser, FakeStorage } from '../../test-support/fake-browser.ts'
import {
    fakeConnection,
    fakeSessions,
    type FakeConnection,
    type FakeConnectionOptions,
} from '../../test-support/fake-connection.ts'
import { APP_KEY, App as GuiApp } from '../app/app.ts'
import { Session } from '../app/session.ts'
import type { ServerSetup, ServiceSetup } from '../app/setup.ts'
import { THEMING_KEY, Theming } from '../widgets/index.ts'
import App from './App.vue'

/**
 * `connection`: the options of each session's fake connection, or the one connection every session uses. `before`:
 * what is done with the app before it is shown, as at a reload.
 */
function mountApp(connection: FakeConnectionOptions | FakeConnection = {}, before?: (app: GuiApp) => void) {
    const app = new GuiApp({
        storage: new FakeBrowser().open(),
        makeSession:
            'connect' in connection
                ? (server, parts) => new Session(server, { ...parts, makeConnection: () => connection })
                : fakeSessions(connection),
        secrets: { channel: null },
    })
    const theming = new Theming({
        root: document.createElement('div'),
        dark: Object.assign(new EventTarget(), { matches: false }),
        storage: new FakeStorage(),
    })
    before?.(app)

    const wrapper = mount(App, {
        global: { provide: { [APP_KEY as symbol]: app, [THEMING_KEY as symbol]: theming } },
    })

    return { app, theming, wrapper }
}

/** The cells of each row in the records table, as text. */
function rowsOf(wrapper: ReturnType<typeof mountApp>['wrapper']): string[][] {
    return wrapper
        .findAll('.service-area-records .ui-table-shown [role="row"]')
        .map(row => row.findAll('[role="gridcell"]').map(cell => cell.text()))
}

function addServer(app: GuiApp, name: string): ServerSetup {
    return app.setup.addServer({ name, url: `http://${name}.test`, readOnly: false })
}

function addService(app: GuiApp, server: ServerSetup, path: string, load: ServiceSetup['load'] = 'auto'): ServiceSetup {
    return app.setup.addService({ serverId: server.id, path, load, fields: [], pins: [] })
}

test('the app renders its name', () => {
    expect(mountApp().wrapper.find('h1').text()).toBe('feathers-gui')
})

test('with nothing set up, the area says so and the side bar has no services', () => {
    const { wrapper } = mountApp()

    expect(wrapper.find('.service-area-empty').text()).toContain('No servers are set up.')
    expect(wrapper.find('.side-bar select').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.side-bar-services').exists()).toBe(false)
})

test('the select lists the servers by name and address, and choosing one activates it', async () => {
    const { app, wrapper } = mountApp()
    const local = addServer(app, 'local')

    app.setup.addServer({ name: '', url: 'http://other.test', readOnly: false })
    await nextTick()

    const select = wrapper.find('.side-bar select')

    expect(select.findAll('option').map(option => option.text())).toEqual([
        'Choose a server',
        'local (http://local.test)',
        'http://other.test',
    ])
    expect(wrapper.find('.service-area-empty').text()).toContain('No server is chosen.')

    await select.setValue(local.id)

    expect(app.session?.serverId).toBe(local.id)
    expect(app.setup.currentServerId).toBe(local.id)
    expect(select.findAll('option')).toHaveLength(2)
    expect(wrapper.find('.service-area-empty').text()).toContain('No services are set up')
})

test('the services of the current server are listed by path, and choosing one shows it', async () => {
    const { app, wrapper } = mountApp()
    const local = addServer(app, 'local')
    const other = addServer(app, 'other')

    addService(app, local, 'things')
    addService(app, local, 'messages')
    addService(app, other, 'notes')
    app.activateServer(local.id)
    await nextTick()

    const paths = wrapper.findAll('.side-bar-path')

    expect(paths.map(path => path.text())).toEqual(['messages', 'things'])
    expect(wrapper.find('.service-area-empty').text()).toContain('No service is chosen.')

    await paths[1]?.trigger('click')

    expect(app.setup.currentServiceId(local.id)).toBe(app.setup.servicesOf(local.id)[0]?.id ?? null)
    expect(wrapper.find('.side-bar-current .side-bar-path').text()).toBe('things')
    expect(wrapper.find('.service-area-path').text()).toBe('things')
})

test('the records of the current service are in the table, a column per field', async () => {
    const { app, wrapper } = mountApp({ services: { things: [{ _id: 'a', name: 'first' }] } })
    const server = addServer(app, 'local')

    app.activateServer(server.id)
    app.setup.setCurrentService(server.id, addService(app, server, 'things').id)
    await flushPromises()

    expect(wrapper.findAll('.service-area-records [role="columnheader"]').map(cell => cell.text())).toEqual([
        '_id',
        'name',
    ])
    expect(rowsOf(wrapper)).toEqual([['a', 'first']])
})

test('the service current at the start is read', async () => {
    const { wrapper } = mountApp({ services: { things: [{ _id: 'a' }] } }, app => {
        const server = addServer(app, 'local')

        app.activateServer(server.id)
        app.setup.setCurrentService(server.id, addService(app, server, 'things').id)
    })

    await flushPromises()
    expect(rowsOf(wrapper)).toEqual([['a']])
})

test('a service chosen again is read again, when it is not loaded whole', async () => {
    const services: Record<string, unknown> = { things: [{ _id: 'a' }], messages: [{ id: 1 }] }
    const { app, wrapper } = mountApp({ services })
    const server = addServer(app, 'local')
    const things = addService(app, server, 'things', 'paged')
    const messages = addService(app, server, 'messages')

    app.activateServer(server.id)
    app.setup.setCurrentService(server.id, things.id)
    await flushPromises()
    expect(rowsOf(wrapper)).toEqual([['a']])

    services.things = [{ _id: 'b' }]
    app.setup.setCurrentService(server.id, messages.id)
    await flushPromises()
    app.setup.setCurrentService(server.id, things.id)
    await flushPromises()
    expect(rowsOf(wrapper)).toEqual([['b']])
})

test('the records are under a line of how many, and whether they are live', async () => {
    const services: Record<string, unknown> = { things: [{ _id: 'a' }, { _id: 'b' }], messages: [{ id: 1 }] }
    const { app, wrapper } = mountApp({ services })
    const server = addServer(app, 'local')
    const things = addService(app, server, 'things', 'paged')
    const messages = addService(app, server, 'messages')

    app.activateServer(server.id)
    app.setup.setCurrentService(server.id, things.id)
    await flushPromises()
    expect(wrapper.find('.service-area-line').text()).toBe('2 records · read when shown')

    app.setup.setCurrentService(server.id, messages.id)
    await flushPromises()
    expect(wrapper.find('.service-area-line').text()).toBe('1 record · live')
    expect(wrapper.find('.service-area-line .service-dot-live').exists()).toBe(true)
})

test("a service's dot marks it live, and a change not seen yet until it is chosen, pulsing at each change", async () => {
    const connection = fakeConnection({ services: { things: [{ _id: 'a' }], messages: [{ id: 1 }] } })
    const { app, wrapper } = mountApp(connection)
    const server = addServer(app, 'local')
    const messages = addService(app, server, 'messages')
    const things = addService(app, server, 'things')
    const dotOf = (path: string) =>
        wrapper
            .findAll('.side-bar-path')
            .find(row => row.text() === path)!
            .find('.service-dot')

    app.activateServer(server.id)
    app.setup.setCurrentService(server.id, messages.id)
    await flushPromises()
    app.setup.setCurrentService(server.id, things.id)
    await flushPromises()
    expect(dotOf('messages').classes()).toEqual(['service-dot', 'service-dot-live'])
    expect(dotOf('messages').attributes('aria-label')).toBe('Live')

    connection.emit('messages', 'patched', { id: 1, text: 'B' })
    await flushPromises()
    expect(dotOf('messages').classes()).toContain('service-dot-unseen')
    expect(dotOf('messages').classes()).toContain('service-dot-pulse')
    expect(dotOf('messages').attributes('aria-label')).toBe('Live, changed since last shown')

    // The shown service pulses, and is not marked
    connection.emit('things', 'created', { _id: 'b' })
    await flushPromises()
    expect(dotOf('things').classes()).toContain('service-dot-pulse')
    expect(dotOf('things').classes()).not.toContain('service-dot-unseen')

    app.setup.setCurrentService(server.id, messages.id)
    await flushPromises()
    expect(dotOf('messages').classes()).not.toContain('service-dot-unseen')
})

test('a service the server refuses shows the reason', async () => {
    const { app, wrapper } = mountApp()
    const server = addServer(app, 'local')

    app.activateServer(server.id)
    app.setup.setCurrentService(server.id, addService(app, server, 'nothing').id)
    await flushPromises()

    expect(wrapper.find('.service-area-notice').text()).toBe('Service not found: nothing')
    expect(wrapper.find('.service-area-records').exists()).toBe(false)
})

test('a server that cannot be reached shows the reason', async () => {
    const { app, wrapper } = mountApp({ error: new Error('Could not connect') })
    const server = addServer(app, 'local')

    app.activateServer(server.id)
    app.setup.setCurrentService(server.id, addService(app, server, 'things').id)
    await flushPromises()

    expect(wrapper.find('.service-area-notice').text()).toBe('Could not connect')
})

test('a connection lost keeps the records, dimmed, and "Try Now" tries again at once', async () => {
    const connection = fakeConnection({ manual: true, services: { things: [{ _id: 'a', name: 'first' }] } })
    const { app, wrapper } = mountApp(connection)
    const server = addServer(app, 'local')

    app.activateServer(server.id)
    app.setup.setCurrentService(server.id, addService(app, server, 'things').id)
    await flushPromises()
    connection.accept()
    await flushPromises()

    connection.drop()
    connection.failAttempt(new Error('ECONNREFUSED'))
    await flushPromises()
    expect(wrapper.find('.service-area-notice').exists()).toBe(false)
    expect(wrapper.find('.service-area-records').classes()).toContain('service-area-stale')
    expect(wrapper.find('.session-status-detail').text()).toBe('ECONNREFUSED')

    const tryNow = wrapper.findAll('.session-status button').find(button => button.text() === 'Try Now')

    await tryNow!.trigger('click')
    await flushPromises()
    expect(connection.connects).toBe(2)
    expect(wrapper.find('.session-status-line').text()).toBe('Connecting…')

    connection.accept()
    await flushPromises()
    expect(wrapper.find('.service-area-records').classes()).not.toContain('service-area-stale')
    expect(wrapper.find('.session-status-line').text()).toBe('Connected')
})

test('a setup that cannot be used is said', async () => {
    const browser = new FakeBrowser()
    const app = new GuiApp({ storage: browser.open(), makeSession: fakeSessions() })

    browser.local.setItem('feathers-gui.setup', 'not a setup')

    expect(() => addServer(app, 'local')).toThrow()

    const wrapper = mount(App, {
        global: {
            provide: { [APP_KEY as symbol]: app, [THEMING_KEY as symbol]: mountApp().theming },
        },
    })

    expect(wrapper.find('.service-area-notice').text()).toContain('cannot be read')
})

test('"Info" opens the dialog that says what the app is', async () => {
    const { app, wrapper } = mountApp()
    const info = wrapper.findAll('.app-header button').find(button => button.text() === 'Info')

    await info?.trigger('click')

    expect(app.dialogs.open.map(dialog => dialog.kind)).toEqual(['info'])
    expect(wrapper.find('dialog').text()).toContain('Feathersjs server')
})

test('a server with a login asks for the password, says why it was refused, and shows as whom it is connected', async () => {
    const { app, wrapper } = mountApp({ password: 'secret', services: { things: [] } })
    const server = app.setup.addServer({
        name: 'local',
        url: 'http://local.test',
        readOnly: false,
        login: {
            kind: 'local',
            path: 'authentication',
            usernameField: 'email',
            passwordField: 'password',
            username: 'ada@example.com',
            remember: false,
        },
    })

    app.activateServer(server.id)
    app.setup.setCurrentService(server.id, addService(app, server, 'things').id)
    await flushPromises()

    expect(wrapper.find('.session-status').text()).toContain('Not logged in.')
    expect(wrapper.find('.service-area-empty').text()).toContain('Log in to read this server')

    const dialog = wrapper.find('dialog')
    const [username, password] = dialog.findAll('input')

    expect(username?.element.value).toBe('ada@example.com')
    expect(username?.attributes('autocomplete')).toBe('username')
    expect(password?.attributes('autocomplete')).toBe('current-password')

    await password?.setValue('wrong')
    await dialog.find('form').trigger('submit')
    await Bun.sleep(20)

    expect(wrapper.find('dialog').text()).toContain('Invalid login')
    expect(wrapper.find('dialog input[type="password"]').element).toHaveProperty('value', '')

    await wrapper.find('dialog input[type="password"]').setValue('secret')
    await wrapper.find('dialog form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('dialog').exists()).toBe(false)
    expect(wrapper.find('.session-status').text()).toContain('Connected as ada@example.com')
    expect(wrapper.find('.service-area-status').text()).toBe('No records.')
})

test('New and Remove are over the records, Remove once one is selected, and neither on a read-only server', async () => {
    const { app, wrapper } = mountApp({ services: { messages: [{ id: 1 }] } })
    const server = addServer(app, 'local')
    const service = addService(app, server, 'messages')
    const button = (label: string) => wrapper.findAll('.service-area-tool').find(each => each.text() === label)!
    const disabled = () => ['New', 'Remove'].map(label => button(label).attributes('disabled') !== undefined)

    app.activateServer(server.id)
    app.setup.setCurrentService(server.id, service.id)
    await flushPromises()

    expect(disabled()).toEqual([false, true])
    expect(button('Remove').attributes('title')).toBe('Select a record to remove')

    app.session?.view(service.id)?.select('1')
    await nextTick()
    expect(disabled()).toEqual([false, false])

    await button('New').trigger('click')
    expect(app.dialogs.open.map(dialog => dialog.kind)).toEqual(['record'])
    app.dialogs.cancelAll()

    await button('Remove').trigger('click')
    await flushPromises()
    expect(app.dialogs.open.map(dialog => dialog.kind)).toEqual(['ask'])
    app.dialogs.cancelAll()

    app.setup.updateServer(server.id, { readOnly: true })
    await nextTick()
    expect(disabled()).toEqual([true, true])
    expect(button('New').attributes('title')).toBe('The server is set read-only')
})
