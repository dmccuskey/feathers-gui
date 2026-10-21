import { expect, test } from 'bun:test'
import { mount } from '@vue/test-utils'
import { fieldType } from '../app/field-types.ts'
import RecordCell from './RecordCell.vue'

test('a cell shows its value by the field’s type, and marks no value and a value not of the type', () => {
    const cell = (value: unknown) => mount(RecordCell, { props: { value, type: fieldType('number') } })

    const plain = cell(7)
    expect(plain.text()).toBe('7')
    expect(plain.classes()).toEqual(['record-cell'])

    const none = cell(null)
    expect(none.text()).toBe('null')
    expect(none.classes()).toEqual(['record-cell', 'record-cell-none'])

    const mismatch = cell('7')
    expect(mismatch.text()).toBe('7')
    expect(mismatch.classes()).toEqual(['record-cell', 'record-cell-mismatch'])
})

test('a tooltip, made on a hover, has what the cell has no room for, and says when the type is not the field’s', async () => {
    const hover = async (value: unknown, type: Parameters<typeof fieldType>[0]) => {
        const cell = mount(RecordCell, { props: { value, type: fieldType(type) } })
        await cell.trigger('mouseenter')
        return cell.attributes('title')
    }

    expect(await hover('Ann', 'string')).toBeUndefined()
    expect(await hover(7, 'number')).toBeUndefined()
    expect(await hover(null, 'object')).toBeUndefined()
    expect(await hover('one\ntwo', 'string')).toBe('one\ntwo')
    expect(await hover({ a: 1 }, 'object')).toBe('{\n  "a": 1\n}')
    expect(await hover('7', 'number')).toBe('Not of the field’s type, number')
    expect(await hover({ a: 1 }, 'string')).toBe('Not of the field’s type, string\n\n{\n  "a": 1\n}')
})
