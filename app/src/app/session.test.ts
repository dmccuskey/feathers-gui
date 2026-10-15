import { expect, test } from 'bun:test'
import { FakeBrowser } from '../../test-support/fake-browser.ts'
import {
    fakeConnection,
    serverError,
    type FakeConnection,
    type FakeConnectionOptions,
} from '../../test-support/fake-connection.ts'
import { Secrets } from './secrets.ts'
import { Session } from './session.ts'
import { Setup, type LoginSetup } from './setup.ts'

interface Made {
    session: Session
    connection: FakeConnection
    secrets: Secrets
}

/** A session with a fake connection. `login`: the server's login, as set up. */
function makeSession(
    options: FakeConnectionOptions = {},
    login?: Partial<LoginSetup>,
    secrets = new Secrets({ channel: null }),
): Made {
    const setup = new Setup(new FakeBrowser().open())
    const server = setup.addServer({
        name: 'Local',
        url: 'http://localhost:3041',
        readOnly: false,
        ...(login
            ? {
                  login: {
                      kind: 'local',
                      path: 'authentication',
                      usernameField: 'email',
                      passwordField: 'password',
                      username: 'ada@example.com',
                      remember: false,
                      ...login,
                  },
              }
            : {}),
    })
    const connection = fakeConnection(options)

    return {
        session: new Session(server, { setup, secrets, makeConnection: () => connection, loginWait: 20 }),
        connection,
        secrets,
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

test('a session logs in with the password remembered, and is ready as the user', async () => {
    const { session, connection } = makeSession({ password: 'secret' }, { remember: true, password: 'secret' })

    await session.open()

    expect(connection.logins).toEqual([{ strategy: 'local', email: 'ada@example.com', password: 'secret' }])
    expect(session.status).toEqual({ phase: 'ready', attempts: 0, user: { email: 'ada@example.com' } })
})

test('a login sends the username and password under the field names set up', async () => {
    const { session, connection } = makeSession(
        { password: 'secret' },
        { usernameField: 'username', passwordField: 'pass', username: 'ada', remember: true, password: 'secret' },
    )

    await session.open()

    expect(connection.logins).toEqual([{ strategy: 'local', username: 'ada', pass: 'secret' }])
})

test('a login of kind token sends the token by the jwt strategy', async () => {
    const { session, connection, secrets } = makeSession({ password: 'eyJ' }, { kind: 'token' })

    secrets.set(session.serverId, 'eyJ')
    await session.open()

    expect(connection.logins).toEqual([{ strategy: 'jwt', accessToken: 'eyJ' }])
    expect(session.status.phase).toBe('ready')
})

test('with no password in hand, the session waits for login(), and holds the password once accepted', async () => {
    const { session, connection, secrets } = makeSession({ password: 'secret' }, {})

    await session.open()
    expect(session.status).toEqual({ phase: 'login-needed', attempts: 0 })
    expect(connection.logins).toEqual([])

    await session.login({ username: 'grace@example.com', password: 'secret' })

    expect(session.status).toEqual({ phase: 'ready', attempts: 0, user: { email: 'grace@example.com' } })
    expect(secrets.held(session.serverId)).toBe('secret')
})

test('a password refused rejects login(), and the session waits for another', async () => {
    const { session, secrets } = makeSession({ password: 'secret' }, {})

    await session.open()

    expect(session.login({ username: 'ada@example.com', password: 'wrong' })).rejects.toThrow('Invalid login')
    await settled()
    expect(session.status).toEqual({
        phase: 'login-needed',
        error: { message: 'Invalid login', code: 401 },
        attempts: 0,
    })
    expect(secrets.has(session.serverId)).toBe(false)

    await session.login({ username: 'ada@example.com', password: 'secret' })
    expect(session.status.phase).toBe('ready')
})

test('a password held for the window that is refused is forgotten', async () => {
    const { session, secrets } = makeSession({ password: 'secret' }, {})

    secrets.set(session.serverId, 'old')
    await session.open()

    expect(session.status.phase).toBe('login-needed')
    expect(session.status.error).toEqual({ message: 'Invalid login', code: 401 })
    expect(secrets.has(session.serverId)).toBe(false)
})

test('a session in a new window logs in with the password typed in another', async () => {
    const channel = `test:${crypto.randomUUID()}`
    const other = new Secrets({ channel, askWait: 30 })
    const { session, connection, secrets } = makeSession(
        { password: 'secret' },
        {},
        new Secrets({ channel, askWait: 30 }),
    )

    other.set(session.serverId, 'secret')
    await session.open()

    expect(connection.logins).toEqual([{ strategy: 'local', email: 'ada@example.com', password: 'secret' }])
    expect(session.status.phase).toBe('ready')
    session.destroy()
    secrets.destroy()
    other.destroy()
})

test('a password refused is forgotten in the other windows too', async () => {
    const channel = `test:${crypto.randomUUID()}`
    const other = new Secrets({ channel, askWait: 30 })
    const { session, secrets } = makeSession({ password: 'secret' }, {}, new Secrets({ channel, askWait: 30 }))

    other.set(session.serverId, 'old')
    await session.open()
    await Bun.sleep(5)

    expect(session.status.phase).toBe('login-needed')
    expect(secrets.has(session.serverId)).toBe(false)
    expect(other.has(session.serverId)).toBe(false)
    session.destroy()
    secrets.destroy()
    other.destroy()
})

test('a login that fails without a refusal keeps the password, and waits for login()', async () => {
    const { session, connection, secrets } = makeSession({ password: 'secret', manualLogin: true }, {})

    secrets.set(session.serverId, 'secret')
    void session.open()
    await settled()
    expect(session.status.phase).toBe('logging-in')

    connection.failLogin(new Error('operation has timed out'))
    await settled()
    expect(session.status).toEqual({
        phase: 'login-needed',
        error: { message: 'operation has timed out' },
        attempts: 0,
    })
    expect(secrets.held(session.serverId)).toBe('secret')
})

test('a lost connection comes back logged in by the connection itself', async () => {
    const { session, connection } = makeSession({ password: 'secret' }, { remember: true, password: 'secret' })

    await session.open()
    connection.drop()
    await settled()
    expect(session.status.phase).toBe('lost')

    connection.accept()
    await settled()
    expect(session.status.phase).toBe('ready')
    expect(connection.logins).toHaveLength(1)
})

test('a token that runs out is replaced by logging in again with the password held', async () => {
    const { session, connection } = makeSession({ password: 'secret' }, {})

    await session.open()
    await session.login({ username: 'ada@example.com', password: 'secret' })

    connection.expireToken()
    await settled()

    expect(session.status.phase).toBe('ready')
    expect(connection.logins).toEqual([
        { strategy: 'local', email: 'ada@example.com', password: 'secret' },
        { strategy: 'local', email: 'ada@example.com', password: 'secret' },
    ])
})

test('a login again that is never answered is followed by one of the session own, once the wait is over', async () => {
    const { session, connection } = makeSession(
        { password: 'secret', silentRelogin: true },
        { remember: true, password: 'secret' },
    )

    await session.open()
    connection.drop()
    connection.accept()
    await settled()
    expect(session.status.phase).toBe('logging-in')

    await Bun.sleep(30)
    await settled()
    expect(session.status.phase).toBe('ready')
    expect(connection.logins).toHaveLength(2)
})

test('a connection lost while logging in logs in once it is back', async () => {
    const { session, connection, secrets } = makeSession({ password: 'secret', manualLogin: true }, {})

    secrets.set(session.serverId, 'secret')
    void session.open()
    await settled()
    connection.drop()
    connection.failLogin(new Error('disconnected'))
    await settled()
    expect(session.status.phase).toBe('lost')

    connection.accept()
    await settled()
    connection.answerLogin()
    await settled()
    expect(session.status.phase).toBe('ready')
    expect(connection.logins).toHaveLength(2)
})

test('after logout() the session waits for login(), also when the connection comes back', async () => {
    const { session, connection, secrets } = makeSession({ password: 'secret' }, { remember: true, password: 'secret' })

    await session.open()
    secrets.set(session.serverId, 'secret')
    await session.logout()
    await settled()

    expect(session.status).toEqual({ phase: 'login-needed', attempts: 0 })
    expect(connection.logouts).toBe(1)
    expect(secrets.has(session.serverId)).toBe(false)

    connection.drop()
    connection.accept()
    await settled()
    expect(session.status.phase).toBe('login-needed')
    expect(connection.logins).toHaveLength(1)
})

test('login() is refused by a server without a login, and while connecting', async () => {
    expect(makeSession().session.login({ token: 'eyJ' })).rejects.toThrow('The server has no login')

    const { session } = makeSession({ manual: true }, {})

    void session.open()
    await settled()
    expect(session.login({ token: 'eyJ' })).rejects.toThrow('The session cannot log in while connecting')
})

test('a login waiting when the session is destroyed rejects', async () => {
    const { session } = makeSession({ password: 'secret', manualLogin: true }, {})

    await session.open()

    const login = session.login({ username: 'ada@example.com', password: 'secret' })

    session.destroy()
    expect(login).rejects.toThrow('The session was closed')
})
