<script setup lang="ts" generic="T">
// A table of rows of one height that draws only the rows in view, and a few either side: ten thousand rows are a
// few dozen in the page. Its header stays as the rows scroll under it. One row is selected, by a click or by the
// keyboard (the arrows, Page Up and Down, Home and End); Enter or a double click activates it. A sortable table's
// headers are buttons that ask for a sort; the rows come sorted, and the table only marks the column. It fills the
// box it is put in, and scrolls in it.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, useTemplateRef } from 'vue'
import { rowForKey, rowWindow, scrollToRow, type TableColumn } from './table.ts'

const props = withDefaults(
    defineProps<{
        columns: readonly TableColumn<T>[]
        rows: readonly T[]
        /** A row's own key, which the selection is kept by. */
        rowKey: (row: T) => PropertyKey
        /** In pixels: what the arithmetic of the rows in view takes. */
        rowHeight?: number
        /** What the table is named for a screen reader. */
        label?: string
        /** Whether a click on a header asks for a sort by its column. */
        sortable?: boolean
        /** The column the rows are sorted by, which its header marks. */
        sortKey?: string
        sortDescending?: boolean
    }>(),
    { rowHeight: 28, label: undefined, sortable: false, sortKey: undefined, sortDescending: false },
)

const emit = defineEmits<{
    /** Enter on the selected row, or a double click on a row. */
    activate: [row: T]
    /** A header clicked, of a sortable table: its column's key. */
    sort: [key: string]
}>()

/** The key of the row selected. */
const selected = defineModel<PropertyKey>('selected')

defineSlots<{
    /** A cell, in place of its column's text. */
    cell?: (props: { row: T; column: TableColumn<T>; text: string }) => unknown
}>()

const scroller = useTemplateRef<HTMLElement>('scroller')
const header = useTemplateRef<HTMLElement>('header')
const id = useId()

const scrollTop = ref(0)
// The height of the box, less the header's: what the rows are seen through.
const viewHeight = ref(0)

const start = computed(() => rowWindow(scrollTop.value, viewHeight.value, props.rowHeight, props.rows.length).start)
const end = computed(() => rowWindow(scrollTop.value, viewHeight.value, props.rowHeight, props.rows.length).end)
const shown = computed(() =>
    props.rows.slice(start.value, end.value).map((row, offset) => ({ row, index: start.value + offset })),
)

const selectedIndex = computed(() =>
    selected.value === undefined ? -1 : props.rows.findIndex(row => props.rowKey(row) === selected.value),
)

const tracks = computed(() => props.columns.map(column => `minmax(${column.width ?? '8rem'}, 1fr)`).join(' '))
const minWidth = computed(() => `calc(${props.columns.map(column => column.width ?? '8rem').join(' + ')})`)

const rowId = (index: number) => `${id}-row-${index}`
const activeId = computed(() => {
    const index = selectedIndex.value
    return index >= start.value && index < end.value ? rowId(index) : undefined
})

function measure(): void {
    const box = scroller.value
    if (!box) return
    viewHeight.value = Math.max(0, box.clientHeight - (header.value?.offsetHeight ?? 0))
    scrollTop.value = box.scrollTop
}

function onScroll(): void {
    scrollTop.value = scroller.value?.scrollTop ?? 0
}

function select(index: number): void {
    const box = scroller.value
    const row = props.rows[index]
    if (row === undefined) return

    selected.value = props.rowKey(row)
    if (box) {
        box.scrollTop = scrollToRow(index, box.scrollTop, viewHeight.value, props.rowHeight)
        scrollTop.value = box.scrollTop
    }
}

function ariaSort(key: string): 'ascending' | 'descending' | undefined {
    if (key !== props.sortKey) return undefined
    return props.sortDescending ? 'descending' : 'ascending'
}

/** Scrolls the row selected into view, once the rows given are drawn: after a sort, say. */
async function showSelected(): Promise<void> {
    await nextTick()
    const box = scroller.value
    if (!box || selectedIndex.value < 0) return

    box.scrollTop = scrollToRow(selectedIndex.value, box.scrollTop, viewHeight.value, props.rowHeight)
    scrollTop.value = box.scrollTop
}

defineExpose({ showSelected })

function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
        const row = props.rows[selectedIndex.value]
        if (row !== undefined) emit('activate', row)
        return
    }

    const perPage = Math.max(1, Math.floor(viewHeight.value / props.rowHeight) - 1)
    const to = rowForKey(event.key, selectedIndex.value, props.rows.length, perPage)
    if (to === undefined) return

    event.preventDefault()
    select(to)
}

