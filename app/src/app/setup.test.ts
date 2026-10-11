import { describe, expect, test } from 'bun:test'
import { watch } from 'vue'
import { FakeBrowser } from '../../test-support/fake-browser.ts'
import {
    CURRENT_KEY,
    LAST_SERVER_KEY,
    SETUP_KEY,
    SETUP_VERSION,
    Setup,
    SetupBlockedError,
    SetupImportError,
    type LoginSetup,
    type ServerSetup,
    type ServiceSetup,
} from './setup.ts'

const SERVER: Omit<ServerSetup, 'id'> = { name: 'Local', url: 'http://localhost:3041', readOnly: false }

const LOGIN: LoginSetup = {
    kind: 'local',
    path: 'authentication',
    usernameField: 'email',
    passwordField: 'password',
    username: 'dev@example.com',
    remember: false,
}

function serviceOf(serverId: string, path = 'messages'): Omit<ServiceSetup, 'id'> {
    return { serverId, path, load: 'auto', fields: [], pins: [] }
}

function stored(browser: FakeBrowser): { version: number; servers: ServerSetup[]; services: ServiceSetup[] } {
    return JSON.parse(browser.local.getItem(SETUP_KEY) ?? 'null')
}

describe('the records', () => {
    test('a new setup is empty, and stores nothing until something is set up', () => {
        const browser = new FakeBrowser()
        const setup = new Setup(browser.open())

        expect(setup.status).toBe('ok')
        expect(setup.servers).toEqual([])
        expect(setup.currentServerId).toBeNull()
        expect(browser.local.getItem(SETUP_KEY)).toBeNull()
    })

    test('a server added is given an ID, and is stored with the version', () => {
        const browser = new FakeBrowser()
        const setup = new Setup(browser.open())

        const server = setup.addServer(SERVER)

        expect(server).toEqual({ ...SERVER, id: expect.any(String) })
        expect(setup.servers).toEqual([server])
        expect(setup.server(server.id)).toBe(setup.servers[0])
        expect(stored(browser)).toEqual({ version: SETUP_VERSION, servers: [server], services: [] })
    })

    test('the setup is read again by a later window', () => {
        const browser = new FakeBrowser()
        const first = new Setup(browser.open())
        const server = first.addServer(SERVER)
        const service = first.addService(serviceOf(server.id))

        const later = new Setup(browser.open())

        expect(later.servers).toEqual([server])
        expect(later.servicesOf(server.id)).toEqual([service])
    })

    test('an update replaces the record, and leaves the others the objects they were', () => {
        const setup = new Setup(new FakeBrowser().open())
        const one = setup.addServer(SERVER)
        const two = setup.addServer({ ...SERVER, name: 'Other' })
        const before = [setup.server(one.id), setup.server(two.id)]

        setup.updateServer(one.id, { url: 'http://localhost:3042' })

        expect(setup.server(one.id)).toEqual({ ...one, url: 'http://localhost:3042' })
        expect(setup.server(one.id)).not.toBe(before[0])
        expect(setup.server(two.id)).toBe(before[1])
    })

    test('what reads a server is told of its change, and not of another server’s', () => {
        const setup = new Setup(new FakeBrowser().open())
        const one = setup.addServer(SERVER)
        const two = setup.addServer({ ...SERVER, name: 'Other' })
        const told: (string | undefined)[] = []
        watch(
            () => setup.server(one.id),
            server => told.push(server?.name),
            { flush: 'sync' },
        )

        setup.updateServer(two.id, { name: 'Another' })
        expect(told).toEqual([])

        setup.updateServer(one.id, { name: 'Renamed' })
        expect(told).toEqual(['Renamed'])
    })

    test('a password is stored only where it is to be remembered', () => {
        const browser = new FakeBrowser()
        const setup = new Setup(browser.open())

        const server = setup.addServer({ ...SERVER, login: { ...LOGIN, password: 'secret' } })

        expect(server.login).toEqual(LOGIN)
        expect(browser.local.getItem(SETUP_KEY)).not.toContain('secret')

        setup.updateServer(server.id, { login: { ...LOGIN, remember: true, password: 'secret' } })
        expect(stored(browser).servers[0]?.login?.password).toBe('secret')

        setup.updateServer(server.id, { login: { ...LOGIN, password: 'secret' } })
        expect(browser.local.getItem(SETUP_KEY)).not.toContain('secret')
    })

    test('a service belongs to its server, in the order added', () => {
        const setup = new Setup(new FakeBrowser().open())
        const one = setup.addServer(SERVER)
        const two = setup.addServer({ ...SERVER, name: 'Other' })
        const messages = setup.addService(serviceOf(one.id, 'messages'))
        const things = setup.addService(serviceOf(two.id, 'things'))
        const tasks = setup.addService(serviceOf(one.id, 'tasks'))

        expect(setup.servicesOf(one.id)).toEqual([messages, tasks])
        expect(setup.servicesOf(two.id)).toEqual([things])
        expect(setup.service(things.id)).toEqual(things)
    })

    test('a service is updated and removed', () => {
        const setup = new Setup(new FakeBrowser().open())
        const server = setup.addServer(SERVER)
        const service = setup.addService(serviceOf(server.id))

        setup.updateService(service.id, { idField: '_id', pins: ['7'] })
        expect(setup.service(service.id)).toEqual({ ...service, idField: '_id', pins: ['7'] })

        setup.removeService(service.id)
        expect(setup.servicesOf(server.id)).toEqual([])
    })

    test('removing a server removes its services, and no others', () => {
        const browser = new FakeBrowser()
        const setup = new Setup(browser.open())
        const one = setup.addServer(SERVER)
        const two = setup.addServer({ ...SERVER, name: 'Other' })
        setup.addService(serviceOf(one.id))
        const kept = setup.addService(serviceOf(two.id))

        setup.removeServer(one.id)

        expect(setup.servers).toEqual([two])
        expect(stored(browser).services).toEqual([kept])
    })

    test('a record that is not there cannot be updated, nor a service added to a server that is not', () => {
        const browser = new FakeBrowser()
        const setup = new Setup(browser.open())

        expect(() => setup.updateServer('gone', { name: 'x' })).toThrow('No server')
        expect(() => setup.updateService('gone', { path: 'x' })).toThrow('No service')
        expect(() => setup.addService(serviceOf('gone'))).toThrow('No server')
        expect(browser.local.getItem(SETUP_KEY)).toBeNull()
    })
})

