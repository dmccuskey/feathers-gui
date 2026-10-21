import { expect, test } from 'bun:test'
import { columnsOf, fieldTypeOf, guessType } from './columns.ts'
import type { FieldSetup } from './setup.ts'

const records = (...raws: Record<string, unknown>[]) => raws.map((raw, index) => ({ id: String(index), raw }))
const shape = (columns: ReturnType<typeof columnsOf>) => columns.map(column => `${column.name}:${column.type.name}`)

test('a value’s type is guessed: a number before a date, a date before a string', () => {
    expect(guessType(7).name).toBe('number')
    expect(guessType(true).name).toBe('boolean')
    expect(guessType('2026-10-20T10:00:00Z').name).toBe('date')
    expect(guessType('2026-10-20').name).toBe('date')
    expect(guessType('Ann').name).toBe('string')
    expect(guessType([1]).name).toBe('array')
    expect(guessType({ a: 1 }).name).toBe('object')
    expect(guessType(null).name).toBe('string')
    expect(guessType(undefined).name).toBe('string')
})

test('the ID field comes first, then the fields in the order first seen', () => {
    const columns = columnsOf(records({ text: 'a', id: 1 }, { id: 2, read: true, text: 'b' }), 'id')

    expect(shape(columns)).toEqual(['id:number', 'text:string', 'read:boolean'])
})

test('a field’s type is its first value that is not null, in any record', () => {
    const columns = columnsOf(records({ _id: 'a', at: null }, { _id: 'b' }, { _id: 'c', at: 1_700_000_000_000 }), '_id')

    expect(shape(columns)).toEqual(['_id:string', 'at:number'])
})

test('a field that is only ever null is a string', () => {
    expect(shape(columnsOf(records({ id: 1, gone: null }), 'id'))).toEqual(['id:number', 'gone:string'])
})

test('no records: only the ID field, when known', () => {
    expect(shape(columnsOf([], 'id'))).toEqual(['id:string'])
    expect(columnsOf([], undefined)).toEqual([])
})

test('the setup’s fields come after the ID field, in its order and with its types; a hidden one is left out', () => {
    const fields: FieldSetup[] = [
        { name: 'read', show: true, type: 'string', typePicked: true },
        { name: 'secret', show: false, type: 'string', typePicked: false },
        { name: 'missing', show: true, type: 'date', typePicked: false },
    ]
    const columns = columnsOf(records({ id: 1, text: 'a', secret: 'x', read: false }), 'id', fields)

    expect(shape(columns)).toEqual(['id:number', 'read:string', 'missing:date', 'text:string'])
})

test('one field’s type: the setup’s, or else its first value that is not null', () => {
    const held = records({ id: 1, at: null }, { id: 2, at: '2026-10-20' })

    expect(fieldTypeOf(held, 'at').name).toBe('date')
    expect(fieldTypeOf(held, 'at', [{ name: 'at', show: true, type: 'string', typePicked: true }]).name).toBe('string')
    expect(fieldTypeOf(held, 'gone').name).toBe('string')
})
