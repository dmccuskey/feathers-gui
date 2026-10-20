import { expect, test } from 'bun:test'
import { FakeBrowser } from '../../test-support/fake-browser.ts'
import { fakeConnection, type FakeConnection, type FakeConnectionOptions } from '../../test-support/fake-connection.ts'
import { Secrets } from './secrets.ts'
import { WriteError, type ServiceView } from './service-view.ts'
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
    const made = makeSession({ services: { things: [{ _id: 'a', name: 'A' }] } }, ['things'])

    showAll(made.session)
    await made.session.open()
    await settled()

    expect(made.session.views[0]?.records).toEqual([{ id: 'a', raw: { _id: 'a', name: 'A' } }])
    expect(made.session.views[0]?.idField).toBe('_id')
    expect(made.session.views[0]?.idFieldGuessed).toBe(true)
})

test('the ID field guessed is id before _id, and the one the setup names is taken as it is', async () => {
    const made = makeSession(
        { services: { guessed: [{ _id: 'a', id: 'its own' }], named: [{ _id: 'a', id: 'its own' }] } },
        ['guessed', 'named'],
    )
    const named = made.setup.servicesOf(made.server.id).find(each => each.path === 'named')!

    made.setup.updateService(named.id, { idField: '_id' })
    await settled()
    showAll(made.session)
    await made.session.open()
    await settled()

    expect(made.session.views.map(view => view.idFieldGuessed)).toEqual([true, false])
    expect(made.session.views.map(view => view.records?.[0]?.id)).toEqual(['its own', 'a'])
})

test('a service with neither id nor _id on every record fails, for the user to name the ID field', async () => {
    const { session } = makeSession({ services: { things: [{ uuid: 'x1' }, { uuid: 'x2' }] } }, ['things'])

    showAll(session)
    await session.open()
    await settled()

    expect(session.views[0]?.status.phase).toBe('failed')
    expect(session.views[0]?.status.error?.reason).toBe('no-id-field')
})

test('the total, where the server gives it', async () => {
    const records = Array.from({ length: 10 }, (_, id) => ({ id }))
    const made = makeSession({ services: { paged: { total: 3000, limit: 10, skip: 0, data: records } } }, ['paged'])

    showAll(made.session)
    await made.session.open()
    await settled()

    expect(made.session.views[0]?.total).toBe(3000)
})

test('a service with a count of at most 1000 is loaded whole, and is not read again when shown again', async () => {
    const services: Record<string, unknown> = { messages: Array.from({ length: 40 }, (_, id) => ({ id })) }
    const made = makeSession({ services }, ['messages'])
    const view = made.session.views[0]!

    showAll(made.session)
    await made.session.open()
    await settled()

    expect(view.isWhole).toBe(true)
    expect(view.total).toBe(40)
    expect(idsOf(made, 'messages')).toHaveLength(40)

    services.messages = [{ id: 'other' }]
    await view.read()
    expect(idsOf(made, 'messages')).toHaveLength(40)
})

test('a service set to be paged, or over 1000, or with no count, shows the first 25 records', async () => {
    const records = Array.from({ length: 1001 }, (_, id) => ({ id }))
    const made = makeSession(
        {
            services: {
                small: records.slice(0, 40),
                large: records,
                paged: { total: 1001, limit: 30, skip: 0, data: records.slice(0, 30) },
            },
        },
        ['small', 'large', 'paged'],
    )
    const small = made.setup.servicesOf(made.server.id)[0]!

    made.setup.updateService(small.id, { load: 'paged' })
    await settled()
    showAll(made.session)
    await made.session.open()
    await settled()

    expect(made.session.views.map(view => view.isWhole)).toEqual([false, false, false])
    expect(idsOf(made, 'small')).toEqual(Array.from({ length: 25 }, (_, id) => String(id)))
    expect(idsOf(made, 'large')).toHaveLength(25)
    expect(idsOf(made, 'paged')).toHaveLength(25)
})

