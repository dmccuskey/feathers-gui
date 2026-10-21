<script setup lang="ts">
// Every widget, in every state, in the theme that is on: the place to check them. At `#/widgets`.
import { computed, ref } from 'vue'
import {
    SYSTEM,
    UiButton,
    UiCheckbox,
    UiDialog,
    UiField,
    UiInput,
    UiSelect,
    UiTable,
    UiTextArea,
    themeRoles,
    type TableColumn,
    useTheming,
} from '../widgets/index.ts'
import { fieldType, showValue, type FieldTypeDefinition } from '../app/field-types.ts'
import { readRecord } from '../app/new-record.ts'
import type { FieldType } from '../app/setup.ts'
import RecordCell from './RecordCell.vue'

const theming = useTheming()

const themeOptions = computed(() => [
    { value: SYSTEM, label: 'As the system' },
    ...theming.themes.map(theme => ({ value: theme.name, label: theme.label })),
])
const choice = computed({
    get: () => theming.choice,
    set: value => {
        theming.choice = value
    },
})
const roles = computed(() => Object.entries(themeRoles(theming.theme)))

const name = ref('Local')
const url = ref('localhost:3041')
const urlError = computed(() =>
    /^https?:\/\//.test(url.value) ? undefined : 'An address starts with http:// or https://',
)
const notes = ref('')
const toolSearch = ref('')
const sortPressed = ref(true)
const pinsPressed = ref(false)
const recordText = ref('{\n  "text": "Hello",\n}')
const recordError = computed(() => readRecord(recordText.value).error)
const transport = ref<'socketio' | 'rest'>('socketio')
const readOnly = ref(false)
const remember = ref(true)
const dialogOpen = ref(false)
const removeOpen = ref(false)

const TRANSPORTS = [
    { value: 'socketio', label: 'Socket.io' },
    { value: 'rest', label: 'REST' },
] as const

// Rows enough to see that only those in view are drawn.
interface Reading {
    id: number
    sensor: string
    value: number
    ok: boolean
    at: string
}

const SENSORS = ['north', 'south', 'east', 'west', 'a sensor with a name too long for its column']
const ROW_COUNTS = [
    { value: 100, label: '100 rows' },
    { value: 10_000, label: '10,000 rows' },
    { value: 100_000, label: '100,000 rows' },
]
const rowCount = ref(10_000)
const readings = computed<Reading[]>(() =>
    Array.from({ length: rowCount.value }, (_, index) => ({
        id: index + 1,
        sensor: SENSORS[index % SENSORS.length]!,
        value: Math.round(Math.sin(index) * 1000) / 10,
        ok: index % 7 !== 0,
        at: new Date(Date.UTC(2026, 9, 1) + index * 60_000).toISOString(),
    })),
)
const READING_COLUMNS: TableColumn<Reading>[] = [
    { key: 'id', label: 'id', text: row => String(row.id), width: '5rem', align: 'end' },
    { key: 'sensor', label: 'sensor', text: row => row.sensor, width: '10rem' },
    { key: 'value', label: 'value', text: row => String(row.value), width: '6rem', align: 'end' },
    { key: 'ok', label: 'ok', text: row => String(row.ok), width: '4rem' },
    { key: 'at', label: 'at', text: row => row.at, width: '14rem' },
]
const selectedReading = ref<PropertyKey>()
const activated = ref<Reading>()

// A value of each kind under each type: null and missing, a value not of its field's type, and one too long.
type Sample = Record<string, unknown>

