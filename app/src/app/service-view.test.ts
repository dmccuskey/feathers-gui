import { expect, spyOn, test } from 'bun:test'
import { computed } from 'vue'
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

test('an empty service guesses its ID field again from the first record by event that does not fit', async () => {
    const services: Record<string, unknown> = { guessed: [], named: [] }
    const made = makeSession({ services }, ['guessed', 'named'])
    const named = made.setup.servicesOf(made.server.id).find(each => each.path === 'named')!

    made.setup.updateService(named.id, { idField: 'id' })
    await settled()
    showAll(made.session)
    await made.session.open()
    await settled()
    await settled()

    const [guessed, set] = made.session.views

    expect([guessed?.idField, set?.idField]).toEqual(['id', 'id'])

    services.guessed = [{ _id: 'a' }]
    services.named = [{ _id: 'a' }]
    // The record of `named` is left out, and the record source logs it
    const logged = spyOn(console, 'error').mockImplementation(() => {})

    made.connection.emit('guessed', 'created', { _id: 'a' })
    made.connection.emit('named', 'created', { _id: 'a' })
    await settled()
    await settled()
    logged.mockRestore()

    expect(guessed?.idField).toBe('_id')
    expect(guessed?.isWhole).toBe(true)
    expect(idsOf(made, 'guessed')).toEqual(['a'])
    expect(set?.idField).toBe('id')
    expect(idsOf(made, 'named')).toEqual([])
})