describe('what is current', () => {
    test('the current server survives a reload of the window', () => {
        const browser = new FakeBrowser()
        const window = browser.open()
        const setup = new Setup(window)
        const server = setup.addServer(SERVER)

        setup.currentServerId = server.id

        expect(new Setup(window).currentServerId).toBe(server.id)
    })

    test('it is not shared: each window has its own', () => {
        const browser = new FakeBrowser()
        const first = new Setup(browser.open())
        const one = first.addServer(SERVER)
        const two = first.addServer({ ...SERVER, name: 'Other' })
        const second = new Setup(browser.open())

        first.currentServerId = one.id
        second.currentServerId = two.id

        expect(first.currentServerId).toBe(one.id)
        expect(second.currentServerId).toBe(two.id)
    })

    test('a new window starts on the server used last in any window', () => {
        const browser = new FakeBrowser()
        const first = new Setup(browser.open())
        const one = first.addServer(SERVER)
        const two = first.addServer({ ...SERVER, name: 'Other' })
        const second = new Setup(browser.open())
        first.currentServerId = one.id
        second.currentServerId = two.id

        const opened = browser.open()

        expect(new Setup(opened).currentServerId).toBe(two.id)

        // And stays there when reloaded, whatever the others go on to.
        first.currentServerId = one.id
        expect(new Setup(opened).currentServerId).toBe(two.id)
    })

    test('setting no server keeps the server used last for a new window', () => {
        const browser = new FakeBrowser()
        const setup = new Setup(browser.open())
        const server = setup.addServer(SERVER)

        setup.currentServerId = server.id
        setup.currentServerId = null

        expect(setup.currentServerId).toBeNull()
        expect(browser.local.getItem(LAST_SERVER_KEY)).toBe(server.id)
    })

    test('the current service is kept per server', () => {
        const browser = new FakeBrowser()
        const window = browser.open()
        const setup = new Setup(window)
        const one = setup.addServer(SERVER)
        const two = setup.addServer({ ...SERVER, name: 'Other' })
        const messages = setup.addService(serviceOf(one.id, 'messages'))
        const things = setup.addService(serviceOf(two.id, 'things'))

        setup.setCurrentService(one.id, messages.id)
        setup.setCurrentService(two.id, things.id)

        const reloaded = new Setup(window)
        expect(reloaded.currentServiceId(one.id)).toBe(messages.id)
        expect(reloaded.currentServiceId(two.id)).toBe(things.id)

        reloaded.setCurrentService(one.id, null)
        expect(reloaded.currentServiceId(one.id)).toBeNull()
        expect(reloaded.currentServiceId(two.id)).toBe(things.id)
    })

    test('only what is set up can be made current', () => {
        const setup = new Setup(new FakeBrowser().open())
        const one = setup.addServer(SERVER)
        const two = setup.addServer({ ...SERVER, name: 'Other' })
        const things = setup.addService(serviceOf(two.id, 'things'))

        expect(() => (setup.currentServerId = 'gone')).toThrow('No server')
        expect(() => setup.setCurrentService(one.id, things.id)).toThrow('No service')
    })

    test('what is removed is no longer current', () => {
        const browser = new FakeBrowser()
        const window = browser.open()
        const setup = new Setup(window)
        const server = setup.addServer(SERVER)
        const messages = setup.addService(serviceOf(server.id, 'messages'))
        const tasks = setup.addService(serviceOf(server.id, 'tasks'))
        setup.currentServerId = server.id
        setup.setCurrentService(server.id, messages.id)

        setup.removeService(messages.id)
        expect(setup.currentServiceId(server.id)).toBeNull()

        setup.setCurrentService(server.id, tasks.id)
        setup.removeServer(server.id)
        expect(setup.currentServerId).toBeNull()
        expect(setup.currentServiceId(server.id)).toBeNull()
        expect(JSON.parse(window.session.getItem(CURRENT_KEY) ?? '')).toEqual({ serverId: null, serviceIds: {} })
    })

    test('a new window does not start on a server that has been removed', () => {
        const browser = new FakeBrowser()
        const setup = new Setup(browser.open())
        const server = setup.addServer(SERVER)
        setup.currentServerId = server.id
        setup.removeServer(server.id)

        expect(new Setup(browser.open()).currentServerId).toBeNull()
    })
})

