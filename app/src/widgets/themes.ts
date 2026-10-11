// The themes. A widget names a role (`--ui-accent`), never a color; a theme says what each role is. A theme is
// given as three seeds, and its other roles are derived from them, so a palette of a few colors is a whole theme.
import { contrast, mix, withAlpha } from './color.ts'

/** What a widget may color itself with. */
export interface Roles {
    /** The page behind everything. */
    page: string
    /** What sits on the page: a dialog, a sidebar, a card. */
    panel: string
    /** What is set into a surface: an input, a table's header, a row under the pointer. */
    sunken: string
    text: string
    /** Text that matters less: a hint, a label. */
    muted: string
    border: string
    /** What draws the eye: the main button, a link, the focus ring. */
    accent: string
    /** Text on the accent. */
    onAccent: string
    /** A surface that is selected, or has just changed. */
    accentSoft: string
    danger: string
    warning: string
    success: string
}

export type Scheme = 'light' | 'dark'

export interface Theme {
    /** Its own among the themes: what a choice is stored as. */
    name: string
    /** As the user reads it. */
    label: string
    scheme: Scheme
    /** `#rgb` or `#rrggbb`, as every color of a theme. */
    seeds: { background: string; text: string; accent: string }
    /** A role given here is used as it is, in place of the derived one. */
    roles?: Partial<Roles>
    /** A CSS `font-family`. */
    font: string
    /** The corners of a control, as a CSS length. */
    radius: string
    /** How strongly what is accented glows: 0 (not at all) to 1. */
    glow: number
}

const STATUS: Record<Scheme, Pick<Roles, 'danger' | 'warning' | 'success'>> = {
    light: { danger: '#a3312a', warning: '#775000', success: '#38612d' },
    dark: { danger: '#ff9a94', warning: '#f0c674', success: '#8fe0b6' },
}

/** The roles of a theme: derived from its seeds, then what it gives itself. */
export function themeRoles(theme: Theme): Roles {
    const { background, text, accent } = theme.seeds
    const light = theme.scheme === 'light'

    return {
        page: background,
        panel: light ? mix(background, '#ffffff', 0.55) : mix(background, text, 0.07),
        sunken: light ? mix(background, text, 0.07) : mix(background, '#000000', 0.35),
        text,
        muted: mix(text, background, light ? 0.2 : 0.35),
        border: mix(background, text, 0.22),
        accent,
        onAccent: contrast(background, accent) >= contrast(text, accent) ? background : text,
        accentSoft: mix(background, accent, 0.18),
        ...STATUS[theme.scheme],
        ...theme.roles,
    }
}

/** A theme as the CSS variables the widgets read. */
export function themeVariables(theme: Theme): Record<string, string> {
    const roles = themeRoles(theme)
    const variables: Record<string, string> = {}

    for (const [role, color] of Object.entries(roles)) {
        variables[`--ui-${role.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`] = color
    }

    variables['--ui-font'] = theme.font
    variables['--ui-radius'] = theme.radius
    variables['--ui-glow'] = theme.glow > 0 ? `0 0 0.9rem ${withAlpha(roles.accent, theme.glow * 0.6)}` : 'none'

    return variables
}

/** Sand and clay: light, warm, and not much like a developer's tool. */
export const SAND: Theme = {
    name: 'sand',
    label: 'Sand',
    scheme: 'light',
    seeds: { background: '#eee4d2', text: '#382c21', accent: '#8f4322' },
    font: "Seravek, 'Gill Sans Nova', Ubuntu, Calibri, 'DejaVu Sans', source-sans-pro, sans-serif",
    radius: '0.4rem',
    glow: 0,
}

/** Near black, with a pale blue that glows. */
export const ETHER: Theme = {
    name: 'ether',
    label: 'Ether',
    scheme: 'dark',
    seeds: { background: '#0a0f15', text: '#c5d3df', accent: '#9fe6ff' },
    font: "Avenir, Montserrat, Corbel, 'URW Gothic', source-sans-pro, sans-serif",
    radius: '0.15rem',
    glow: 0.75,
}

/** The first of each scheme is the one the system's setting picks. */
export const THEMES: readonly Theme[] = [SAND, ETHER]
