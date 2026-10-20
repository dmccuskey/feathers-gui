<script setup lang="ts">
// A service of the current server: its path, its ID field, and how its records are loaded (ADR 006).
import { computed, ref } from 'vue'
import type { ServiceDialogAnswer, ServiceDialogInput } from '../app/app.ts'
import type { ServiceSetup } from '../app/setup.ts'
import { PLAIN_INPUT } from './plain-input.ts'
import { UiButton, UiDialog, UiField, UiInput } from '../widgets/index.ts'

const props = defineProps<{ input: ServiceDialogInput }>()

const emit = defineEmits<{ answer: [ServiceDialogAnswer]; cancel: [] }>()

const LOADS: readonly { value: ServiceSetup['load']; label: string; text: string }[] = [
    { value: 'auto', label: 'Auto', text: 'Whole when the service is small, by pages when it is large.' },
    { value: 'whole', label: 'Whole', text: 'Every record, searched as you type. A large service asks first.' },
    { value: 'paged', label: 'Paged', text: 'A page at a time, sorted and filtered by the server.' },
]

const path = ref(props.input.service?.path ?? '')
const idField = ref(props.input.service?.idField ?? '')
const load = ref(props.input.service?.load ?? 'auto')
const tried = ref(false)

const idFieldPlaceholder = computed(() => {
    const guessed = props.input.guessedIdField

    if (guessed === null) return 'Neither id nor _id: name it'

    return guessed === undefined ? 'Guessed' : `Guessed as '${guessed}'`
})

// A path is the same with or without the slashes around it.
const cleanPath = computed(() => path.value.trim().replace(/^\/+|\/+$/g, ''))
const pathError = computed(() => {
    if (cleanPath.value === '') return 'A service needs its path.'
    if (props.input.taken.includes(cleanPath.value)) return 'This service is already set up.'

    return undefined
})

function submit(): void {
    tried.value = true

    if (!pathError.value) {
        emit('answer', { path: cleanPath.value, load: load.value, idField: idField.value.trim() || undefined })
    }
}
</script>

<template>
    <UiDialog :title="input.service ? 'Edit the Service' : 'Add a Service'" @cancel="emit('cancel')" @submit="submit">
        <UiField
            label="Path"
            hint="As the server registers it: messages, api/users."
            :error="tried ? pathError : undefined"
        >
            <UiInput v-model="path" class="service-dialog-path" v-bind="PLAIN_INPUT" autofocus />
        </UiField>
        <UiField label="ID field" hint="Left blank, it is guessed: id, else _id.">
            <UiInput
                v-model="idField"
                class="service-dialog-id-field"
                v-bind="PLAIN_INPUT"
                :placeholder="idFieldPlaceholder"
            />
        </UiField>
        <fieldset class="service-dialog-loads">
            <legend>Loading</legend>
            <label v-for="choice in LOADS" :key="choice.value" class="service-dialog-load">
                <input v-model="load" type="radio" name="load" :value="choice.value" />
                <span>
                    <strong>{{ choice.label }}</strong>
                    {{ choice.text }}
                </span>
            </label>
        </fieldset>
        <template #buttons>
            <UiButton @click="emit('cancel')">Cancel</UiButton>
            <UiButton variant="primary" type="submit">{{ input.service ? 'Save' : 'Add' }}</UiButton>
        </template>
    </UiDialog>
</template>

<style>
.service-dialog-path,
.service-dialog-id-field {
    font-family: var(--ui-mono);
}

.service-dialog-loads {
    display: grid;
    gap: 0.4em;
    margin: 0;
    padding: 0;
    border: 0;
}

.service-dialog-loads legend {
    margin-bottom: 0.3em;
    padding: 0;
    color: var(--ui-muted);
    font-size: 0.86em;
    font-weight: 600;
    letter-spacing: 0.02em;
}

.service-dialog-load {
    display: flex;
    align-items: baseline;
    gap: 0.5em;
    cursor: pointer;
}

.service-dialog-load input {
    flex: none;
    margin: 0;
    accent-color: var(--ui-accent);
}

.service-dialog-load strong {
    margin-right: 0.3em;
    font-weight: 600;
}
</style>
