import { expect, test } from 'bun:test'
import { mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import type { ServiceView } from '../app/service-view.ts'
import type { RecordEnvelope } from '../app/session.ts'
import type { ViewSort } from '../app/setup.ts'
import RecordsViewer from './RecordsViewer.vue'

// What the viewer uses of a view: its path, its ID field, the records it holds, its selection and its sort
function fakeView(idField = 'id') {
    const view = reactive({
        path: 'messages',
        idField,
        selectedId: null as string | null,
        sort: { by: 'last-changed' } as ViewSort,
        records: [] as RecordEnvelope[],
        get selected(): RecordEnvelope | undefined {
            return view.records.find(record => record.id === view.selectedId)
        },
        record(id: string) {
            return view.records.find(record => record.id === id)
        },
        select(id: string | null) {
            view.selectedId = id
        },
        setSort(sort: ViewSort) {
            view.sort = sort
        },
    })

    return view
}

const envelopes = (...raws: Record<string, unknown>[]) =>
    raws.map(raw => ({ id: String(raw.id), raw }) satisfies RecordEnvelope)

function mountViewer(view: ReturnType<typeof fakeView>, records: RecordEnvelope[]) {
    view.records = records

    return mount(RecordsViewer, { props: { view: view as unknown as ServiceView, records } })
}

const headers = (wrapper: ReturnType<typeof mountViewer>) =>
    wrapper.findAll('[role="columnheader"]').map(cell => cell.text())
const rows = (wrapper: ReturnType<typeof mountViewer>) => wrapper.findAll('.ui-table-shown [role="row"]')

test('a column per field, the ID field first, each value shown by the type of the field’s first value', () => {
    const wrapper = mountViewer(
        fakeView(),
        envelopes({ text: 'Hello', id: 1, at: null }, { id: 2, text: 'Bye', at: '2026-10-20', read: 'no' }),
    )

    expect(headers(wrapper)).toEqual(['id', 'text', 'at', 'read'])
    expect(rows(wrapper).map(row => row.findAll('[role="gridcell"]').map(cell => cell.text()))).toEqual([
        ['1', 'Hello', 'null', 'missing'],
        ['2', 'Bye', '2026-10-20', 'no'],
    ])
    expect(wrapper.find('[role="gridcell"]').classes()).toContain('ui-table-end')
})

test('a value not of its column’s type is marked', () => {
    const wrapper = mountViewer(fakeView(), envelopes({ id: 1, count: 3 }, { id: 2, count: 'three' }))

    expect(wrapper.findAll('.record-cell-mismatch').map(cell => cell.text())).toEqual(['three'])
})

test('the columns follow the records as they change', async () => {
    const wrapper = mountViewer(fakeView(), envelopes({ id: 1 }))

    expect(headers(wrapper)).toEqual(['id'])
    await wrapper.setProps({ records: envelopes({ id: 1 }, { id: 2, text: 'new' }) })
    expect(headers(wrapper)).toEqual(['id', 'text'])
})

test('the row selected is the view’s selection, both ways', async () => {
    const view = fakeView()
    const wrapper = mountViewer(view, envelopes({ id: 1 }, { id: 2 }))

    await rows(wrapper)[1]!.trigger('click')
    expect(view.selectedId).toBe('2')

    view.select('1')
    await nextTick()
    expect(rows(wrapper).map(row => row.attributes('aria-selected'))).toEqual(['true', 'false'])

    view.select(null)
    await nextTick()
    expect(rows(wrapper).map(row => row.attributes('aria-selected'))).toEqual(['false', 'false'])
})

test('a click on a header sorts by its column, and again the other way; another column starts ascending', async () => {
    const view = fakeView()
    const wrapper = mountViewer(view, envelopes({ id: 1, text: 'a' }))
    const sortBy = (index: number) => wrapper.findAll('.ui-table-sort')[index]!.trigger('click')

    await sortBy(1)
    expect(view.sort).toEqual({ by: 'field', field: 'text', descending: false })
    await sortBy(1)
    expect(view.sort).toEqual({ by: 'field', field: 'text', descending: true })
    await sortBy(0)
    expect(view.sort).toEqual({ by: 'field', field: 'id', descending: false })
})

test('the column sorted by is marked, and the rows are shown as given, the columns as the records are held', async () => {
    const view = fakeView()
    const records = envelopes({ id: 1, a: 'x' }, { id: 2, b: 'y' })
    const wrapper = mount(RecordsViewer, {
        props: { view: view as unknown as ServiceView, records, rows: [records[1]!, records[0]!] },
    })

    expect(headers(wrapper)).toEqual(['id', 'a', 'b'])
    expect(rows(wrapper).map(row => row.find('[role="gridcell"]').text())).toEqual(['2', '1'])
    expect(wrapper.findAll('[aria-sort]')).toHaveLength(0)

    view.setSort({ by: 'field', field: 'a', descending: true })
    await nextTick()
    expect(wrapper.findAll('[role="columnheader"]').map(cell => cell.attributes('aria-sort'))).toEqual([
        undefined,
        'descending',
        undefined,
    ])
})

test('Delete or Backspace asks for the selected record to be removed, when the view holds it', async () => {
    const view = fakeView()
    const wrapper = mountViewer(view, envelopes({ id: 1 }, { id: 2 }))
    const grid = wrapper.find('[role="grid"]')

    await grid.trigger('keydown', { key: 'Delete' })
    expect(wrapper.emitted('remove')).toBeUndefined()

    view.select('2')
    await grid.trigger('keydown', { key: 'Delete' })
    await grid.trigger('keydown', { key: 'Backspace' })
    expect(wrapper.emitted('remove')).toEqual([['2'], ['2']])

    view.select('9')
    await grid.trigger('keydown', { key: 'Delete' })
    expect(wrapper.emitted('remove')).toHaveLength(2)
})
