import { expect, test } from 'bun:test'
import { ETHER, SAND } from './themes.ts'
import { SYSTEM, Theming } from './theming.ts'

/** The system's setting for dark, to be changed by the test. */
class FakeDark extends EventTarget {
    matches = false

    set(matches: boolean): void {
        this.matches = matches
        this.dispatchEvent(new Event('change'))
    }
}

function fakeStorage(stored: Record<string, string> = {}) {
    return {
        stored,
        getItem: (key: string) => stored[key] ?? null,
        setItem: (key: string, value: string) => {
            stored[key] = value
        },
    }
}

function make(options: { dark?: boolean; stored?: Record<string, string> } = {}) {
    const root = document.createElement('div')
    const dark = new FakeDark()
    const storage = fakeStorage(options.stored)

    dark.matches = options.dark ?? false

    return { root, dark, storage, theming: new Theming({ root, dark, storage, storageKey: 'theme' }) }
}

test('with nothing chosen, the theme is as the system says', () => {
    expect(make().theming.theme).toBe(SAND)
    expect(make({ dark: true }).theming.theme).toBe(ETHER)
    expect(make().theming.choice).toBe(SYSTEM)
})

test('the theme is put on the root: its name, its scheme and its variables', () => {
    const { root } = make({ dark: true })

    expect(root.dataset.theme).toBe('ether')
    expect(root.style.getPropertyValue('color-scheme')).toBe('dark')
    expect(root.style.getPropertyValue('--ui-accent')).toBe(ETHER.seeds.accent)
})

test('a change of the system is followed', () => {
    const { theming, dark, root } = make()

    dark.set(true)

    expect(theming.theme).toBe(ETHER)
    expect(root.dataset.theme).toBe('ether')
})

test('a theme chosen is on whatever the system says, and is kept', () => {
    const { theming, dark, storage } = make()

    theming.choice = 'ether'
    dark.set(false)

    expect(theming.theme).toBe(ETHER)
    expect(storage.stored).toEqual({ theme: 'ether' })
})

test('the choice kept is the one a new window starts with', () => {
    const { theming } = make({ stored: { theme: 'ether' } })

    expect(theming.choice).toBe('ether')
    expect(theming.theme).toBe(ETHER)
})

test('a choice kept that is no theme is taken as the system', () => {
    const { theming } = make({ stored: { theme: 'gone' } })

    expect(theming.choice).toBe(SYSTEM)
    expect(theming.theme).toBe(SAND)
})

test('back to the system, the theme is as the system says again', () => {
    const { theming } = make({ dark: true, stored: { theme: 'sand' } })

    theming.choice = SYSTEM

    expect(theming.theme).toBe(ETHER)
})

test('a theme that is not there cannot be chosen', () => {
    expect(() => {
        make().theming.choice = 'gone'
    }).toThrow('No theme with the name "gone"')
})

test('destroyed, it no longer follows the system', () => {
    const { theming, dark } = make()

    theming.destroy()
    dark.set(true)

    expect(theming.theme).toBe(SAND)
})
