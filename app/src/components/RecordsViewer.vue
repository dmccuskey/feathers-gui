<script setup lang="ts">
// A service view's records in the table: a column per field, each value shown by its field's type, the rows in the
// order of the view's sort. A click on a header sorts by its column, and again the other way. The row selected is
// the view's selection, kept by the record's ID, and scrolled to when the sort changes or a record comes to be
// selected, such as one just made. Delete (or Backspace) asks for the selected record to be removed. The columns follow
// the records as they change, in the order the records are held, not shown.
import { computed, useTemplateRef, watch } from 'vue'
import { columnsOf } from '../app/columns.ts'
import { showValue, type FieldTypeDefinition } from '../app/field-types.ts'
import type { ServiceView } from '../app/service-view.ts'
import type { RecordEnvelope } from '../app/session.ts'
import type { FieldSetup } from '../app/setup.ts'
import { UiTable, type TableColumn } from '../widgets/index.ts'
import RecordCell from './RecordCell.vue'

const props = defineProps<{
    view: ServiceView
    /** As the view holds them: the columns are read from them. */
    records: readonly RecordEnvelope[]
    /** The records in the order shown. Default: `records`. */
    rows?: readonly RecordEnvelope[]
    fields?: readonly FieldSetup[]
}>()

const emit = defineEmits<{
    /** Delete, or Backspace, on a selected record: its ID. */
    remove: [id: string]
}>()

const table = useTemplateRef<{ showSelected(): Promise<void> }>('table')

const columns = computed(() => columnsOf(props.records, props.view.idField, props.fields))
const types = computed(() => new Map(columns.value.map(column => [column.name, column.type])))
const tableColumns = computed<TableColumn<RecordEnvelope>[]>(() =>
    columns.value.map(({ name, type }) => ({
        key: name,
        label: name,
        text: row => showValue(row.raw[name], type).text,
        align: type.alignEnd ? 'end' : 'start',
    })),
)

const selected = computed({
    get: () => props.view.selectedId ?? undefined,
    set: key => props.view.select(key === undefined ? null : String(key)),
})

const sortKey = computed(() => (props.view.sort.by === 'field' ? props.view.sort.field : undefined))
const sortDescending = computed(() => props.view.sort.by === 'field' && props.view.sort.descending)

function sortBy(field: string): void {
    const sort = props.view.sort

    props.view.setSort({
        by: 'field',
        field,
        descending: sort.by === 'field' && sort.field === field && !sort.descending,
    })
}

function removeSelected(event: KeyboardEvent): void {
    const id = props.view.selectedId

    if (id === null || props.view.record(id) === undefined) return
    event.preventDefault()
    emit('remove', id)
}

// The selected record is scrolled to when it is first held, as well as when it is chosen
watch(
    [() => props.view.sort, () => props.view.selected !== undefined && props.view.selectedId],
    () => void table.value?.showSelected(),
)

const typeOf = (name: string) => types.value.get(name) as FieldTypeDefinition
</script>

<template>
    <UiTable
        ref="table"
        v-model:selected="selected"
        :columns="tableColumns"
        :rows="rows ?? records"
        :row-key="record => record.id"
        :label="`Records of ${view.path}`"
        sortable
        :sort-key="sortKey"
        :sort-descending="sortDescending"
        @sort="sortBy"
        @keydown.delete="removeSelected"
    >
        <template #cell="{ row, column }">
            <RecordCell :value="row.raw[column.key]" :type="typeOf(column.key)" />
        </template>
    </UiTable>
</template>