const SAMPLE_FIELDS: [string, FieldType][] = [
    ['_id', 'string'],
    ['name', 'string'],
    ['count', 'number'],
    ['done', 'boolean'],
    ['at', 'date'],
    ['meta', 'object'],
    ['tags', 'array'],
]
const SAMPLES: Sample[] = [
    {
        _id: 'a1',
        name: 'Ann',
        count: 7,
        done: true,
        at: '2026-10-01T12:34:56.789Z',
        meta: { color: 'red', size: 3, parts: [1, 2] },
        tags: ['one', 'two'],
    },
    { _id: 'a2', name: '', count: 0, done: false, at: Date.UTC(2026, 9, 2), meta: {}, tags: [] },
    { _id: 'a3', name: null, count: null, done: null, at: null, meta: null, tags: null },
    { _id: 'a4' },
    { _id: 'a5', name: 42, count: '42', done: 'yes', at: 'next Tuesday', meta: [1, 2], tags: { a: 1 } },
    {
        _id: 'a6',
        name: `A first line\nand a second, ${'and on '.repeat(60)}`,
        count: 1234567.891,
        done: true,
        at: '2026-10-20',
        meta: { note: 'a note long enough to be cut short inside the summary of its object', deep: { deeper: true } },
        tags: Array.from({ length: 500 }, (_, index) => index),
    },
]
const SAMPLE_TYPES: Record<string, FieldTypeDefinition> = Object.fromEntries(
    SAMPLE_FIELDS.map(([name, type]) => [name, fieldType(type)]),
)
const SAMPLE_COLUMNS: TableColumn<Sample>[] = SAMPLE_FIELDS.map(([name]) => ({
    key: name,
    label: name,
    text: row => showValue(row[name], SAMPLE_TYPES[name]!).text,
    width: name === 'at' ? '11rem' : '6rem',
    align: SAMPLE_TYPES[name]!.alignEnd ? 'end' : 'start',
}))
</script>

<template>
    <div class="page">
        <header class="top">
            <h2>Widgets</h2>
            <UiField label="Theme" class="theme">
                <UiSelect v-model="choice" :options="themeOptions" />
            </UiField>
        </header>

        <section class="card">
            <h3>Buttons</h3>
            <div class="row">
                <UiButton variant="primary">Connect</UiButton>
                <UiButton>Cancel</UiButton>
                <UiButton variant="danger">Remove</UiButton>
                <UiButton variant="quiet">Fields…</UiButton>
            </div>
            <div class="row">
                <UiButton variant="primary" disabled>Connect</UiButton>
                <UiButton disabled>Cancel</UiButton>
                <UiButton variant="danger" disabled>Remove</UiButton>
                <UiButton variant="quiet" disabled>Fields…</UiButton>
            </div>
        </section>

        <section class="card">
            <h3>A row of tools</h3>
            <p class="plain">
                Small, as over the records: a search, two toggles (one on, one off; a click turns either), and a tool
                that cannot be used.
            </p>
            <div class="row tools">
                <UiInput v-model="toolSearch" class="tool-search" size="small" type="search" placeholder="Search" />
                <UiButton variant="quiet" size="small" :pressed="sortPressed" @click="sortPressed = !sortPressed">
                    Last changed
                </UiButton>
                <UiButton variant="quiet" size="small" :pressed="pinsPressed" @click="pinsPressed = !pinsPressed">
                    Pinned only
                </UiButton>
                <UiButton variant="quiet" size="small">New</UiButton>
                <UiButton variant="quiet" size="small" disabled>Remove</UiButton>
            </div>
            <div class="row tools">
                <UiButton size="small">Plain</UiButton>
                <UiButton variant="primary" size="small">Primary</UiButton>
                <UiButton variant="danger" size="small">Danger</UiButton>
            </div>
        </section>

        <section class="card">
            <h3>A form</h3>
            <div class="form">
                <UiField label="Name">
                    <UiInput v-model="name" />
                </UiField>
                <UiField label="Address" hint="Where the Feathers server listens" :error="urlError">
                    <UiInput v-model="url" placeholder="http://localhost:3030" />
                </UiField>
                <UiField label="Transport">
                    <UiSelect v-model="transport" :options="TRANSPORTS" />
                </UiField>
                <UiField label="Disabled">
                    <UiInput model-value="Not to be changed" disabled />
                </UiField>
                <UiField label="Notes" hint="Lines of text">
                    <UiTextArea v-model="notes" rows="3" />
                </UiField>
                <UiField label="A record" :error="recordError">
                    <UiTextArea v-model="recordText" rows="4" mono spellcheck="false" />
                </UiField>
                <UiCheckbox v-model="readOnly">Read only</UiCheckbox>
                <UiCheckbox v-model="remember">Remember the password</UiCheckbox>
                <UiCheckbox disabled>Not to be checked</UiCheckbox>
            </div>
        </section>

        <section class="card">
            <h3>Dialogs</h3>
            <div class="row">
                <UiButton @click="dialogOpen = true">Add a server…</UiButton>
                <UiButton variant="danger" @click="removeOpen = true">Remove a server…</UiButton>
            </div>
        </section>

        <section class="card">
            <h3>A table</h3>
            <div class="row">
                <UiField label="Rows" class="theme">
                    <UiSelect v-model="rowCount" :options="ROW_COUNTS" />
                </UiField>
            </div>
            <div class="table-box">
                <UiTable
                    v-model:selected="selectedReading"
                    :columns="READING_COLUMNS"
                    :rows="readings"
                    :row-key="row => row.id"
                    label="Readings"
                    @activate="row => (activated = row)"
                />
            </div>
            <p class="plain">Selected: {{ selectedReading ?? 'none' }}. Activated: {{ activated?.id ?? 'none' }}.</p>
            <UiTable :columns="READING_COLUMNS" :rows="[]" :row-key="row => row.id" label="No readings" class="empty" />
        </section>

        <section class="card">
            <h3>Values by their field's type</h3>
            <div class="samples-box">
                <UiTable :columns="SAMPLE_COLUMNS" :rows="SAMPLES" :row-key="row => String(row._id)" label="Values">
                    <template #cell="{ row, column }">
                        <RecordCell :value="row[column.key]" :type="SAMPLE_TYPES[column.key]!" />
                    </template>
                </UiTable>
            </div>
        </section>

        <section class="card">
            <h3>The theme's roles</h3>
            <ul class="roles">
                <li v-for="[role, color] in roles" :key="role">
                    <span class="swatch" :style="{ background: color }"></span>
                    <span>{{ role }}</span>
                    <code>{{ color }}</code>
                </li>
            </ul>
        </section>

        <UiDialog v-if="dialogOpen" title="Add a server" @cancel="dialogOpen = false" @submit="dialogOpen = false">
            <UiField label="Name">
                <UiInput v-model="name" autofocus />
            </UiField>
            <UiField label="Address" :error="urlError">
                <UiInput v-model="url" />
            </UiField>
            <UiCheckbox v-model="readOnly">Read only</UiCheckbox>
            <template #buttons>
                <UiButton @click="dialogOpen = false">Cancel</UiButton>
                <UiButton variant="primary" type="submit">Add</UiButton>
            </template>
        </UiDialog>

        <UiDialog v-if="removeOpen" title="Remove “Local”?" @cancel="removeOpen = false" @submit="removeOpen = false">
            <p class="plain">Its three services go with it. Nothing on the server is changed.</p>
            <template #buttons>
                <UiButton autofocus @click="removeOpen = false">Cancel</UiButton>
                <UiButton variant="danger" type="submit">Remove</UiButton>
            </template>
        </UiDialog>
    </div>
