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
    themeRoles,
    type TableColumn,
    useTheming,
} from '../widgets/index.ts'

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

const RECORDS = [
    { id: 1, text: 'The first message', read: true, state: '' },
    { id: 2, text: 'A message that is selected', read: false, state: 'selected' },
    { id: 3, text: 'A message that has just changed', read: true, state: 'changed' },
    { id: 4, text: 'The last message', read: false, state: '' },
]
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
            <h3>Records, as they might look</h3>
            <p class="states">
                <span class="state success">connected</span>
                <span class="state warning">connecting</span>
                <span class="state danger">no connection</span>
            </p>
            <table class="records">
                <thead>
                    <tr>
                        <th>id</th>
                        <th>text</th>
                        <th>read</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="record in RECORDS" :key="record.id" :class="record.state">
                        <td>{{ record.id }}</td>
                        <td>{{ record.text }}</td>
                        <td>{{ record.read }}</td>
                    </tr>
                </tbody>
            </table>
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

.form {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.9rem 1rem;
    align-items: start;
}

.plain,
.states {
    margin: 0;
}

.states {
    display: flex;
    gap: 1.25rem;
}

.state::before {
    content: '';
    display: inline-block;
    width: 0.55em;
    height: 0.55em;
    margin-right: 0.45em;
    border-radius: 50%;
    background: currentColor;
}

.success {
    color: var(--ui-success);
}

.warning {
    color: var(--ui-warning);
}

.danger {
    color: var(--ui-danger);
}

.table-box {
    height: 20rem;
}

.empty {
    height: auto;
}

.records {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--ui-mono);
    font-size: 0.86em;
}

.records th,
.records td {
    padding: 0.4em 0.7em;
    border-bottom: 1px solid var(--ui-border);
    text-align: left;
}

.records th {
    background: var(--ui-sunken);
    color: var(--ui-muted);
    font-weight: 600;
}

.records tbody tr:hover {
    background: var(--ui-sunken);
}

.records tr.selected {
    background: var(--ui-accent-soft);
    box-shadow: inset 2px 0 0 var(--ui-accent);
}

.records tr.changed td:nth-child(2) {
    color: var(--ui-accent);
    text-shadow: var(--ui-glow);
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