let observer: ResizeObserver | undefined

onMounted(() => {
    measure()
    if (typeof ResizeObserver !== 'undefined' && scroller.value) {
        observer = new ResizeObserver(measure)
        observer.observe(scroller.value)
    }
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
    <div
        ref="scroller"
        class="ui-table"
        role="grid"
        tabindex="0"
        :aria-label="label"
        :aria-rowcount="rows.length + 1"
        :aria-colcount="columns.length"
        :aria-activedescendant="activeId"
        :style="{ '--ui-table-row-height': `${rowHeight}px` }"
        @scroll.passive="onScroll"
        @keydown="onKeydown"
    >
        <div class="ui-table-content" :style="{ minWidth }">
            <div
                ref="header"
                class="ui-table-row ui-table-header"
                role="row"
                aria-rowindex="1"
                :style="{ gridTemplateColumns: tracks }"
            >
                <div
                    v-for="column in columns"
                    :key="column.key"
                    class="ui-table-cell"
                    :class="{ 'ui-table-end': column.align === 'end' }"
                    role="columnheader"
                    :aria-sort="ariaSort(column.key)"
                >
                    <button v-if="sortable" class="ui-table-sort" type="button" @click="emit('sort', column.key)">
                        <span class="ui-table-label">{{ column.label }}</span>
                        <span v-if="column.key === sortKey" class="ui-table-arrow" aria-hidden="true">
                            {{ sortDescending ? '▼' : '▲' }}
                        </span>
                    </button>
                    <template v-else>{{ column.label }}</template>
                </div>
            </div>
            <div class="ui-table-body" :style="{ height: `${rows.length * rowHeight}px` }">
                <div class="ui-table-shown" :style="{ transform: `translateY(${start * rowHeight}px)` }">
                    <div
                        v-for="{ row, index } in shown"
                        :id="rowId(index)"
                        :key="index"
                        class="ui-table-row"
                        :class="{ 'ui-table-selected': index === selectedIndex }"
                        role="row"
                        :aria-rowindex="index + 2"
                        :aria-selected="index === selectedIndex"
                        :style="{ gridTemplateColumns: tracks, height: `${rowHeight}px` }"
                        @click="select(index)"
                        @dblclick="emit('activate', row)"
                    >
                        <div
                            v-for="column in columns"
                            :key="column.key"
                            class="ui-table-cell"
                            :class="{ 'ui-table-end': column.align === 'end' }"
                            role="gridcell"
                        >
                            <slot name="cell" :row="row" :column="column" :text="column.text(row)">
                                {{ column.text(row) }}
                            </slot>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style>
.ui-table {
    box-sizing: border-box;
    height: 100%;
    overflow: auto;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius);
    background: var(--ui-panel);
    font-family: var(--ui-mono);
    font-size: 0.86em;
    /* The rows are drawn as they come into view: the browser need not keep its place by them. */
    overflow-anchor: none;
}

.ui-table:focus-visible {
    outline: none;
    border-color: var(--ui-accent);
    box-shadow:
        0 0 0 1px var(--ui-accent),
        var(--ui-glow);
}

.ui-table-body {
    position: relative;
}

.ui-table-shown {
    position: absolute;
    inset: 0 0 auto;
    will-change: transform;
}

.ui-table-row {
    display: grid;
    box-sizing: border-box;
    border-bottom: 1px solid var(--ui-border);
    cursor: default;
}

.ui-table-header {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--ui-sunken);
    color: var(--ui-muted);
    font-weight: 600;
}

.ui-table-cell {
    min-width: 0;
    padding: 0.4em 0.7em;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.ui-table-shown .ui-table-cell {
    padding-block: 0;
    /* A row's height, less its border. */
    line-height: calc(var(--ui-table-row-height) - 1px);
}

.ui-table-end {
    text-align: right;
}

.ui-table-sort {
    display: flex;
    gap: 0.4em;
    width: 100%;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: inherit;
    cursor: pointer;
}

.ui-table-end .ui-table-sort {
    flex-direction: row-reverse;
}

.ui-table-sort:hover {
    color: var(--ui-text);
}

.ui-table-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
}

.ui-table-arrow {
    flex: none;
    color: var(--ui-accent);
    font-size: 0.8em;
}

.ui-table-shown .ui-table-row:hover {
    background: var(--ui-sunken);
}

.ui-table-shown .ui-table-row.ui-table-selected {
    background: var(--ui-accent-soft);
    box-shadow: inset 2px 0 0 var(--ui-accent);
}
</style>
