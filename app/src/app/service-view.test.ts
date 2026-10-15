import { expect, test } from 'bun:test'
import { FakeBrowser } from '../../test-support/fake-browser.ts'
import { fakeConnection, type FakeConnection, type FakeConnectionOptions } from '../../test-support/fake-connection.ts'
import { Secrets } from './secrets.ts'
import { Session } from './session.ts'
import { Setup, type ServerSetup, type ServiceSetup } from './setup.ts'

interface Made {
    session: Session
    connection: FakeConnection
    setup: Setup
    server: ServerSetup
    /** Adds a service of the server to the setup. */
    add: (path: string) => ServiceSetup
}

/** A session with a fake connection, and the services of `paths` set up for its server. */
function makeSession(options: FakeConnectionOptions = {}, paths: string[] = []): Made {
    const setup = new Setup(new FakeBrowser().open())
    const server = setup.addServer({ name: 'Local', url: 'http://localhost:3041', readOnly: false })
    const add = (path: string): ServiceSetup =>
        setup.addService({ serverId: server.id, path, load: 'auto', fields: [], pins: [] })

    for (const path of paths) add(path)

    const connection = fakeConnection(options)
    const session = new Session(server, {
        setup,
        secrets: new Secrets({ channel: null }),
        makeConnection: () => connection,
    })

    return { session, connection, setup, server, add }
}

/** Lets the session's transitions, the watchers and the reads run. */
async function settled(): Promise<void> {
    for (let i = 0; i < 10; i++) await Promise.resolve()
}

/** Shows every view, as the service area does the one it shows: each reads from then on. */
function showAll(session: Session): void {
    for (const view of session.views) void view.read()
}

function idsOf(made: Made, path: string): string[] | undefined {
    const service = made.setup.servicesOf(made.server.id).find(each => each.path === path)

    return made.session.view(service!.id)?.records?.map(record => record.id)
}

test('a session has a view of each service set up, in the setup order, waiting until it is ready', () => {
    const { session, setup, server } = makeSession({}, ['messages', 'things'])

    expect(session.views.map(view => view.path)).toEqual(['messages', 'things'])
    expect(session.views.map(view => view.serviceId)).toEqual(setup.servicesOf(server.id).map(service => service.id))
    expect(session.views[0]?.status).toEqual({ phase: 'waiting' })
    expect(session.views[0]?.records).toBeNull()
})

test('only a view that has been shown reads its first page when the session is ready', async () => {
    const made = makeSession({ services: { messages: [{ id: 1 }], things: [{ _id: 'a' }] } }, ['messages', 'things'])

    void made.session.views[0]!.read()
    await made.session.open()
    await settled()

    expect(made.session.views.map(view => view.status.phase)).toEqual(['ready', 'waiting'])
    expect(idsOf(made, 'messages')).toEqual(['1'])
    expect(idsOf(made, 'things')).toBeUndefined()
})

test('the first page has each record as the server has it, under its ID as a string', async () => {
    const made = makeSession({ services: { things: [{ _id: 'a', id: 'its own' }] } }, ['things'])

    showAll(made.session)
    await made.session.open()
    await settled()

    expect(made.session.views[0]?.records).toEqual([{ id: 'a', raw: { _id: 'a', id: 'its own' } }])
})

test('the first page is at most 25 records, of a service with pages or without', async () => {
    const records = Array.from({ length: 40 }, (_, id) => ({ id }))
    const made = makeSession(
        { services: { whole: records, paged: { total: 40, limit: 30, skip: 0, data: records.slice(0, 30) } } },
        ['whole', 'paged'],
    )

    showAll(made.session)
    await made.session.open()
    await settled()

    expect(idsOf(made, 'whole')).toEqual(Array.from({ length: 25 }, (_, id) => String(id)))
    expect(idsOf(made, 'paged')).toHaveLength(25)
})

test('a service the server does not have, or that does not answer with records, fails with the reason', async () => {
    const { session } = makeSession({ services: { odd: { status: 'ok' } } }, ['nothing', 'odd'])

    showAll(session)
    await session.open()
    await settled()

    expect(session.views[0]?.status).toEqual({ phase: 'failed', error: { message: 'Service not found: nothing' } })
    expect(session.views[1]?.status).toEqual({
        phase: 'failed',
        error: { message: 'The service "odd" did not answer with records' },
    })
})

