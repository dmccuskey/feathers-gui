import { afterEach, beforeEach, expect, test } from 'bun:test'
import { columnsOf, type RecordColumn } from './columns.ts'
import { fieldType } from './field-types.ts'
import { foldText, recordText, searchRecords, searchWords, SearchTexts } from './search.ts'
import type { RecordEnvelope } from './session.ts'
import type { FieldType } from './setup.ts'

const envelopes = (...raws: Record<string, unknown>[]) =>
    raws.map(raw => ({ id: String(raw.id), raw }) satisfies RecordEnvelope)
const ids = (records: readonly RecordEnvelope[]) => records.map(record => record.id)
const columns = (types: Record<string, FieldType>): RecordColumn[] =>
    Object.entries(types).map(([name, type]) => ({ name, type: fieldType(type) }))

let zone: string | undefined

beforeEach(() => {
    zone = process.env.TZ
    process.env.TZ = 'UTC'
})

afterEach(() => {
    process.env.TZ = zone
})

test('a search is its words, folded: lower case and without accents', () => {
    expect(searchWords('  Ann  JOHNSON ')).toEqual(['ann', 'johnson'])
    expect(searchWords('Zoë Ångström')).toEqual(['zoe', 'angstrom'])
    expect(searchWords('   ')).toEqual([])
    expect(foldText('Café')).toBe('cafe')
})

test('a record has every word of the search, each anywhere in it, or it is not found', () => {
    const records = envelopes(
        { id: 1, name: 'Ann Johnson', role: 'admin' },
        { id: 2, name: 'Bob Johnson', role: 'user' },
        { id: 3, name: 'Ann Lee', role: 'admin' },
    )
    const texts = new SearchTexts(columnsOf(records, 'id'))

    expect(ids(searchRecords(records, 'johnson', texts))).toEqual(['1', '2'])
    expect(ids(searchRecords(records, 'ann admin', texts))).toEqual(['1', '3'])
    expect(ids(searchRecords(records, 'JOHN ADM', texts))).toEqual(['1'])
    expect(ids(searchRecords(records, 'ann bob', texts))).toEqual([])
})

test('a blank search finds every record, as the same array', () => {
    const records = envelopes({ id: 1 }, { id: 2 })

    expect(searchRecords(records, ' ', new SearchTexts(columnsOf(records, 'id')))).toBe(records)
})

test('a record is found by its shown columns only, and not by the names of its fields', () => {
    const [record] = envelopes({ id: 7, name: 'Ann', secret: 'hidden' })
    const text = recordText(record!, columns({ id: 'number', name: 'string' }))

    expect(text).toContain('7')
    expect(text).toContain('ann')
    expect(text).not.toContain('hidden')
    expect(text).not.toContain('name')
})

test('an object or an array is found by its every value, to the end, and not by its keys', () => {
    const [record] = envelopes({
        id: 1,
        author: { name: 'Ann', address: { city: 'Zürich', zip: 8001 } },
        tags: ['red', ['deep'], true],
    })
    const text = recordText(record!, columns({ author: 'object', tags: 'array' }))

    for (const word of ['ann', 'zurich', '8001', 'red', 'deep', 'true']) expect(text).toContain(word)
    for (const word of ['name', 'address', 'city', 'zip', '…']) expect(text).not.toContain(word)
})

test('a string is found whole, past what a cell has room for, with its line breaks', () => {
    const long = `${'x'.repeat(300)} needle\nsecond line`
    const text = recordText(envelopes({ id: 1, text: long })[0]!, columns({ text: 'string' }))

    expect(text).toContain('needle')
    expect(text).toContain('second line')
    expect(text).not.toContain('⏎')
})

test('a date is found as shown, in local time, and not as stored', () => {
    const [record] = envelopes({ id: 1, at: '2026-10-20T09:30:00+02:00' })
    const text = recordText(record!, columns({ at: 'date' }))

    expect(text).toContain('2026-10-20 07:30:00')
    expect(text).not.toContain('t09:30')
})

test('a value not of its field’s type is found as it is shown, as what it is', () => {
    const [record] = envelopes({ id: 1, at: 'soon', n: { a: 'deep' } })
    const text = recordText(record!, columns({ at: 'date', n: 'number' }))

    expect(text).toContain('soon')
    expect(text).toContain('deep')
})

test('null, missing and empty are found by the words the cell shows', () => {
    const records = envelopes({ id: 1, text: null }, { id: 2 }, { id: 3, text: '' }, { id: 4, text: 'Ann' })
    const texts = new SearchTexts(columns({ id: 'number', text: 'string' }))

    expect(ids(searchRecords(records, 'null', texts))).toEqual(['1'])
    expect(ids(searchRecords(records, 'missing', texts))).toEqual(['2'])
    expect(ids(searchRecords(records, 'empty', texts))).toEqual(['3'])
})

test('a word is not found across two values', () => {
    const records = envelopes({ id: 1, first: 'ann', last: 'lee' })

    expect(searchRecords(records, 'annlee', new SearchTexts(columnsOf(records, 'id')))).toEqual([])
})

test("a record's text is made once, and again for a record changed, which is a new envelope", () => {
    let made = 0
    const counted = { ...fieldType('string'), search: (value: unknown) => (made++, value as string) }
    const texts = new SearchTexts([{ name: 'name', type: counted }])
    const [record] = envelopes({ id: 1, name: 'Ann' })

    texts.of(record!)
    texts.of(record!)
    expect(made).toBe(1)

    expect(texts.of({ ...record!, raw: { id: 1, name: 'Bob' } })).toContain('bob')
    expect(made).toBe(2)
})