describe('two windows', () => {
    test('a window follows what another sets up', () => {
        const browser = new FakeBrowser()
        const first = new Setup(browser.open())
        const second = new Setup(browser.open())

        const server = first.addServer(SERVER)
        const service = first.addService(serviceOf(server.id))
        expect(second.servers).toEqual([server])
        expect(second.servicesOf(server.id)).toEqual([service])

        second.updateService(service.id, { pins: ['7'] })
        expect(first.service(service.id)?.pins).toEqual(['7'])

        second.removeServer(server.id)
        expect(first.servers).toEqual([])
    })

    test('a record another window did not change stays the object it was', () => {
        const browser = new FakeBrowser()
        const first = new Setup(browser.open())
        const second = new Setup(browser.open())
        const one = first.addServer(SERVER)
        const two = first.addServer({ ...SERVER, name: 'Other' })
        const before = second.server(two.id)

        first.updateServer(one.id, { name: 'Renamed' })

        expect(second.server(one.id)?.name).toBe('Renamed')
        expect(second.server(two.id)).toBe(before)
    })

    test('a write keeps what another window wrote, even unseen', () => {
        const browser = new FakeBrowser()
        const first = new Setup(browser.open())
        const second = new Setup(browser.open())
        const one = first.addServer(SERVER)

        // The second window misses the news of the first one's next write.
        second.destroy()
        const two = first.addServer({ ...SERVER, name: 'Other' })
        expect(second.servers).toEqual([one])

        const three = second.addServer({ ...SERVER, name: 'Third' })

        expect(stored(browser).servers).toEqual([one, two, three])
        expect(second.servers).toEqual([one, two, three])
        expect(first.servers).toEqual([one, two, three])
    })

    test('a server removed in another window is no longer current here', () => {
        const browser = new FakeBrowser()
        const first = new Setup(browser.open())
        const second = new Setup(browser.open())
        const server = first.addServer(SERVER)
        second.currentServerId = server.id

        first.removeServer(server.id)

        expect(second.currentServerId).toBeNull()
    })

    test('a window that is destroyed follows no longer', () => {
        const browser = new FakeBrowser()
        const first = new Setup(browser.open())
        const second = new Setup(browser.open())

        second.destroy()
        first.addServer(SERVER)

        expect(second.servers).toEqual([])
    })
})

