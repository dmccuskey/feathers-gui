// Colors as the themes need them: `#rrggbb` in, `#rrggbb` out. Only what deriving a theme and checking it takes.

type Rgb = readonly [number, number, number]

function parse(hex: string): Rgb {
    const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())

    if (!match?.[1]) throw new Error(`Not a color as "#rgb" or "#rrggbb": "${hex}"`)

    const digits = match[1].length === 3 ? [...match[1]].map(digit => digit + digit).join('') : match[1]
    const value = Number.parseInt(digits, 16)

    return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

/** The color that is `amount` (0 to 1) of the way from `from` to `to`. */
export function mix(from: string, to: string, amount: number): string {
    const a = parse(from)
    const b = parse(to)
    const channels = a.map((channel, index) => Math.round(channel + ((b[index] ?? 0) - channel) * amount))

    return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`
}

/** The color at an opacity (0 to 1), as CSS. */
export function withAlpha(hex: string, alpha: number): string {
    return `rgb(${parse(hex).join(' ')} / ${alpha})`
}

/** The relative luminance of WCAG 2: 0 for black, 1 for white. */
function luminance(hex: string): number {
    const [red, green, blue] = parse(hex).map(channel => {
        const value = channel / 255

        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    }) as [number, number, number]

    return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/** The contrast ratio of WCAG 2 between two colors: 1 (the same) to 21 (black on white). */
export function contrast(one: string, other: string): number {
    const [darker, lighter] = [luminance(one), luminance(other)].sort((a, b) => a - b) as [number, number]

    return (lighter + 0.05) / (darker + 0.05)
}
