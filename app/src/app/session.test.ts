import { expect, test } from 'bun:test'
import { FakeBrowser } from '../../test-support/fake-browser.ts'
import { fakeConnection, type FakeConnection, type FakeConnectionOptions } from '../../test-support/fake-connection.ts'
import { Secrets } from './secrets.ts'
import { Session } from './session.ts'
import { Setup } from './setup.ts'

function makeSession(options: FakeConnectionOptions = {}): { session: Session; connection: FakeConnection } {
    const setup = new Setup(new FakeBrowser().open())
    const server = setup.addServer({ name: 'Local', url: 'http://localhost:3041', readOnly: false })
    const connection = fakeConnection(options)

    return {
        session: new Session(server, { setup, secrets: new Secrets(), makeConnection: () => connection }),
        connection,
    }
}

/** Lets the session's transitions run. */
async function settled(): Promise<void> {
    for (let i = 0; i < 10; i++) await Promise.resolve()
}

test('a session is closed until it is opened, and ready once connected', async () => {
    const { session } = makeSession()

    expect(session.status).toEqual({ phase: 'closed', attempts: 0 })

    await session.open()

    expect(session.status).toEqual({ phase: 'ready', attempts: 0 })
})

test('a session keeps connecting while the server is not there, with the count and the last reason', async () => {
    const { session, connection } = makeSession({ manual: true })
    let isOpen = false

    void session.open().then(() => (isOpen = true))
    await settled()
    expect(session.status).toEqual({ phase: 'connecting', attempts: 0 })

    connection.failAttempt(new Error('ECONNREFUSED'))
    connection.failAttempt(new Error('timeout'))
    await settled()
    expect(session.status).toEqual({ phase: 'connecting', error: { message: 'timeout' }, attempts: 2 })
    expect(isOpen).toBe(false)

    connection.accept()
    await settled()
    expect(session.status).toEqual({ phase: 'ready', attempts: 0 })
    expect(isOpen).toBe(true)
})

test('a server that refuses the connection closes the session, with the reason', async () => {
    const { session } = makeSession({ error: new Error('Could not connect to http://localhost:3041') })

    await session.open()

    expect(session.status).toEqual({
        phase: 'closed',
        error: { message: 'Could not connect to http://localhost:3041' },
        attempts: 0,
    })
})

test('a session closed by a refusal can be opened again', async () => {
    const { session, connection } = makeSession({ manual: true })
    const opened = session.open()

    await settled()
    connection.refuse(new Error('Forbidden'))
    await opened
    expect(session.status.phase).toBe('closed')

    const again = session.open()

    await settled()
    connection.accept()
    await again
    expect(session.status).toEqual({ phase: 'ready', attempts: 0 })
})

test('a lost connection makes the session lost, counting the attempts, until it comes back', async () => {
    const { session, connection } = makeSession({ manual: true })
    const opened = session.open()

    await settled()
    connection.accept()
    await opened

    connection.drop()
    await settled()
    expect(session.status).toEqual({ phase: 'lost', attempts: 0 })

    connection.failAttempt(new Error('ECONNREFUSED'))
    await settled()
    expect(session.status).toEqual({ phase: 'lost', error: { message: 'ECONNREFUSED' }, attempts: 1 })

    connection.accept()
    await settled()
    expect(session.status).toEqual({ phase: 'ready', attempts: 0 })
})

test('a connection lost during a transition is acted on when the transition ends', async () => {
    const { session, connection } = makeSession({ manual: true })
    const opened = session.open()

    await settled()
    // Connected and lost at once: the session is still entering `ready` when the drop is heard
    connection.accept()
    connection.drop()
    await opened
    await settled()

    expect(session.status.phase).toBe('lost')

    connection.accept()
    await settled()
    expect(session.status.phase).toBe('ready')
})

test('a session destroyed while it connects stays closed, and stops the connection', async () => {
    const { session, connection } = makeSession({ manual: true })
    const opened = session.open()

    await settled()
    session.destroy()
    await opened

    expect(session.status).toEqual({ phase: 'closed', attempts: 0 })
    expect(connection.disconnects).toBe(1)

    connection.accept()
    await settled()
    expect(session.status.phase).toBe('closed')
})

test('a session destroyed before its transition runs ends closed', async () => {
    const { session, connection } = makeSession()
    const opened = session.open()

    session.destroy()
    await opened

    expect(session.status).toEqual({ phase: 'closed', attempts: 0 })
    expect(connection.disconnects).toBe(1)
})

test('the first page has each record as the server has it, under its ID as a string', async () => {
    const { session } = makeSession({
        services: {
            messages: [{ id: 1, text: 'one' }],
            things: [{ _id: 'a', id: 'its own' }],
        },
    })

    await session.open()

    expect(await session.firstPage('messages')).toEqual([{ id: '1', raw: { id: 1, text: 'one' } }])
    expect(await session.firstPage('things')).toEqual([{ id: 'a', raw: { _id: 'a', id: 'its own' } }])
})

test('the first page of a service the server does not have rejects with the reason', async () => {
    const { session } = makeSession()

    await session.open()

    expect(session.firstPage('nothing')).rejects.toThrow('Service not found: nothing')
})

test('the first page is at most 25 records, of a service with pages or without', async () => {
    const records = Array.from({ length: 40 }, (_, id) => ({ id }))
    const { session } = makeSession({
        services: { whole: records, paged: { total: 40, limit: 30, skip: 0, data: records.slice(0, 30) } },
    })

    await session.open()

    expect((await session.firstPage('whole')).map(record => record.id)).toEqual(
        Array.from({ length: 25 }, (_, id) => String(id)),
    )
    expect(await session.firstPage('paged')).toHaveLength(25)
})

test('an answer that is not records rejects', async () => {
    const { session } = makeSession({ services: { odd: { status: 'ok' } } })

    await session.open()

    expect(session.firstPage('odd')).rejects.toThrow('The service "odd" did not answer with records')
})
