import { afterAll, beforeAll, expect, test } from 'bun:test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { OVERSCAN, rowForKey, rowWindow, scrollToRow, type TableColumn } from './table.ts'
import UiTable from './UiTable.vue'

test('the rows drawn are those in view, and a few either side, never past either end', () => {
    expect(rowWindow(0, 280, 28, 10_000)).toEqual({ start: 0, end: 10 + OVERSCAN })
    expect(rowWindow(2800, 280, 28, 10_000)).toEqual({ start: 100 - OVERSCAN, end: 110 + OVERSCAN })
    expect(rowWindow(14, 280, 28, 10_000)).toEqual({ start: 0, end: 11 + OVERSCAN })
    expect(rowWindow(279_720, 280, 28, 10_000)).toEqual({ start: 9990 - OVERSCAN, end: 10_000 })
    expect(rowWindow(0, 280, 28, 3)).toEqual({ start: 0, end: 3 })
    expect(rowWindow(0, 280, 28, 0)).toEqual({ start: 0, end: 0 })
})

test('a row is scrolled to only when it is not already in view, and by as little as will do', () => {
    expect(scrollToRow(5, 0, 280, 28)).toBe(0)
    expect(scrollToRow(10, 0, 280, 28)).toBe(28)
    expect(scrollToRow(3, 280, 280, 28)).toBe(84)
    expect(scrollToRow(0, 0, 10, 28)).toBe(0)
})

test('the keys move the selection, and stop at either end', () => {
    expect(rowForKey('ArrowDown', 4, 100, 10)).toBe(5)
    expect(rowForKey('ArrowUp', 4, 100, 10)).toBe(3)
    expect(rowForKey('ArrowUp', 0, 100, 10)).toBe(0)
    expect(rowForKey('PageDown', 95, 100, 10)).toBe(99)
    expect(rowForKey('PageUp', 4, 100, 10)).toBe(0)
    expect(rowForKey('Home', 50, 100, 10)).toBe(0)
    expect(rowForKey('End', 50, 100, 10)).toBe(99)
    expect(rowForKey('a', 50, 100, 10)).toBeUndefined()
    expect(rowForKey('ArrowDown', -1, 0, 10)).toBeUndefined()
})

test('with nothing selected, a key down starts at the top and a key up at the bottom', () => {
    expect(rowForKey('ArrowDown', -1, 100, 10)).toBe(0)
    expect(rowForKey('PageDown', -1, 100, 10)).toBe(0)
    expect(rowForKey('Home', -1, 100, 10)).toBe(0)
    expect(rowForKey('ArrowUp', -1, 100, 10)).toBe(99)
    expect(rowForKey('PageUp', -1, 100, 10)).toBe(99)
    expect(rowForKey('End', -1, 100, 10)).toBe(99)
})

interface Row {
    id: number
    name: string
}

const ROWS: Row[] = Array.from({ length: 10_000 }, (_, index) => ({ id: index + 1, name: `row ${index + 1}` }))
const COLUMNS: TableColumn<Row>[] = [
    { key: 'id', label: 'id', text: row => String(row.id), align: 'end' },
    { key: 'name', label: 'name', text: row => row.name },
]

// happy-dom lays nothing out: every element is given the height a browser would give the table's box, which it
// reads as it is mounted.
beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { value: 280, configurable: true })
})

afterAll(() => {
    delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight
})

// The height is read once the table is in the page, and the rows it shows follow on the next tick.
async function mountTable(selected?: number) {
    const wrapper = mount(UiTable<Row>, {
        props: { columns: COLUMNS, rows: ROWS, rowKey: row => row.id, rowHeight: 28, selected },
        attachTo: document.body,
    })
    await nextTick()
    return wrapper
}

function shownIds(wrapper: VueWrapper): number[] {
    return wrapper.findAll('.ui-table-shown .ui-table-row').map(row => Number(row.find('.ui-table-cell').text()))
}

test('a table draws its header, and only the rows in view of its ten thousand', async () => {
    const wrapper = await mountTable()

    expect(wrapper.findAll('[role="columnheader"]').map(cell => cell.text())).toEqual(['id', 'name'])
    expect(wrapper.attributes('aria-rowcount')).toBe('10001')
    expect(wrapper.find('.ui-table-body').attributes('style')).toContain('height: 280000px')
    expect(shownIds(wrapper)).toEqual(Array.from({ length: 10 + OVERSCAN }, (_, index) => index + 1))

    wrapper.unmount()
})

test('a scroll draws the rows that come into view', async () => {
    const wrapper = await mountTable()

    wrapper.element.scrollTop = 2800
    await wrapper.trigger('scroll')

    expect(shownIds(wrapper)[0]).toBe(101 - OVERSCAN)
    expect(shownIds(wrapper)).toContain(110)
    expect(wrapper.find('.ui-table-shown').attributes('style')).toContain(`translateY(${(100 - OVERSCAN) * 28}px)`)

    wrapper.unmount()
})

test('a click selects a row, and Enter and a double click activate it', async () => {
    const wrapper = await mountTable()
    const third = () => wrapper.findAll('.ui-table-shown .ui-table-row')[2]!

    await third().trigger('click')

    expect(wrapper.emitted('update:selected')).toEqual([[3]])

    await wrapper.setProps({ selected: 3 })

    expect(third().classes()).toContain('ui-table-selected')
    expect(third().attributes('aria-selected')).toBe('true')
    expect(wrapper.attributes('aria-activedescendant')).toBe(third().attributes('id'))

    await wrapper.trigger('keydown', { key: 'Enter' })
    await third().trigger('dblclick')

    expect(wrapper.emitted('activate')).toEqual([[ROWS[2]], [ROWS[2]]])

    wrapper.unmount()
})

test('the keyboard moves the selection, and scrolls to the row it moves to', async () => {
    const wrapper = await mountTable(1)

    await wrapper.trigger('keydown', { key: 'End' })
    await wrapper.setProps({ selected: 10_000 })

    expect(wrapper.emitted('update:selected')).toEqual([[10_000]])
    expect(wrapper.element.scrollTop).toBe(10_000 * 28 - 280)
    expect(shownIds(wrapper)).toContain(10_000)
    expect(shownIds(wrapper)).not.toContain(1)

    await wrapper.trigger('keydown', { key: 'ArrowUp' })
    await wrapper.setProps({ selected: 9999 })
    await wrapper.trigger('keydown', { key: 'Home' })
    await wrapper.setProps({ selected: 1 })

    expect(wrapper.emitted('update:selected')).toEqual([[10_000], [9999], [1]])
    expect(wrapper.element.scrollTop).toBe(0)
    expect(shownIds(wrapper)[0]).toBe(1)

    wrapper.unmount()
})

test('an empty table shows its header and no rows, and a key does nothing', async () => {
    const wrapper = mount(UiTable<Row>, { props: { columns: COLUMNS, rows: [], rowKey: row => row.id } })

    await wrapper.trigger('keydown', { key: 'ArrowDown' })

    expect(wrapper.findAll('[role="columnheader"]')).toHaveLength(2)
    expect(wrapper.findAll('.ui-table-shown .ui-table-row')).toHaveLength(0)
    expect(wrapper.emitted('update:selected')).toBeUndefined()
})
