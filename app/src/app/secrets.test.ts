import { expect, test } from 'bun:test'
import { Secrets } from './secrets.ts'

test('a secret is held by server', () => {
    const secrets = new Secrets()

    secrets.set('one', 'first')
    secrets.set('two', 'second')

    expect(secrets.get('one')).toBe('first')
    expect(secrets.get('two')).toBe('second')
    expect(secrets.has('one')).toBe(true)
})

test('a server with no secret has none', () => {
    const secrets = new Secrets()

    expect(secrets.get('one')).toBeUndefined()
    expect(secrets.has('one')).toBe(false)
})

test('a secret set again takes the place of the one there was', () => {
    const secrets = new Secrets()
    secrets.set('one', 'first')

    secrets.set('one', 'changed')

    expect(secrets.get('one')).toBe('changed')
})

test('a secret forgotten is gone, and the other servers keep theirs', () => {
    const secrets = new Secrets()
    secrets.set('one', 'first')
    secrets.set('two', 'second')

    secrets.forget('one')
    secrets.forget('never-set')

    expect(secrets.has('one')).toBe(false)
    expect(secrets.get('two')).toBe('second')
})

test('an empty secret is none', () => {
    const secrets = new Secrets()
    secrets.set('one', 'first')

    secrets.set('one', '')

    expect(secrets.has('one')).toBe(false)
    expect(secrets.get('one')).toBeUndefined()
})

test('destroy() forgets them all', () => {
    const secrets = new Secrets()
    secrets.set('one', 'first')
    secrets.set('two', 'second')

    secrets.destroy()

    expect(secrets.has('one')).toBe(false)
    expect(secrets.has('two')).toBe(false)
})

test('nothing of a secret shows when the object is written out', () => {
    const secrets = new Secrets()
    secrets.set('one', 'first')

    expect(JSON.stringify(secrets)).toBe('{}')
    expect(Object.keys(secrets)).toEqual([])
})

test('two windows each hold their own', () => {
    const first = new Secrets()
    const second = new Secrets()

    first.set('one', 'first')

    expect(second.has('one')).toBe(false)
})
