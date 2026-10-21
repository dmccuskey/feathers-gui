import { expect, test } from 'bun:test'
import { fieldType } from './field-types.ts'
import { REASONS_SHOWN, reasonsOf, readRecord, recordTemplate } from './new-record.ts'

test('a template has every column but the ID field, each with its type’s first value', () => {
    const columns = [
        { name: 'id', type: fieldType('number') },
        { name: 'text', type: fieldType('string') },
        { name: 'likes', type: fieldType('number') },
        { name: 'tags', type: fieldType('array') },
    ]

    expect(recordTemplate(columns, 'id')).toEqual({ text: '', likes: 0, tags: [] })
    expect(recordTemplate([], undefined)).toEqual({})
})

test('a record is read from JSON text, and is to be an object', () => {
    expect(readRecord('{ "text": "Hi" }')).toEqual({ record: { text: 'Hi' } })
    expect(readRecord('{ "text": ')).toEqual({ error: expect.stringMatching(/^Not JSON: /) })
    for (const text of ['[]', 'null', '"text"', '3']) {
        expect(readRecord(text)).toEqual({ error: 'A record is a JSON object, in braces.' })
    }
})

test('the server’s reasons are a line each, from a schema’s list or an object by field', () => {
    expect(
        reasonsOf([
            { instancePath: '/title', message: 'must be string' },
            { instancePath: '/tags/0', message: 'must be string' },
            { instancePath: '', message: "must have required property 'title'" },
            { instancePath: '', message: 'must NOT have additional properties', params: { additionalProperty: 'at' } },
            'plain',
        ]),
    ).toEqual([
        'title must be string',
        'tags.0 must be string',
        "must have required property 'title'",
        'must NOT have additional properties: at',
        'plain',
    ])
    expect(reasonsOf({ title: { message: 'Path `title` is required.' }, done: 'must be a boolean' })).toEqual([
        'title: Path `title` is required.',
        'done: must be a boolean',
    ])
    expect(reasonsOf(undefined)).toEqual([])
    expect(reasonsOf('text')).toEqual([])

    const many = reasonsOf(Array.from({ length: 20 }, (_, i) => ({ path: `f${i}`, message: 'bad' })))

    expect(many).toHaveLength(REASONS_SHOWN)
    expect(many.at(-1)).toBe('…')
})
