import { describe, expect, test } from 'bun:test'
import { contrast, mix } from './color.ts'
import { ETHER, SAND, THEMES, themeRoles, themeVariables, type Theme } from './themes.ts'

test('mix() goes from one color to the other', () => {
    expect(mix('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mix('#000000', '#ffffff', 1)).toBe('#ffffff')
    expect(mix('#000', '#fff', 0.5)).toBe('#808080')
})

test('contrast() is 21 for black on white, and 1 for a color on itself', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21)
    expect(contrast('#9a4a27', '#9a4a27')).toBeCloseTo(1)
})

test('a color that is not hex is refused', () => {
    expect(() => mix('red', '#fff', 0.5)).toThrow('Not a color')
})

// What is read has the contrast of WCAG AA for text (4.5) on every surface it may sit on.
describe.each(THEMES.map(theme => [theme.name, theme] as const))('the theme "%s"', (_name, theme) => {
    const roles = themeRoles(theme)
    const surfaces = { page: roles.page, panel: roles.panel, sunken: roles.sunken }

    test.each(['text', 'muted', 'accent', 'danger', 'warning', 'success'] as const)(
        '%s can be read on every surface',
        role => {
            for (const [surface, color] of Object.entries(surfaces)) {
                expect([role, surface, contrast(roles[role], color) >= 4.5]).toEqual([role, surface, true])
            }
        },
    )

    test('text can be read on what is selected, and on the accent', () => {
        expect(contrast(roles.text, roles.accentSoft)).toBeGreaterThanOrEqual(4.5)
        expect(contrast(roles.onAccent, roles.accent)).toBeGreaterThanOrEqual(4.5)
    })

    test('a surface differs from its border', () => {
        expect(contrast(roles.border, roles.panel)).toBeGreaterThan(1.2)
    })
})

test('the first theme of each scheme is there, for the system to pick', () => {
    expect(THEMES.find(theme => theme.scheme === 'light')).toBe(SAND)
    expect(THEMES.find(theme => theme.scheme === 'dark')).toBe(ETHER)
})

test('a role a theme gives itself is used in place of the derived one', () => {
    const theme: Theme = { ...SAND, roles: { panel: '#ffffff' } }

    expect(themeRoles(theme).panel).toBe('#ffffff')
    expect(themeRoles(theme).page).toBe(SAND.seeds.background)
})

test('the text on the accent is the seed that reads best on it', () => {
    expect(themeRoles(SAND).onAccent).toBe(SAND.seeds.background)
    expect(themeRoles(ETHER).onAccent).toBe(ETHER.seeds.background)
})

test('a theme becomes the variables the widgets read', () => {
    const variables = themeVariables(ETHER)

    expect(variables['--ui-accent']).toBe(ETHER.seeds.accent)
    expect(variables['--ui-on-accent']).toBe(ETHER.seeds.background)
    expect(variables['--ui-accent-soft']).toMatch(/^#[0-9a-f]{6}$/)
    expect(variables['--ui-radius']).toBe(ETHER.radius)
    expect(variables['--ui-glow']).toContain('rgb(159 230 255 /')
    expect(themeVariables(SAND)['--ui-glow']).toBe('none')
})