test('a guess made on records, or one that fits the first record by event, stays', async () => {
    const services: Record<string, unknown> = { filled: [{ id: 1 }], empty: [] }
    const made = makeSession({ services }, ['filled', 'empty'])
    const logged = spyOn(console, 'error').mockImplementation(() => {})

    showAll(made.session)
    await made.session.open()
    await settled()
    await settled()

    services.filled = [{ id: 1 }, { _id: 'b' }]
    services.empty = [{ id: 2 }]
    made.connection.emit('filled', 'created', { _id: 'b' })
    made.connection.emit('empty', 'created', { id: 2 })
    await settled()
    // The record that does not fit is left out, and the record source logs it
    const logs = logged.mock.calls.length

    logged.mockRestore()
    expect(logs).toBe(1)

    expect(made.session.views.map(view => view.idField)).toEqual(['id', 'id'])
    expect(idsOf(made, 'filled')).toEqual(['1'])
    expect(idsOf(made, 'empty')).toEqual(['2'])
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

test('a view selects a record by its ID, and holds it from what it read', async () => {
    const made = makeSession({ services: { messages: [{ id: 1, text: 'A' }, { id: 2 }] } }, ['messages'])
    const view = made.session.views[0]!
    const text = computed(() => view.selected?.raw.text)

    expect([view.selectedId, view.selected]).toEqual([null, undefined])
    view.select('1')
    expect(view.selected).toBeUndefined()

    showAll(made.session)
    await made.session.open()
    await settled()

    expect(view.selectedId).toBe('1')
    expect(view.selected).toBe(view.record('1'))
    expect(text.value).toBe('A')

    view.select('2')
    expect(text.value).toBeUndefined()
    expect(view.selected?.id).toBe('2')
    view.select(null)
    expect([view.selectedId, view.selected]).toEqual([null, undefined])
})

test('the selection follows its record by the events, and keeps its ID while the record is gone', async () => {
    const made = makeSession({ services: { messages: [{ id: 1, text: 'A' }] } }, ['messages'])
    const view = made.session.views[0]!
    const text = computed(() => view.selected?.raw.text)

    showAll(made.session)
    await made.session.open()
    await settled()
    view.select('1')

    made.connection.emit('messages', 'patched', { id: 1, text: 'B' })
    await settled()
    expect(text.value).toBe('B')

    made.connection.emit('messages', 'removed', { id: 1, text: 'B' })
    await settled()
    expect([view.selectedId, view.selected]).toEqual(['1', undefined])

    made.connection.emit('messages', 'created', { id: 1, text: 'C' })
    await settled()
    expect(text.value).toBe('C')
})

test('a change by event is counted, and marked unseen while the view is not shown, until it is', async () => {
    const made = makeSession({ services: { messages: [{ id: 1 }], things: [{ id: 1 }] } }, ['messages', 'things'])
    const [messages, things] = made.session.views as [ServiceView, ServiceView]

    showAll(made.session)
    await made.session.open()
    await settled()
    messages.shown(true)
    expect([messages.changeCount, things.changeCount]).toEqual([0, 0])

    made.connection.emit('messages', 'created', { id: 2 })
    made.connection.emit('things', 'patched', { id: 1, text: 'B' })
    made.connection.emit('things', 'created', { id: 2 })
    await settled()
    expect([messages.changeCount, things.changeCount]).toEqual([1, 2])
    expect([messages.hasUnseenChanges, things.hasUnseenChanges]).toEqual([false, true])

    messages.shown(false)
    things.shown(true)
    expect([messages.hasUnseenChanges, things.hasUnseenChanges]).toEqual([false, false])

    made.connection.emit('messages', 'removed', { id: 2 })
    await settled()
    expect(messages.hasUnseenChanges).toBe(true)

    // Dropped with the records
    made.session.destroy()
    expect(messages.hasUnseenChanges).toBe(false)
})

test('the rows are by last changed to begin with: the changes newest first, then the rest in ID order', async () => {
    const made = makeSession({ services: { messages: [{ id: 10 }, { id: 2 }, { id: 1 }] } }, ['messages'])
    const view = made.session.views[0]!
    const rows = () => view.rows?.map(record => record.id)

    showAll(made.session)
    await made.session.open()
    await settled()
    expect(view.sort).toEqual({ by: 'last-changed' })
    expect(rows()).toEqual(['1', '2', '10'])

    made.connection.emit('messages', 'patched', { id: 2, text: 'B' })
    made.connection.emit('messages', 'created', { id: 5 })
    await settled()
    expect(rows()).toEqual(['5', '2', '1', '10'])

    made.connection.emit('messages', 'patched', { id: 10, text: 'C' })
    await settled()
    expect(rows()).toEqual(['10', '5', '2', '1'])
})

test('a sort by a field orders the rows by its type, and is kept in the setup, which the next view starts from', async () => {
    const made = makeSession({ services: { messages: [{ id: 1, n: 10 }, { id: 2, n: 9 }, { id: 3 }] } }, ['messages'])
    const view = made.session.views[0]!

    showAll(made.session)
    await made.session.open()
    await settled()
    view.setSort({ by: 'field', field: 'n', descending: false })
    expect(view.rows?.map(record => record.id)).toEqual(['2', '1', '3'])
    // The same view: a sort is not a change of the service's view
    expect(made.session.views[0]).toBe(view)

    const [service] = made.setup.servicesOf(made.server.id)
    expect(service?.sort).toEqual({ by: 'field', field: 'n', descending: false })

    made.session.destroy()
    const again = makeSession({}, [])
    again.setup.addService({ ...service!, serverId: again.server.id })
    await settled()
    expect(again.session.views[0]?.sort).toEqual({ by: 'field', field: 'n', descending: false })
})

test('a sort by a field takes the type the setup gives it, or else guesses it', async () => {
    // The first is the earlier time, but not the earlier string
    const times = [
        { id: 1, at: '2026-10-20T10:00:00+02:00' },
        { id: 2, at: '2026-10-20T09:00:00Z' },
    ]
    const made = makeSession({ services: { messages: times } }, ['messages'])
    const service = made.setup.servicesOf(made.server.id)[0]!
    const view = made.session.views[0]!

    showAll(made.session)
    await made.session.open()
    await settled()
    view.setSort({ by: 'field', field: 'at', descending: false })
    expect(view.rows?.map(record => record.id)).toEqual(['1', '2'])

    made.setup.updateService(service.id, { fields: [{ name: 'at', show: true, type: 'string', typePicked: true }] })
    expect(view.rows?.map(record => record.id)).toEqual(['2', '1'])
})

test('a search shows only the records that have its words, follows the events, and is kept in the setup', async () => {
    const made = makeSession(
        {
            services: {
                messages: [
                    { id: 1, text: 'Ann Johnson' },
                    { id: 2, text: 'Bob Johnson' },
                    { id: 3, text: 'Ann Lee' },
                ],
            },
        },
        ['messages'],
    )
    const view = made.session.views[0]!
    const rows = () => view.rows?.map(record => record.id)

    showAll(made.session)
    await made.session.open()
    await settled()
    expect(view.isSearching).toBe(false)

    view.setSearch('ann')
    expect(view.isSearching).toBe(true)
    expect(rows()).toEqual(['1', '3'])
    expect(view.records).toHaveLength(3)

    made.connection.emit('messages', 'patched', { id: 2, text: 'Bob Annesley' })
    made.connection.emit('messages', 'patched', { id: 3, text: 'Cy Lee' })
    await settled()
    expect(rows()).toEqual(['2', '1'])

    view.setSearch('  ')
    expect(view.isSearching).toBe(false)
    expect(rows()).toHaveLength(3)

    view.setSearch('johnson')
    expect(made.session.views[0]).toBe(view)
    const [service] = made.setup.servicesOf(made.server.id)
    expect(service?.search).toBe('johnson')

    made.session.destroy()
    const again = makeSession({ services: { messages: [{ id: 1, text: 'Ann Johnson' }, { id: 2 }] } }, [])
    again.setup.addService({ ...service!, serverId: again.server.id })
    await settled()
    const next = again.session.views[0]!
    showAll(again.session)
    await again.session.open()
    await settled()
    expect(next.search).toBe('johnson')
    expect(next.rows?.map(record => record.id)).toEqual(['1'])
})

test('a search finds a value as its field type shows it', async () => {
    process.env.TZ = 'UTC'
    try {
        const made = makeSession(
            {
                services: {
                    messages: [
                        { id: 1, at: 0 },
                        { id: 2, at: 86_400_000 },
                    ],
                },
            },
            ['messages'],
        )
        const service = made.setup.servicesOf(made.server.id)[0]!
        const view = made.session.views[0]!

        showAll(made.session)
        await made.session.open()
        await settled()
        // Milliseconds are guessed to be a number
        view.setSearch('1970-01-02')
        expect(view.rows).toEqual([])

        made.setup.updateService(service.id, { fields: [{ name: 'at', show: true, type: 'date', typePicked: true }] })
        expect(view.rows?.map(record => record.id)).toEqual(['2'])
    } finally {
        delete process.env.TZ
    }
})

test('a search finds only what the table shows: a hidden field is not searched', async () => {
    const made = makeSession({ services: { messages: [{ id: 1, text: 'Ann', note: 'secret' }] } }, ['messages'])
    const service = made.setup.servicesOf(made.server.id)[0]!
    const view = made.session.views[0]!

    showAll(made.session)
    await made.session.open()
    await settled()
    view.setSearch('secret')
    expect(view.rows?.map(record => record.id)).toEqual(['1'])

    made.setup.updateService(service.id, { fields: [{ name: 'note', show: false, type: 'string', typePicked: false }] })
    expect(view.rows).toEqual([])
})

test('a first page is not searched: the search waits for the view to be loaded whole', async () => {
    const made = makeSession(
        {
            services: {
                messages: [
                    { id: 1, text: 'Ann' },
                    { id: 2, text: 'Bob' },
                ],
            },
        },
        ['messages'],
    )

    made.setup.updateService(made.setup.servicesOf(made.server.id)[0]!.id, { load: 'paged', search: 'ann' })
    await settled()

    const view = made.session.views[0]!

    showAll(made.session)
    await made.session.open()
    await settled()
    expect(view.search).toBe('ann')
    expect(view.isSearching).toBe(false)
    expect(view.rows?.map(record => record.id)).toEqual(['1', '2'])
})

test('a view not loaded whole counts no changes', async () => {
    const made = makeSession({ services: { messages: [{ id: 1 }] } }, ['messages'])

    made.setup.updateService(made.setup.servicesOf(made.server.id)[0]!.id, { load: 'paged' })
    await settled()

    const view = made.session.views[0]!

    showAll(made.session)
    await made.session.open()
    await settled()
    made.connection.emit('messages', 'created', { id: 2 })
    await settled()
    expect([view.changeCount, view.hasUnseenChanges]).toEqual([0, false])
})

test('the selection is kept while the records are stale', async () => {
    const made = makeSession({ manual: true, services: { messages: [{ id: 1 }] } }, ['messages'])
    const view = made.session.views[0]!

    showAll(made.session)
    void made.session.open()
    await settled()
    made.connection.accept()
    await settled()
    view.select('1')

    made.connection.drop()
    await settled()
    expect(view.status.phase).toBe('stale')
    expect(view.selected?.id).toBe('1')
})

test('the selection is dropped when the ID field is guessed again', async () => {
    const services: Record<string, unknown> = { empty: [] }
    const made = makeSession({ services }, ['empty'])
    const view = made.session.views[0]!

    showAll(made.session)
    await made.session.open()
    await settled()
    view.select('1')

    services.empty = [{ _id: 'a' }]
    made.connection.emit('empty', 'created', { _id: 'a' })
    await settled()
    await settled()
    expect(view.idField).toBe('_id')
    expect(view.selectedId).toBeNull()
})

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

test('writeRefusal says why a write would be refused, as it changes', async () => {
    const made = makeSession({ services: { messages: [{ id: 1 }], things: [{ name: 'no id' }] } }, [
        'messages',
        'things',
    ])
    const [messages, things] = made.session.views as [ServiceView, ServiceView]
    const refusal = computed(() => messages.writeRefusal)

    expect(refusal.value).toBe('not-ready')

    showAll(made.session)
    await made.session.open()
    await settled()

    expect(refusal.value).toBeUndefined()
    expect(things.writeRefusal).toBe('not-ready')

    made.setup.updateServer(made.server.id, { readOnly: true })
    expect(refusal.value).toBe('read-only')
    made.setup.updateServer(made.server.id, { readOnly: false })
    expect(refusal.value).toBeUndefined()

    made.session.destroy()
    expect(refusal.value).toBe('not-ready')
})

test('a first page is read again after a write, as no event changes it', async () => {
    const services: Record<string, unknown> = { messages: [{ id: 1 }] }
    const made = makeSession({ services, onWrite: write => ({ id: 2, ...write.data }) }, ['messages'])

    made.setup.updateService(made.setup.servicesOf(made.server.id)[0]!.id, { load: 'paged' })
    await settled()
    showAll(made.session)
    await made.session.open()
    await settled()

    const view = made.session.views[0]!

    services.messages = [{ id: 1 }, { id: 2 }]
    await view.create({})
    await settled()

    expect(idsOf(made, 'messages')).toEqual(['1', '2'])
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
