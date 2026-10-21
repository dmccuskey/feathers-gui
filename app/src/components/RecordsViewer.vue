<script setup lang="ts">
// A service view's records in the table: a column per field, each value shown by its field's type. The row selected
// is the view's selection, kept by the record's ID. The columns follow the records as they change.
import { computed } from 'vue'
import { columnsOf } from '../app/columns.ts'
import { showValue, type FieldTypeDefinition } from '../app/field-types.ts'
import type { ServiceView } from '../app/service-view.ts'
import type { RecordEnvelope } from '../app/session.ts'
import type { FieldSetup } from '../app/setup.ts'
import { UiTable, type TableColumn } from '../widgets/index.ts'
import RecordCell from './RecordCell.vue'

const props = defineProps<{
    view: ServiceView
    records: readonly RecordEnvelope[]
    fields?: readonly FieldSetup[]
}>()

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

const typeOf = (name: string) => types.value.get(name) as FieldTypeDefinition
</script>

<template>
    <UiTable
        v-model:selected="selected"
        :columns="tableColumns"
        :rows="records"
        :row-key="record => record.id"
        :label="`Records of ${view.path}`"
    >
        <template #cell="{ row, column }">
            <RecordCell :value="row.raw[column.key]" :type="typeOf(column.key)" />
        </template>
    </UiTable>
</template>