test('a service the server does not have, or that does not answer with records, fails', async () => {
    const { session } = makeSession({ services: { odd: { status: 'ok' } } }, ['nothing', 'odd'])

    showAll(session)
    await session.open()
    await settled()

    expect(session.views[0]?.status).toEqual({ phase: 'failed', error: { message: 'Service not found: nothing' } })
    // findPage() takes an answer that is not a page or an array for one record
    expect(session.views[1]?.status.error?.reason).toBe('no-id-field')
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

test('a lost connection keeps the records, as stale, and a view loaded whole syncs once ready', async () => {
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

    made.setup.updateService(made.setup.servicesOf(made.server.id)[0]!.id, { load: 'paged' })
    await settled()

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

/** A ready session whose `messages` view has read, and whose server answers each write with `answer`. */
async function writable(answer: FakeConnectionOptions['onWrite'] = write => ({ id: write.id ?? 9, ...write.data })) {
    const made = makeSession({ services: { messages: [{ id: 1, text: 'one' }] }, onWrite: answer }, ['messages'])
    const view = made.session.views[0]!

    showAll(made.session)
    await made.session.open()
    await settled()

    return { ...made, view }
}

test('a write is sent to the server as the raw record, and resolves with its answer as an envelope', async () => {
    const { view, connection } = await writable()

    expect(await view.create({ text: 'new' })).toEqual({ id: '9', raw: { id: 9, text: 'new' } })
    expect(await view.patch('1', { text: 'changed' })).toEqual({ id: '1', raw: { id: '1', text: 'changed' } })
    expect(await view.update('1', { id: 1, text: 'whole' })).toEqual({ id: '1', raw: { id: 1, text: 'whole' } })
    expect(await view.remove('1')).toEqual({ id: '1', raw: { id: '1' } })
    expect(connection.writes).toEqual([
        { path: 'messages', method: 'create', data: { text: 'new' } },
        { path: 'messages', method: 'patch', id: '1', data: { text: 'changed' } },
        { path: 'messages', method: 'update', id: '1', data: { id: 1, text: 'whole' } },
        { path: 'messages', method: 'remove', id: '1' },
    ])
})

test('a write changes nothing the view holds: only the event after it does', async () => {
    const { view } = await writable()

    await view.patch('1', { text: 'changed' })
    await view.create({ text: 'new' })

    expect(view.records).toEqual([{ id: '1', raw: { id: 1, text: 'one' } }])
})

test('a server set read-only refuses every write before any call, as soon as it is set', async () => {
    const { view, connection, setup, server } = await writable()

    setup.updateServer(server.id, { readOnly: true })

    for (const write of [
        () => view.create({}),
        () => view.patch('1', {}),
        () => view.update('1', {}),
        () => view.remove('1'),
    ]) {
        await expect(write()).rejects.toMatchObject({ name: 'WriteError', reason: 'read-only' })
    }
    expect(connection.writes).toEqual([])
})

test('a write is refused while the session is not ready, or before the ID field is known', async () => {
    const made = makeSession({ services: { messages: [{ id: 1 }], things: [{ name: 'no id' }] } }, [
        'messages',
        'things',
    ])
    const [messages, things] = made.session.views as [ServiceView, ServiceView]

    await expect(messages.create({})).rejects.toMatchObject({ reason: 'not-ready' })

    showAll(made.session)
    await made.session.open()
    await settled()

    expect(things.status.phase).toBe('failed')
    await expect(things.create({})).rejects.toMatchObject({ reason: 'not-ready' })
    expect(made.connection.writes).toEqual([])
})

test("the server's refusal is handed on with its name, code, data and errors", async () => {
    const ajv = [{ instancePath: '/text', keyword: 'type', message: 'must be string', params: {} }]
    const refusal = (data: unknown, errors?: unknown) =>
        Object.assign(new Error('validation failed'), {
            name: 'BadRequest',
            code: 400,
            className: 'bad-request',
            data,
            errors,
        })
    let answer: Error = refusal(ajv)
    const { view } = await writable(() => {
        throw answer
    })

    const first = await view.patch('1', { text: 2 }).catch((error: unknown) => error)

    expect(first).toBeInstanceOf(WriteError)
    expect(first).toMatchObject({
        name: 'BadRequest',
        reason: 'server',
        message: 'validation failed',
        code: 400,
        className: 'bad-request',
        data: ajv,
        errors: ajv,
    })

    answer = refusal({ field: 'x' }, { text: 'is wrong' })
    await expect(view.create({})).rejects.toMatchObject({ data: { field: 'x' }, errors: { text: 'is wrong' } })
})
