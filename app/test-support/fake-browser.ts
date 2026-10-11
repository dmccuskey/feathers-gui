// A browser's storage for the tests: one `localStorage` shared by its windows, a `sessionStorage` for each, and the
// `storage` event that tells a window of a write made in another.
import type { KeyValueStorage } from '../src/app/setup.ts'

export class FakeStorage implements KeyValueStorage {
    readonly #items = new Map<string, string>()

    getItem(key: string): string | null {
        return this.#items.get(key) ?? null
    }

    setItem(key: string, value: string): void {
        this.#items.set(key, value)
    }

    removeItem(key: string): void {
        this.#items.delete(key)
    }
}

export interface FakeWindow {
    local: KeyValueStorage
    session: FakeStorage
    events: EventTarget
}

export class FakeBrowser {
    /** The shared storage itself. A write made here, and not through a window, tells no window. */
    readonly local = new FakeStorage()
    readonly #windows: FakeWindow[] = []

    /** A new window. As in a browser, its writes to `local` are told to every window but itself. */
    open(): FakeWindow {
        const tellOthers = (key: string): void => {
            for (const other of this.#windows) {
                if (other !== opened) other.events.dispatchEvent(Object.assign(new Event('storage'), { key }))
            }
        }

        const opened: FakeWindow = {
            local: {
                getItem: key => this.local.getItem(key),
                setItem: (key, value) => {
                    this.local.setItem(key, value)
                    tellOthers(key)
                },
                removeItem: key => {
                    this.local.removeItem(key)
                    tellOthers(key)
                },
            },
            session: new FakeStorage(),
            events: new EventTarget(),
        }

        this.#windows.push(opened)

        return opened
    }
}
