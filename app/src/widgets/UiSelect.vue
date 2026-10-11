<script setup lang="ts" generic="T">
// One of a few choices, on the native select: its list, its keyboard and its typing ahead are the browser's.
import { inject } from 'vue'
import { FIELD_KEY } from './field.ts'

defineProps<{
    options: readonly { value: T; label: string }[]
}>()

const value = defineModel<T>()
const field = inject(FIELD_KEY, null)
</script>

<template>
    <select
        :id="field?.id"
        v-model="value"
        class="ui-select"
        :aria-describedby="field?.describedBy"
        :aria-invalid="field?.invalid || undefined"
    >
        <option v-for="option in options" :key="option.label" :value="option.value">{{ option.label }}</option>
    </select>
</template>

<style>
.ui-select {
    appearance: none;
    box-sizing: border-box;
    width: 100%;
    min-height: var(--ui-control);
    padding: 0 2em 0 0.6em;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius);
    /* The arrow: two halves of a small triangle. */
    background:
        linear-gradient(45deg, transparent 50%, var(--ui-muted) 50%) right 0.95em center / 0.35em 0.35em no-repeat,
        linear-gradient(-45deg, transparent 50%, var(--ui-muted) 50%) right 0.6em center / 0.35em 0.35em no-repeat,
        var(--ui-sunken);
    color: var(--ui-text);
    font: inherit;
    cursor: pointer;
    transition:
        border-color 0.12s,
        box-shadow 0.12s;
}

.ui-select:hover {
    border-color: var(--ui-muted);
}

.ui-select:focus {
    outline: none;
    border-color: var(--ui-accent);
    box-shadow:
        0 0 0 1px var(--ui-accent),
        var(--ui-glow);
}

.ui-select[aria-invalid='true'] {
    border-color: var(--ui-danger);
}

.ui-select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
</style>