test('a service added gets a view, which reads once shown, and one removed loses it', async () => {
    const made = makeSession({ services: { messages: [{ id: 1 }], things: [{ _id: 'a' }] } }, ['messages'])

    await made.session.open()
    await settled()

    const messages = made.session.views[0]!
    const things = made.add('things')

    await settled()
    expect(made.session.views.map(view => view.path)).toEqual(['messages', 'things'])
    expect(made.session.views[0]).toBe(messages)
    expect(made.session.views[1]?.status).toEqual({ phase: 'waiting' })

    await made.session.views[1]!.read()
    expect(idsOf(made, 'things')).toEqual(['a'])

    made.setup.removeService(messages.serviceId)
    await settled()
    expect(made.session.views.map(view => view.serviceId)).toEqual([things.id])
    expect(messages.records).toBeNull()
})

test('a service whose path, ID field or way of loading changes gets a new view; its fields and pins do not', async () => {
    const made = makeSession({ services: { messages: [{ id: 1 }], notes: [{ id: 2 }] } }, ['messages'])
    const service = made.setup.servicesOf(made.server.id)[0]!

    await made.session.open()
    await settled()

    const first = made.session.views[0]!

    made.setup.updateService(service.id, { pins: ['1'] })
    await settled()
    expect(made.session.views[0]).toBe(first)

    made.setup.updateService(service.id, { path: 'notes' })
    await settled()

    const second = made.session.views[0]!

    expect(second).not.toBe(first)
    expect(second.path).toBe('notes')

    await second.read()
    expect(idsOf(made, 'notes')).toEqual(['2'])

    made.setup.updateService(service.id, { idField: 'id' })
    await settled()
    expect(made.session.views[0]).not.toBe(second)

    const third = made.session.views[0]!

    made.setup.updateService(service.id, { load: 'whole' })
    await settled()
    expect(made.session.views[0]).not.toBe(third)
})

test('a lost connection keeps the records, as stale, and the view reads again once ready', async () => {
    const services: Record<string, unknown> = { messages: [{ id: 1 }] }
    const made = makeSession({ manual: true, services }, ['messages'])

    showAll(made.session)
    void made.session.open()
    await settled()
    made.connection.accept()
    await settled()

    made.connection.drop()
    await settled()
    expect(made.session.views[0]?.status).toEqual({ phase: 'stale' })
    expect(idsOf(made, 'messages')).toEqual(['1'])

    services.messages = [{ id: 1 }, { id: 2 }]
    made.connection.accept()
    await settled()
    expect(made.session.views[0]?.status).toEqual({ phase: 'ready' })
    expect(idsOf(made, 'messages')).toEqual(['1', '2'])
})

test('read() before the session is ready reads once it is, and again later keeps the records until the answer', async () => {
    const services: Record<string, unknown> = { messages: [{ id: 1 }] }
    const made = makeSession({ services }, ['messages'])
    const view = made.session.views[0]!

    await view.read()
    expect(view.status).toEqual({ phase: 'waiting' })

    await made.session.open()
    await settled()
    expect(idsOf(made, 'messages')).toEqual(['1'])

    services.messages = [{ id: 2 }]

    const reading = view.read()

    expect(view.status).toEqual({ phase: 'loading' })
    expect(idsOf(made, 'messages')).toEqual(['1'])

    await reading
    expect(idsOf(made, 'messages')).toEqual(['2'])
})

test('a view drops its records when the session needs a login', async () => {
    const setup = new Setup(new FakeBrowser().open())
    const server = setup.addServer({
        name: 'Local',
        url: 'http://localhost:3041',
        readOnly: false,
        login: {
            kind: 'local',
            path: 'authentication',
            usernameField: 'email',
            passwordField: 'password',
            username: 'ada@example.com',
            remember: true,
            password: 'secret',
        },
    })

    setup.addService({ serverId: server.id, path: 'notes', load: 'auto', fields: [], pins: [] })

    const connection = fakeConnection({ password: 'secret', services: { notes: [{ id: 1 }] } })
    const session = new Session(server, {
        setup,
        secrets: new Secrets({ channel: null }),
        makeConnection: () => connection,
    })

    showAll(session)
    await session.open()
    await settled()
    expect(session.views[0]?.records).toHaveLength(1)

    await session.logout()
    await settled()
    expect(session.views[0]?.status).toEqual({ phase: 'waiting' })
    expect(session.views[0]?.records).toBeNull()
})

test('destroying the session ends its views', async () => {
    const { session } = makeSession({ services: { messages: [{ id: 1 }] } }, ['messages'])

    showAll(session)
    await session.open()
    await settled()

    const view = session.views[0]!

    session.destroy()
    expect(session.views).toEqual([])
    expect(view.records).toBeNull()

    await view.read()
    expect(view.status).toEqual({ phase: 'waiting' })
})
