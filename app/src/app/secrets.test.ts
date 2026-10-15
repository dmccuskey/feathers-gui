import { afterEach, expect, test } from 'bun:test'
import { Secrets } from './secrets.ts'

const opened: Secrets[] = []

afterEach(() => {
    for (const secrets of opened.splice(0)) secrets.destroy()
})

/** A window's secrets, kept to itself. */
function alone(): Secrets {
    return new Secrets({ channel: null })
}

/** A browser, whose windows share their secrets. Another browser is not asked. */
function browser(): { open: () => Secrets } {
    const channel = `test:${crypto.randomUUID()}`

    return {
        open: () => {
            const secrets = new Secrets({ channel, askWait: 30 })

            opened.push(secrets)

            return secrets
        },
    }
}

/** The secrets of windows open in one browser. */
function windows(count: number): Secrets[] {
    const { open } = browser()

    return Array.from({ length: count }, open)
}

/** Lets the messages between the windows arrive. */
async function delivered(): Promise<void> {
    await Bun.sleep(5)
}

test('a secret is held by server', async () => {
    const secrets = alone()

    secrets.set('one', 'first')
    secrets.set('two', 'second')

    expect(secrets.held('one')).toBe('first')
    expect(await secrets.get('two')).toBe('second')
    expect(secrets.has('one')).toBe(true)
})

test('a server with no secret has none', async () => {
    const secrets = alone()

    expect(secrets.held('one')).toBeUndefined()
    expect(await secrets.get('one')).toBeUndefined()
    expect(secrets.has('one')).toBe(false)
})

test('a secret set again takes the place of the one there was', () => {
    const secrets = alone()
    secrets.set('one', 'first')

    secrets.set('one', 'changed')

    expect(secrets.held('one')).toBe('changed')
})

test('a secret forgotten is gone, and the other servers keep theirs', () => {
    const secrets = alone()
    secrets.set('one', 'first')
    secrets.set('two', 'second')

    secrets.forget('one')
    secrets.forget('never-set')

    expect(secrets.has('one')).toBe(false)
    expect(secrets.held('two')).toBe('second')
})

test('an empty secret is none', () => {
    const secrets = alone()
    secrets.set('one', 'first')

    secrets.set('one', '')

    expect(secrets.has('one')).toBe(false)
})

test('destroy() forgets them all', () => {
    const secrets = alone()
    secrets.set('one', 'first')
    secrets.set('two', 'second')

    secrets.destroy()

    expect(secrets.has('one')).toBe(false)
    expect(secrets.has('two')).toBe(false)
})

test('nothing of a secret shows when the object is written out', () => {
    const [secrets] = windows(1)
    secrets!.set('one', 'first')

    expect(JSON.stringify(secrets)).toBe('{}')
    expect(Object.keys(secrets!)).toEqual([])
})

test('a window opened later gets a secret from one that was open before it', async () => {
    const { open } = browser()
    const first = open()
    first.set('one', 'first')

    const later = open()

    expect(later.has('one')).toBe(false)
    expect(await later.get('one')).toBe('first')
    expect(later.held('one')).toBe('first')
})

test('no window has the secret: none, once the wait is over', async () => {
    const [first, second] = windows(2)
    first!.set('two', 'second')
    await delivered()

    expect(await second!.get('one')).toBeUndefined()
    expect(second!.has('one')).toBe(false)
})

test('two lookups at once ask once, and get the same', async () => {
    const [first, second] = windows(2)
    first!.set('one', 'first')
    await delivered()
    second!.forget('one')

    const both = [second!.get('one'), second!.get('one')]

    expect(both[0]).toBe(both[1])
    expect(await Promise.all(both)).toEqual(['first', 'first'])
})

test('a new secret replaces the one every window holds: a window asking then gets only the new one', async () => {
    const [first, second, third, fourth] = windows(4)
    first!.set('one', 'old')
    await delivered()

    third!.set('one', 'new')
    await delivered()

    expect(first!.held('one')).toBe('new')
    expect(second!.held('one')).toBe('new')
    fourth!.forget('one')
    expect(await fourth!.get('one')).toBe('new')
})

test('a refused secret is forgotten in every window that holds it', async () => {
    const [first, second] = windows(2)
    first!.set('one', 'first')
    first!.set('two', 'second')
    await delivered()

    first!.refused('one', 'first')
    await delivered()

    expect(first!.has('one')).toBe(false)
    expect(second!.has('one')).toBe(false)
    expect(second!.held('two')).toBe('second')
})

test('a window that holds another secret than the one refused keeps it', async () => {
    const [first, second] = windows(2)
    first!.set('one', 'old')
    await delivered()
    second!.set('one', 'new')

    // The refusal of the old one crosses the new one on its way
    first!.refused('one', 'old')
    await delivered()

    expect(second!.held('one')).toBe('new')
    expect(first!.held('one')).toBe('new')
})

test('forgetting, or an empty secret, is the window’s own', async () => {
    const [first, second] = windows(2)
    first!.set('one', 'first')
    first!.set('two', 'second')
    await delivered()

    first!.forget('one')
    first!.set('two', '')
    await delivered()

    expect(second!.held('one')).toBe('first')
    expect(second!.held('two')).toBe('second')
})

test('windows of another browser are not asked', async () => {
    const [first] = windows(1)
    const [other] = windows(1)
    first!.set('one', 'first')
    await delivered()

    expect(await other!.get('one')).toBeUndefined()
})

test('a window kept to itself is not asked, and does not ask', async () => {
    const [first] = windows(1)
    const kept = alone()
    first!.set('one', 'first')
    kept.set('two', 'second')
    await delivered()

    expect(kept.has('one')).toBe(false)
    expect(await kept.get('one')).toBeUndefined()
    expect(await first!.get('two')).toBeUndefined()
})

test('a lookup under way when the window ends gets none, and nothing is sent after', async () => {
    const [first] = windows(1)
    const asked = first!.get('one')

    first!.destroy()

    expect(await asked).toBeUndefined()
    expect(() => first!.set('one', 'first')).not.toThrow()
})
