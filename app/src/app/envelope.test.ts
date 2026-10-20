import { expect, test } from 'bun:test'
import { envelopeConversion } from './envelope.ts'

test('a record is kept as the server has it, under its ID as a string', () => {
    const raw = { _id: 7, id: 'its own', name: 'A' }

    expect(envelopeConversion('_id').read(raw)).toEqual({ id: '7', raw })
})

test('a record without the ID field is refused', () => {
    expect(() => envelopeConversion('id').read({ _id: 'a' })).toThrow('A record has no ID field `id`')
})

test('what is sent is the raw record, or the part of it a patch holds, and not the envelope', () => {
    const convert = envelopeConversion('id')

    expect(convert.write({ id: '1', raw: { id: 1, name: 'A' } })).toEqual({ id: 1, name: 'A' })
    expect(convert.write({ raw: { name: 'B' } })).toEqual({ name: 'B' })
})
