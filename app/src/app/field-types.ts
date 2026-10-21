// The field types: each an object that the table, the fields dialog and the new-record template ask, so adding a type
// is adding an object to the list. For now a type shows a value, gives the text a search finds it by, compares two, and
// gives a new record's value; how it guesses comes with the step that needs it. A value is shown as text, never as markup: the record's content is the server's.
import type { FieldType } from './setup.ts'

/**
 * A value as a cell shows it. `none`: there is no value, null or missing, and `text` says which. `mismatch`: the
 * value is not of the field's type, and is shown as what it is.
 */
export interface Shown {
    text: string
    tone?: 'none' | 'mismatch'
}

export interface FieldTypeDefinition {
    name: FieldType
    label: string
    /** Its values line up on the right, as numbers do. */
    alignEnd?: boolean
    /** `value` as a cell shows it, or `undefined` when it is not of this type. Never given null or a missing value. */
    show(value: unknown): Shown | undefined
    /** `value` as a tooltip shows it, more of it than a cell: as `show()` when unset. Only given a value of this type. */
    showFull?(value: unknown): string
    /** The text a search finds `value` by: what a cell would show with room for all of it. As `show()` when unset. */
    search?(value: unknown): string
    /** Below zero when `a` sorts before `b`, above when after, zero when neither. Only given values of this type. */
    compare(a: unknown, b: unknown): number
    /** The value a new record starts with. A new one each call, so an object or an array is not shared. */
    initial(): unknown
}

/** A cell's text is cut short at this: past it, a value is not seen in a column anyway. */
export const SHOWN_LENGTH = 200

/** A tooltip's text is cut short at this many characters, or at this many lines. */
export const FULL_LENGTH = 2000
export const FULL_LINES = 40

// Strings are compared as a reader would: "item 2" before "item 10", and "a" with "A"
const collator = new Intl.Collator(undefined, { numeric: true })

function order(a: number | string, b: number | string): number {
    return a < b ? -1 : a > b ? 1 : 0
}

function cut(text: string): string {
    return text.length > SHOWN_LENGTH ? `${text.slice(0, SHOWN_LENGTH - 1)}…` : text
}

function cutFull(text: string): string {
    const lines = text.slice(0, FULL_LENGTH + 1).split('\n')
    const kept = lines.length > FULL_LINES ? `${lines.slice(0, FULL_LINES).join('\n')}\n…` : lines.join('\n')
    return kept.length > FULL_LENGTH ? `${kept.slice(0, FULL_LENGTH - 1)}…` : kept
}

const string: FieldTypeDefinition = {
    name: 'string',
    label: 'String',
    show: value => {
        if (typeof value !== 'string') return undefined
        if (value === '') return { text: 'empty', tone: 'none' }

        // A cell is one line: a line break is shown as a mark, so the lines after it are not lost from view.
        return { text: cut(value.slice(0, SHOWN_LENGTH * 2).replace(/\r?\n/g, '⏎')) }
    },
    showFull: value => cutFull((value as string).replace(/\r\n/g, '\n')),
    search: value => value as string,
    compare: (a, b) => collator.compare(a as string, b as string),
    initial: () => '',
}

const number: FieldTypeDefinition = {
    name: 'number',
    label: 'Number',
    alignEnd: true,
    show: value => (typeof value === 'number' ? { text: String(value) } : undefined),
    compare: (a, b) => order(a as number, b as number),
    initial: () => 0,
}

const boolean: FieldTypeDefinition = {
    name: 'boolean',
    label: 'Boolean',
    show: value => (typeof value === 'boolean' ? { text: String(value) } : undefined),
    // false first
    compare: (a, b) => Number(a) - Number(b),
    initial: () => false,
}

/**
 * A date is an ISO string or milliseconds since 1970, and is shown in local time, to the second. A day alone is shown
 * as it is: JavaScript takes it for midnight in UTC, which is the day before in the Americas.
 */
