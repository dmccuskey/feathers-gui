import { expect, test } from 'bun:test'
import type { LoginSetup } from '../app/setup.ts'
import { statusText, type StatusText } from './session-status.ts'

const LOCAL: LoginSetup = {
    kind: 'local',
    path: 'authentication',
    usernameField: 'email',
    passwordField: 'password',
    username: 'ada@example.com',
    remember: false,
}
const TOKEN: LoginSetup = { ...LOCAL, kind: 'token', username: '' }
const REASON = { message: 'ECONNREFUSED' }

test('no session, or one closed, is not connected, with the reason of a refusal', () => {
    expect(statusText(undefined, undefined)).toEqual({ tone: 'off', line: 'Not connected' })
    expect(statusText({ phase: 'closed', attempts: 0, error: REASON }, undefined)).toEqual({
        tone: 'off',
        line: 'Not connected',
        detail: 'ECONNREFUSED',
    })
})

test('connecting and lost say whether an attempt has failed, with its reason, and offer to try now', () => {
    expect(statusText({ phase: 'connecting', attempts: 0 }, undefined)).toEqual({ tone: 'busy', line: 'Connecting…' })
    expect(statusText({ phase: 'connecting', attempts: 2, error: REASON }, undefined)).toEqual({
        tone: 'busy',
        strong: 'Can’t reach the server.',
        line: 'Trying again soon…',
        detail: 'ECONNREFUSED',
        action: 'try-now',
    })
    expect(statusText({ phase: 'lost', attempts: 0 }, undefined)).toEqual({
        tone: 'busy',
        strong: 'Connection lost.',
        line: 'Reconnecting…',
        action: 'try-now',
    })
    expect(statusText({ phase: 'lost', attempts: 1, error: REASON }, undefined)).toMatchObject({
        line: 'Trying again soon…',
        detail: 'ECONNREFUSED',
        action: 'try-now',
    })
})

test('trying now says it is connecting, until the attempt ends', () => {
    const connecting: StatusText = { tone: 'busy', line: 'Connecting…' }

    expect(statusText({ phase: 'connecting', attempts: 2, error: REASON, isRetrying: true }, undefined)).toEqual(
        connecting,
    )
    expect(statusText({ phase: 'lost', attempts: 1, error: REASON, isRetrying: true }, undefined)).toEqual(connecting)
})

test('a session waiting for a login offers it, with the reason of a refusal', () => {
    expect(statusText({ phase: 'logging-in', attempts: 0 }, LOCAL)).toEqual({ tone: 'busy', line: 'Logging in…' })
    expect(
        statusText({ phase: 'login-needed', attempts: 0, error: { message: 'Invalid login', code: 401 } }, LOCAL),
    ).toEqual({ tone: 'busy', strong: 'Not logged in.', line: '', detail: 'Invalid login', action: 'log-in' })
})

test('a session ready says as whom, and offers to log out', () => {
    expect(statusText({ phase: 'ready', attempts: 0 }, undefined)).toEqual({ tone: 'ok', line: 'Connected' })
    expect(statusText({ phase: 'ready', attempts: 0, user: { email: 'x' } }, LOCAL)).toEqual({
        tone: 'ok',
        line: 'Connected as ada@example.com',
        action: 'log-out',
    })
    expect(statusText({ phase: 'ready', attempts: 0, user: { name: 'Grace', id: 3 } }, TOKEN).line).toBe(
        'Connected as Grace',
    )
    expect(statusText({ phase: 'ready', attempts: 0, user: { _id: 'u1' } }, TOKEN).line).toBe('Connected as u1')
    expect(statusText({ phase: 'ready', attempts: 0 }, TOKEN).line).toBe('Connected')
})