describe('the version', () => {
    test('a newer format is not written over, and the window says so', () => {
        const browser = new FakeBrowser()
        const setup = new Setup(browser.open())
        const server = setup.addServer(SERVER)
        const newer = JSON.stringify({ version: SETUP_VERSION + 1, hosts: [] })

        // A newer window converted the setup.
        browser.open().local.setItem(SETUP_KEY, newer)

        expect(setup.status).toBe('newer')
        expect(setup.servers).toEqual([server])
        expect(() => setup.addServer(SERVER)).toThrow(SetupBlockedError)
        expect(() => setup.removeServer(server.id)).toThrow(SetupBlockedError)
        expect(browser.local.getItem(SETUP_KEY)).toBe(newer)
    })

    test('a newer format met at the start is left alone too', () => {
        const browser = new FakeBrowser()
        const newer = JSON.stringify({ version: SETUP_VERSION + 1 })
        browser.local.setItem(SETUP_KEY, newer)

        const setup = new Setup(browser.open())

        expect(setup.status).toBe('newer')
        expect(setup.servers).toEqual([])
        expect(() => setup.addServer(SERVER)).toThrow('Reload the page')
        expect(browser.local.getItem(SETUP_KEY)).toBe(newer)
    })

    test('a write finds the newer format even when the window was not told', () => {
        const browser = new FakeBrowser()
        const setup = new Setup(browser.open())
        browser.local.setItem(SETUP_KEY, JSON.stringify({ version: SETUP_VERSION + 1 }))

        expect(setup.status).toBe('ok')
        expect(() => setup.addServer(SERVER)).toThrow(SetupBlockedError)
        expect(setup.status).toBe('newer')
    })

    test.each(['not JSON', '[]', '{"servers":[]}', `{"version":${SETUP_VERSION},"servers":{}}`])(
        'what is not a setup is not written over: %s',
        text => {
            const browser = new FakeBrowser()
            browser.local.setItem(SETUP_KEY, text)

            const setup = new Setup(browser.open())

            expect(setup.status).toBe('unreadable')
            expect(() => setup.addServer(SERVER)).toThrow(SetupBlockedError)
            expect(browser.local.getItem(SETUP_KEY)).toBe(text)
        },
    )

    test('the window carries on once the stored setup is one it knows again', () => {
        const browser = new FakeBrowser()
        const other = browser.open()
        const setup = new Setup(browser.open())
        other.local.setItem(SETUP_KEY, 'not JSON')
        expect(setup.status).toBe('unreadable')

        other.local.removeItem(SETUP_KEY)

        expect(setup.status).toBe('ok')
        expect(setup.addServer(SERVER).name).toBe('Local')
    })
})