const date: FieldTypeDefinition = {
    name: 'date',
    label: 'Date',
    show: value => {
        if (typeof value !== 'string' && typeof value !== 'number') return undefined
        if (typeof value === 'string' && !ISO_DATE.test(value)) return undefined

        const time = new Date(value)
        if (Number.isNaN(time.getTime())) return undefined
        return { text: typeof value === 'string' && value.length === 10 ? value : localTime(time) }
    },
    // By the time, whether ISO or milliseconds
    compare: (a, b) => order(new Date(a as string).getTime(), new Date(b as string).getTime()),
    // Now, as an ISO string: what JSON carries a date as
    initial: () => new Date().toISOString(),
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/

function localTime(time: Date): string {
    const two = (n: number) => String(n).padStart(2, '0')
    const day = `${time.getFullYear()}-${two(time.getMonth() + 1)}-${two(time.getDate())}`
    return `${day} ${two(time.getHours())}:${two(time.getMinutes())}:${two(time.getSeconds())}`
}

const object: FieldTypeDefinition = {
    name: 'object',
    label: 'Object',
    show: value =>
        typeof value === 'object' && value !== null && !Array.isArray(value) ? { text: summary(value) } : undefined,
    showFull: value => cutFull(JSON.stringify(value, null, 2)),
    search: value => valuesOf(value).join('\n'),
    compare: (a, b) => collator.compare(summary(a as object), summary(b as object)),
    initial: () => ({}),
}

const array: FieldTypeDefinition = {
    name: 'array',
    label: 'Array',
    show: value => (Array.isArray(value) ? { text: summary(value) } : undefined),
    showFull: value => cutFull(JSON.stringify(value, null, 2)),
    search: value => valuesOf(value).join('\n'),
    compare: (a, b) => collator.compare(summary(a as object), summary(b as object)),
    initial: () => [],
}

/**
 * An object or an array to one level: `{ name: "Ann", tags: […] }`. It stops once past the length a cell shows, so a
 * large value costs no more than a small one.
 */
function summary(value: object): string {
    const isArray = Array.isArray(value)
    const entries = isArray ? value.entries() : Object.entries(value).values()
    const parts: string[] = []
    let length = 0

    for (const [key, item] of entries) {
        if (length > SHOWN_LENGTH) {
            parts.push('…')
            break
        }
        const part = isArray ? inner(item) : `${key}: ${inner(item)}`
        parts.push(part)
        length += part.length + 2
    }

    const [open, close] = isArray ? ['[', ']'] : ['{', '}']
    return parts.length === 0 ? `${open}${close}` : cut(`${open} ${parts.join(', ')} ${close}`)
}

/** Every value inside an object or an array, to the end, as written; not its keys, nor a null. */
function valuesOf(value: unknown, values: string[] = []): string[] {
    if (Array.isArray(value)) {
        for (const item of value) valuesOf(item, values)
    } else if (typeof value === 'object' && value !== null) {
        for (const item of Object.values(value)) valuesOf(item, values)
    } else if (value !== null && value !== undefined && value !== '') {
        values.push(String(value))
    }

    return values
}

/** A value inside an object or an array: a nested one only as its brackets. */
function inner(value: unknown): string {
    if (Array.isArray(value)) return value.length === 0 ? '[]' : '[…]'
    if (typeof value === 'object' && value !== null) return Object.keys(value).length === 0 ? '{}' : '{…}'
    if (typeof value === 'string') return JSON.stringify(value.length > 40 ? `${value.slice(0, 39)}…` : value)
    return String(value)
}

/** The built-in types, in the order the fields dialog lists them. */
export const FIELD_TYPES: readonly FieldTypeDefinition[] = [string, number, boolean, date, object, array]

export function fieldType(name: FieldType): FieldTypeDefinition {
    return FIELD_TYPES.find(type => type.name === name) ?? string
}

// The type a value is shown as when it is not of its field's: a date is a string to JavaScript.
const BY_VALUE = [string, number, boolean, array, object]

/** A field's value as a cell shows it, by the field's type. */
export function showValue(value: unknown, type: FieldTypeDefinition): Shown {
    if (value === undefined) return { text: 'missing', tone: 'none' }
    if (value === null) return { text: 'null', tone: 'none' }

    const shown = type.show(value)
    if (shown) return shown

    const own = BY_VALUE.map(other => other.show(value)).find(other => other !== undefined)
    return { text: own?.text ?? String(value), tone: 'mismatch' }
}

/**
 * A field's value as a tooltip shows it: what a cell has no room for, a string's lines and an object's or an array's
 * every level, as indented JSON. Asked only on a hover, since it reads the whole value.
 */
export function showFullValue(value: unknown, type: FieldTypeDefinition): string {
    const shown = showValue(value, type)
    if (shown.tone === 'none') return shown.text

    const own = type.show(value) ? type : BY_VALUE.find(other => other.show(value))
    return own?.showFull?.(value) ?? shown.text
}

/**
 * The text a search finds a field's value by: what its cell shows, as if it had room for all of it. A string whole,
 * an object's or an array's every value, a date as shown; null, missing and empty as the words the cell shows.
 */
export function searchValue(value: unknown, type: FieldTypeDefinition): string {
    const shown = showValue(value, type)
    if (shown.tone === 'none') return shown.text

    const own = type.show(value) ? type : BY_VALUE.find(other => other.show(value))
    return own?.search?.(value) ?? shown.text
}

// Where a value sorts, whichever the direction: one of the field's type, then one that is not, then null, then missing
function rank(value: unknown, type: FieldTypeDefinition): number {
    if (value === undefined) return 3
    if (value === null) return 2
    return type.show(value) ? 0 : 1
}

/**
 * Two values of a field, as a sort by it orders them: by the field's type, with a value not of it after those that
 * are, by what it is, then null, then missing. `descending` reverses the values, and leaves those without one last.
 */
export function compareValues(a: unknown, b: unknown, type: FieldTypeDefinition, descending = false): number {
    const rankA = rank(a, type)
    const rankB = rank(b, type)

    if (rankA !== rankB) return rankA - rankB
    if (rankA >= 2) return 0

    let compared: number

    if (rankA === 0) {
        compared = type.compare(a, b)
    } else {
        const ownA = BY_VALUE.findIndex(other => other.show(a))
        const ownB = BY_VALUE.findIndex(other => other.show(b))

        compared = ownA !== ownB ? ownA - ownB : (BY_VALUE[ownA]?.compare(a, b) ?? 0)
    }

    return descending ? -compared : compared
}
