<script setup lang="ts">
// A label with its control, and a line under it for a hint or for what is wrong. The control in it (an input, a
// select) takes the field's ID, so a click on the label goes to it and a screen reader reads the hint and the
// error with it.
import { computed, provide, reactive, useId } from 'vue'
import { FIELD_KEY } from './field.ts'

const props = defineProps<{
    label: string
    hint?: string
    /** What is wrong with the value. Shown in place of the hint. */
    error?: string
}>()

const id = useId()
const noteId = `${id}-note`
const note = computed(() => props.error || props.hint)

provide(
    FIELD_KEY,
    reactive({
        id,
        describedBy: computed(() => (note.value ? noteId : undefined)),
        invalid: computed(() => Boolean(props.error)),
    }),
)
</script>

<template>
    <div class="ui-field">
        <label class="ui-field-label" :for="id">{{ label }}</label>
        <slot />
        <p v-if="note" :id="noteId" class="ui-field-note" :class="{ 'ui-field-error': error }">{{ note }}</p>
    </div>
</template>

<style>
.ui-field {
    display: grid;
    gap: 0.3em;
}

.ui-field-label {
    color: var(--ui-muted);
    font-size: 0.86em;
    font-weight: 600;
    letter-spacing: 0.02em;
}

.ui-field-note {
    margin: 0;
    color: var(--ui-muted);
    font-size: 0.86em;
}

.ui-field-error {
    color: var(--ui-danger);
}
</style>
