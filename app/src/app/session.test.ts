import { expect, test } from 'bun:test'
import { FakeBrowser } from '../../test-support/fake-browser.ts'
import { fakeConnection, type FakeConnectionOptions } from '../../test-support/fake-connection.ts'
import { Secrets } from './secrets.ts'
import { Session } from './session.ts'
import { Setup } from './setup.ts'

function makeSession(options: FakeConnectionOptions = {}): Session {
    const setup = new Setup(new FakeBrowser().open())
    const server = setup.addServer({ name: 'Local', url: 'http://localhost:3041', readOnly: false })

    return new Session(server, { setup, secrets: new Secrets(), makeConnection: () => fakeConnection(options) })
}

test('a session is closed until it is opened, and ready once connected', async () => {
    const session = makeSession()

    expect(session.status).toEqual({ phase: 'closed' })

    const opened = session.open()

    expect(session.status).toEqual({ phase: 'connecting' })

    await opened

    expect(session.status).toEqual({ phase: 'ready' })
})

test('a server that cannot be reached leaves the session closed, with the reason', async () => {
    const session = makeSession({ error: new Error('Could not connect to http://localhost:3041') })

    await session.open()

    expect(session.status).toEqual({ phase: 'closed', error: 'Could not connect to http://localhost:3041' })
})

test('a session destroyed while it connects stays closed', async () => {
    const session = makeSession()
    const opened = session.open()

    session.destroy()
    await opened

    expect(session.status).toEqual({ phase: 'closed' })
})

test('the first page has each record as the server has it, under its ID as a string', async () => {
    const session = makeSession({
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
    const session = makeSession()

    await session.open()

    expect(session.firstPage('nothing')).rejects.toThrow('Service not found: nothing')
})

test('the first page is at most 25 records, of a service with pages or without', async () => {
    const records = Array.from({ length: 40 }, (_, id) => ({ id }))
    const session = makeSession({
        services: { whole: records, paged: { total: 40, limit: 30, skip: 0, data: records.slice(0, 30) } },
    })

    await session.open()

    expect((await session.firstPage('whole')).map(record => record.id)).toEqual(
        Array.from({ length: 25 }, (_, id) => String(id)),
    )
    expect(await session.firstPage('paged')).toHaveLength(25)
})

test('an answer that is not records rejects', async () => {
    const session = makeSession({ services: { odd: { status: 'ok' } } })

    await session.open()

    expect(session.firstPage('odd')).rejects.toThrow('The service "odd" did not answer with records')
})