describe('export and import', () => {
    function exported(): { browser: FakeBrowser; setup: Setup; server: ServerSetup; service: ServiceSetup } {
        const browser = new FakeBrowser()
        const setup = new Setup(browser.open())
        const server = setup.addServer({ ...SERVER, login: { ...LOGIN, remember: true, password: 'secret' } })
        const service = setup.addService(serviceOf(server.id))

        return { browser, setup, server, service }
    }

    test('an export has the servers and services, and no passwords', () => {
        const { setup, server, service } = exported()

        const json = setup.export()

        expect(json).not.toContain('secret')
        expect(JSON.parse(json)).toEqual({
            version: SETUP_VERSION,
            servers: [{ ...server, login: { ...LOGIN, remember: true } }],
            services: [service],
        })
    })

    test('an export is taken in by another browser', () => {
        const { setup, server, service } = exported()
        const other = new Setup(new FakeBrowser().open())

        other.import(setup.export(), 'merge')

        expect(other.servers).toEqual([{ ...server, login: { ...LOGIN, remember: true } }])
        expect(other.servicesOf(server.id)).toEqual([service])
    })

    test('a merge replaces what has a known ID, adds the rest, and removes nothing', () => {
        const { setup, server, service } = exported()
        const json = setup.export()
        const other = setup.addServer({ ...SERVER, name: 'Other' })
        const things = setup.addService(serviceOf(other.id, 'things'))
        const tasks = setup.addService(serviceOf(server.id, 'tasks'))
        setup.updateServer(server.id, { name: 'Renamed' })
        setup.removeService(service.id)

        setup.import(json, 'merge')

        expect(setup.servers.map(each => each.name)).toEqual(['Local', 'Other'])
        expect(setup.servicesOf(server.id)).toEqual([tasks, service])
        expect(setup.servicesOf(other.id)).toEqual([things])
    })

    test('a replace leaves only what was imported', () => {
        const { browser, setup, server, service } = exported()
        const json = setup.export()
        const other = setup.addServer({ ...SERVER, name: 'Other' })
        setup.addService(serviceOf(other.id, 'things'))
        setup.addService(serviceOf(server.id, 'tasks'))
        setup.currentServerId = other.id

        setup.import(json, 'replace')

        expect(setup.servers.map(each => each.id)).toEqual([server.id])
        expect(stored(browser).services).toEqual([service])
        expect(setup.currentServerId).toBeNull()
    })

    test.each(['merge', 'replace'] as const)('a server that stays keeps its remembered password: %s', how => {
        const { browser, setup } = exported()

        setup.import(setup.export(), how)

        expect(stored(browser).servers[0]?.login?.password).toBe('secret')
    })

    test('a service of a server that is not there is not taken in', () => {
        const { setup, server, service } = exported()
        const file = JSON.parse(setup.export())
        file.services.push({ ...service, id: 'stray', serverId: 'gone' })

        setup.import(JSON.stringify(file), 'replace')

        expect(setup.servicesOf(server.id)).toEqual([service])
        expect(setup.service('stray')).toBeUndefined()
    })

    test('another window follows an import', () => {
        const { browser, setup, server } = exported()
        const json = setup.export()
        const second = new Setup(browser.open())
        setup.removeServer(server.id)

        setup.import(json, 'merge')

        expect(second.servers.map(each => each.id)).toEqual([server.id])
    })

    test.each([
        ['not JSON', 'not an exported setup'],
        ['{"servers":[]}', 'not an exported setup'],
        [`{"version":${SETUP_VERSION},"servers":[{"name":"no ID"}],"services":[]}`, 'not an exported setup'],
        [`{"version":${SETUP_VERSION + 1}}`, 'newer version'],
    ])('a file that is not a setup changes nothing: %s', (text, message) => {
        const { browser, setup } = exported()
        const before = browser.local.getItem(SETUP_KEY)

        expect(() => setup.import(text, 'replace')).toThrow(SetupImportError)
        expect(() => setup.import(text, 'replace')).toThrow(message)
        expect(browser.local.getItem(SETUP_KEY)).toBe(before)
    })
})
