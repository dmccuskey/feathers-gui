// Which theme is on. The choice is a theme by name, or `system`: the first light or dark theme, as the system's
// setting says, followed while it changes. The choice is kept in the browser.
import { inject, shallowRef, type InjectionKey } from 'vue'
import { THEMES, themeVariables, type Theme } from './themes.ts'

/** The choice that follows the system's setting. */
export const SYSTEM = 'system'

export interface ThemingOptions {
    /** Default: the themes of the widget set. */
    themes?: readonly Theme[]
    /** The element the theme is put on. Default: the document's root. */
    root?: HTMLElement
    /** The system's setting for dark. Default: the `prefers-color-scheme` media query. */
    dark?: Pick<MediaQueryList, 'matches' | 'addEventListener' | 'removeEventListener'>
    /** Where the choice is kept. Default: `localStorage`. */
    storage?: Pick<Storage, 'getItem' | 'setItem'>
    /** The key the choice is kept under. */
    storageKey?: string
}

/** The key the theming is provided under: `vueApp.provide(THEMING_KEY, theming)`. */
export const THEMING_KEY: InjectionKey<Theming> = Symbol('widgets.theming')

export class Theming {
    readonly themes: readonly Theme[]

    readonly #root: HTMLElement
    readonly #dark: NonNullable<ThemingOptions['dark']>
    readonly #storage: NonNullable<ThemingOptions['storage']>
    readonly #storageKey: string
    readonly #choice = shallowRef(SYSTEM)
    readonly #theme = shallowRef<Theme>()

    constructor(options: ThemingOptions = {}) {
        this.themes = options.themes ?? THEMES
        this.#root = options.root ?? document.documentElement
        this.#dark = options.dark ?? window.matchMedia('(prefers-color-scheme: dark)')
        this.#storage = options.storage ?? window.localStorage
        this.#storageKey = options.storageKey ?? 'widgets.theme'

        if (this.themes.length === 0) throw new Error('Theming needs a theme')

        const stored = this.#storage.getItem(this.#storageKey)

        // A theme that is no longer there: back to the system's setting.
        if (stored !== null && this.themes.some(theme => theme.name === stored)) this.#choice.value = stored

        this.#apply()
        this.#dark.addEventListener('change', this.#apply)
    }

    /** Stops following the system's setting. The theme stays on. */
    destroy(): void {
        this.#dark.removeEventListener('change', this.#apply)
    }

    /** A theme's name, or `SYSTEM`. */
    get choice(): string {
        return this.#choice.value
    }

    set choice(choice: string) {
        if (choice !== SYSTEM && !this.themes.some(theme => theme.name === choice)) {
            throw new Error(`No theme with the name "${choice}"`)
        }

        this.#choice.value = choice
        this.#storage.setItem(this.#storageKey, choice)
        this.#apply()
    }

    /** The theme that is on. */
    get theme(): Theme {
        return this.#theme.value as Theme
    }

    #apply = (): void => {
        const scheme = this.#dark.matches ? 'dark' : 'light'
        const theme =
            this.themes.find(other => other.name === this.#choice.value) ??
            this.themes.find(other => other.scheme === scheme) ??
            (this.themes[0] as Theme)

        if (theme === this.#theme.value) return

        this.#theme.value = theme
        this.#root.dataset.theme = theme.name
        // The browser's own parts follow: a select's list, the scrollbars.
        this.#root.style.setProperty('color-scheme', theme.scheme)

        for (const [name, value] of Object.entries(themeVariables(theme))) this.#root.style.setProperty(name, value)
    }
}

/** The theming, in a component. */
export function useTheming(): Theming {
    const theming = inject(THEMING_KEY)

    if (!theming) throw new Error('The theming is not provided: useTheming() needs provide(THEMING_KEY, theming)')

    return theming
}
