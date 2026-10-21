import { expect, test } from 'bun:test'
import { fieldType } from './field-types.ts'
import type { RecordEnvelope } from './session.ts'
import { sortRecords, type SortContext } from './sort.ts'

const envelopes = (idField: string, ...raws: Record<string, unknown>[]) =>
    raws.map(raw => ({ id: String(raw[idField]), raw }) satisfies RecordEnvelope)
const ids = (records: RecordEnvelope[]) => records.map(record => record.id)

function context(idField: string | undefined, changes: [string, number][] = []): SortContext {
    return { idField, typeOf: () => fieldType('number'), changes: new Map(changes) }
}

test('last changed: the records changed, the latest first, then the others in ID order', () => {
    const records = envelopes('id', { id: 3 }, { id: 10 }, { id: 1 }, { id: 2 })

    expect(ids(sortRecords(records, { by: 'last-changed' }, context('id')))).toEqual(['1', '2', '3', '10'])
    expect(
        ids(
            sortRecords(
                records,
                { by: 'last-changed' },
                context('id', [
                    ['3', 1],
                    ['10', 2],
                ]),
            ),
        ),
    ).toEqual(['10', '3', '1', '2'])
})

test('the ID order: numbers by value, before strings as they are, which keeps MongoDB IDs in the order made', () => {
    const records = envelopes('_id', { _id: '1a' }, { _id: '10' }, { _id: 7 })

    expect(ids(sortRecords(records, { by: 'last-changed' }, context('_id')))).toEqual(['7', '10', '1a'])
})

test('by a field, either way, with records of equal values in ID order', () => {
    const records = envelopes('id', { id: 3, n: 1 }, { id: 1, n: 2 }, { id: 2, n: 1 }, { id: 4 })

    expect(ids(sortRecords(records, { by: 'field', field: 'n', descending: false }, context('id')))).toEqual([
        '2',
        '3',
        '1',
        '4',
    ])
    expect(ids(sortRecords(records, { by: 'field', field: 'n', descending: true }, context('id')))).toEqual([
        '1',
        '2',
        '3',
        '4',
    ])
})

test('the records given are left as they are', () => {
    const records = envelopes('id', { id: 2 }, { id: 1 })

    sortRecords(records, { by: 'last-changed' }, context('id'))
    expect(ids(records)).toEqual(['2', '1'])
})