</template>

<style scoped>
.page {
    display: grid;
    gap: 1rem;
    max-width: 46rem;
}

.top {
    display: flex;
    align-items: end;
    justify-content: space-between;
}

.theme {
    width: 12rem;
}

h2,
h3 {
    margin: 0;
    font-weight: 600;
}

h3 {
    color: var(--ui-muted);
    font-size: 0.86em;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.card {
    display: grid;
    gap: 0.9rem;
    padding: 1.1rem 1.25rem;
    border: 1px solid var(--ui-border);
    border-radius: calc(var(--ui-radius) * 1.5);
    background: var(--ui-panel);
}

.row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.tools {
    align-items: center;
}

.tool-search {
    width: 14em;
}

.form {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.9rem 1rem;
    align-items: start;
}

.plain {
    margin: 0;
}

.table-box {
    height: 20rem;
}

.samples-box {
    height: 13rem;
}

.empty {
    height: auto;
}

.roles {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
    gap: 0.5rem 1rem;
    margin: 0;
    padding: 0;
    list-style: none;
}

.roles li {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.6em;
}

.swatch {
    width: 1.4em;
    height: 1.4em;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius);
}

code {
    color: var(--ui-muted);
    font-family: var(--ui-mono);
    font-size: 0.86em;
}
</style>
