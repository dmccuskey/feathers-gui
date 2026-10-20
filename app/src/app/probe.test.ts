import { expect, test } from 'bun:test'
import { guessIdField, probe, type ProbeService, type RawRecord } from './probe.ts'

type Kind =
    | 'paginated' // a database adapter with pagination: pages, and counts
    | 'plain' // a database adapter without pagination: applies $limit, does not count
    | 'ignores' // a hand-written service that ignores $limit
    | 'field' // a hand-written service that takes $limit for a field, and answers it with nothing

interface Fake extends ProbeService {
    /** The calls made, in order: the limit of each `findPage`, `'find'` for each `find`. */
    calls: (number | 'find')[]
}

/** A service of `kind` over `records`. A paginated one applies at most `max` as the limit. */
function fakeService(kind: Kind, records: RawRecord[], max = 1000): Fake {
    const calls: (number | 'find')[] = []

    return {
        calls,
        async findPage(limit) {
            calls.push(limit)
            switch (kind) {
                case 'paginated':
                    return { records: records.slice(0, Math.min(limit, max)), total: records.length }
                case 'plain':
                    return { records: records.slice(0, limit), total: undefined }
                case 'ignores':
                    return { records: [...records], total: undefined }
                case 'field':
                    return { records: [], total: undefined }
            }
        },
        async find() {
            calls.push('find')

            return [...records]
        },
    }
}

function numbered(count: number): RawRecord[] {
    return Array.from({ length: count }, (_, i) => ({ id: i + 1, text: `record ${i + 1}` }))
}

const idsOf = (records: RawRecord[]): unknown[] => records.map(record => record.id)

test('a service that pages and counts: the total, and a first page', async () => {
    const service = fakeService('paginated', numbered(60))
    const result = await probe(service, 10)

    expect(result.total).toBe(60)
    expect(idsOf(result.records)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(result.isWhole).toBe(false)
    expect(result.knowsLimit).toBe(true)
    expect(service.calls).toEqual([0, 10])
})

test('a service that pages and counts, with fewer records than a page: they are all in hand', async () => {
    const result = await probe(fakeService('paginated', numbered(4)), 10)

    expect(result.total).toBe(4)
    expect(result.records).toHaveLength(4)
    expect(result.isWhole).toBe(true)
})

test('a service whose maximum is under the size asked for: its page, not whole', async () => {
    const result = await probe(fakeService('paginated', numbered(60), 5), 10)

    expect(result.records).toHaveLength(5)
    expect(result.total).toBe(60)
    expect(result.isWhole).toBe(false)
})

test('an empty service that counts: one call', async () => {
    const service = fakeService('paginated', [])
    const result = await probe(service, 10)

    expect(result).toEqual({ records: [], total: 0, isWhole: true, knowsLimit: true })
    expect(service.calls).toEqual([0])
})

test('a service that applies the limit without counting: a first page, and no total', async () => {
    const service = fakeService('plain', numbered(60))
    const result = await probe(service, 10)

    expect(result.total).toBeUndefined()
    expect(result.records).toHaveLength(10)
    expect(result.isWhole).toBe(false)
    expect(result.knowsLimit).toBe(true)
    expect(service.calls).toEqual([0, 10])
})

test('a service that applies the limit, with fewer records than a page: they are all in hand', async () => {
    const result = await probe(fakeService('plain', numbered(4)), 10)

    expect(result.records).toHaveLength(4)
    expect(result.isWhole).toBe(true)
    expect(result.total).toBeUndefined()
})

test('a service that ignores the limit: every record from the first call, counted', async () => {
    const service = fakeService('ignores', numbered(60))
    const result = await probe(service, 10)

    expect(result).toEqual({ records: numbered(60), total: 60, isWhole: true, knowsLimit: false })
    expect(service.calls).toEqual([0])
})

test('a service that takes the limit for a field: every record by find() with no query', async () => {
    const service = fakeService('field', numbered(60))
    const result = await probe(service, 10)

    expect(result).toEqual({ records: numbered(60), total: 60, isWhole: true, knowsLimit: false })
    expect(service.calls).toEqual([0, 10, 'find'])
})

test('an empty service that does not count: empty, and whether it knows the limit is not known', async () => {
    const result = await probe(fakeService('plain', []), 10)

    expect(result).toEqual({ records: [], total: 0, isWhole: true, knowsLimit: undefined })
})

test('a failed read is handed on', async () => {
    const service = fakeService('paginated', numbered(3))

    service.findPage = async () => {
        throw new Error('Not authenticated')
    }

    await expect(probe(service)).rejects.toThrow('Not authenticated')
})

test('the ID field: id is preferred to _id', () => {
    expect(
        guessIdField([
            { _id: 'a', id: 1 },
            { _id: 'b', id: 2 },
        ]),
    ).toBe('id')
})

test('the ID field: _id when id is not on every record', () => {
    expect(guessIdField([{ _id: 'a', id: 1 }, { _id: 'b' }])).toBe('_id')
})

test('the ID field: _id when the values of id repeat', () => {
    expect(
        guessIdField([
            { _id: 'a', id: 1 },
            { _id: 'b', id: 1 },
        ]),
    ).toBe('_id')
})

test('the ID field: no other field is taken, however different its values', () => {
    expect(
        guessIdField([
            { uuid: 'x1', name: 'A' },
            { uuid: 'x2', name: 'B' },
        ]),
    ).toBeUndefined()
})

test('the ID field: compared as strings, so 1 and "1" are the same', () => {
    expect(guessIdField([{ id: 1 }, { id: '1' }])).toBeUndefined()
})

test('the ID field: a value that is not a string or a number, or is empty, does not qualify', () => {
    expect(guessIdField([{ id: { $oid: 'a' } }, { id: { $oid: 'b' } }])).toBeUndefined()
    expect(guessIdField([{ id: null }, { id: 2 }])).toBeUndefined()
    expect(guessIdField([{ id: '' }, { id: 'b' }])).toBeUndefined()
})

test('the ID field: id, the default, from no records', () => {
    expect(guessIdField([])).toBe('id')
})
