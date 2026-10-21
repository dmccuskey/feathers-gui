import { afterAll, beforeAll, expect, test } from 'bun:test'
import {
    FIELD_TYPES,
    FULL_LENGTH,
    FULL_LINES,
    SHOWN_LENGTH,
    fieldType,
    showFullValue,
    showValue,
} from './field-types.ts'

const zone = process.env.TZ

beforeAll(() => {
    process.env.TZ = 'UTC'
})

afterAll(() => {
    process.env.TZ = zone
})

const show = (value: unknown, type: Parameters<typeof fieldType>[0]) => showValue(value, fieldType(type))

test('null and missing are told apart, whatever the type', () => {
    for (const type of FIELD_TYPES) {
        expect(showValue(null, type)).toEqual({ text: 'null', tone: 'none' })
        expect(showValue(undefined, type)).toEqual({ text: 'missing', tone: 'none' })
    }
})

test('a string is shown as it is, on one line, and cut short', () => {
    expect(show('Ann', 'string')).toEqual({ text: 'Ann' })
    expect(show('', 'string')).toEqual({ text: 'empty', tone: 'none' })
    expect(show('one\ntwo\r\nthree', 'string')).toEqual({ text: 'one⏎two⏎three' })

    const long = show('x'.repeat(10_000), 'string').text
    expect(long).toHaveLength(SHOWN_LENGTH)
    expect(long.endsWith('…')).toBe(true)
})

test('a number and a boolean are shown as JavaScript writes them', () => {
    expect(show(42, 'number')).toEqual({ text: '42' })
    expect(show(-0.5, 'number')).toEqual({ text: '-0.5' })
    expect(show(false, 'boolean')).toEqual({ text: 'false' })
    expect(fieldType('number').alignEnd).toBe(true)
})

test('a day alone is shown as it is, whatever the time zone', () => {
    process.env.TZ = 'America/Los_Angeles'
    expect(show('2026-10-20', 'date')).toEqual({ text: '2026-10-20' })
    expect(show('2026-10-20T00:00:00Z', 'date')).toEqual({ text: '2026-10-19 17:00:00' })
    process.env.TZ = 'UTC'
})

test('a date, as an ISO string or milliseconds, is shown in local time to the second', () => {
    expect(show('2026-10-01T12:34:56.789Z', 'date')).toEqual({ text: '2026-10-01 12:34:56' })
    expect(show('2026-10-01T12:34:56+02:00', 'date')).toEqual({ text: '2026-10-01 10:34:56' })
    expect(show(Date.UTC(2026, 9, 1, 8), 'date')).toEqual({ text: '2026-10-01 08:00:00' })
    expect(show('2026-10-01', 'date')).toEqual({ text: '2026-10-01' })
    expect(show('next Tuesday', 'date')).toEqual({ text: 'next Tuesday', tone: 'mismatch' })
    expect(show('2026-13-45', 'date')).toEqual({ text: '2026-13-45', tone: 'mismatch' })
})

test('an object or an array is summed up to one level', () => {
    expect(show({ name: 'Ann', age: 7, tags: ['a'], meta: {} }, 'object')).toEqual({
        text: '{ name: "Ann", age: 7, tags: […], meta: {} }',
    })
    expect(show({}, 'object')).toEqual({ text: '{}' })
    expect(show([1, 'two', null, { a: 1 }], 'array')).toEqual({ text: '[ 1, "two", null, {…} ]' })
    expect(show([], 'array')).toEqual({ text: '[]' })
})

test('a large object or array is cut short', () => {
    const many = Array.from({ length: 10_000 }, (_, index) => index)
    const text = show(many, 'array').text
    expect(text.length).toBeLessThanOrEqual(SHOWN_LENGTH)
    expect(text.endsWith('…')).toBe(true)

    expect(show({ note: 'y'.repeat(100) }, 'object').text).toBe(`{ note: "${'y'.repeat(39)}…" }`)
})

test('a value not of its field’s type is shown as what it is, and marked', () => {
    expect(show('7', 'number')).toEqual({ text: '7', tone: 'mismatch' })
    expect(show(7, 'string')).toEqual({ text: '7', tone: 'mismatch' })
    expect(show([1], 'object')).toEqual({ text: '[ 1 ]', tone: 'mismatch' })
    expect(show({ a: 1 }, 'array')).toEqual({ text: '{ a: 1 }', tone: 'mismatch' })
    expect(show(true, 'date')).toEqual({ text: 'true', tone: 'mismatch' })
})

const full = (value: unknown, type: Parameters<typeof fieldType>[0]) => showFullValue(value, fieldType(type))

test('a tooltip has a string’s lines, and an object or an array at every level', () => {
    expect(full('one\r\ntwo', 'string')).toBe('one\ntwo')
    expect(full({ a: { b: [1] } }, 'object')).toBe('{\n  "a": {\n    "b": [\n      1\n    ]\n  }\n}')
    expect(full([1], 'array')).toBe('[\n  1\n]')
    expect(full('2026-10-01T12:34:56Z', 'date')).toBe('2026-10-01 12:34:56')
    expect(full(7, 'number')).toBe('7')
    expect(full(null, 'object')).toBe('null')
    expect(full(undefined, 'string')).toBe('missing')
})

test('a value not of its field’s type has the tooltip of what it is', () => {
    expect(full({ a: 1 }, 'string')).toBe('{\n  "a": 1\n}')
    expect(full('x\ny', 'number')).toBe('x\ny')
})

test('a tooltip is cut short by its length, or by its lines', () => {
    const long = full('x'.repeat(10_000), 'string')
    expect(long).toHaveLength(FULL_LENGTH)
    expect(long.endsWith('…')).toBe(true)

    const many = full(
        Array.from({ length: 1000 }, (_, index) => index),
        'array',
    ).split('\n')
    expect(many).toHaveLength(FULL_LINES + 1)
    expect(many.at(-1)).toBe('…')
})
