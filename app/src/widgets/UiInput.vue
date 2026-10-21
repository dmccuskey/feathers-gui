<script setup lang="ts">
// A line of text. What a native input takes (`type`, `placeholder`, `disabled`) is passed on to it. `small` fits a
// line of text, as a row of tools over a table does.
import { inject } from 'vue'
import { FIELD_KEY } from './field.ts'

withDefaults(defineProps<{ size?: 'normal' | 'small' }>(), { size: 'normal' })

const value = defineModel<string>({ default: '' })
const field = inject(FIELD_KEY, null)
</script>

<template>
    <input
        :id="field?.id"
        v-model="value"
        class="ui-input"
        :class="{ 'ui-input-small': size === 'small' }"
        :aria-describedby="field?.describedBy"
        :aria-invalid="field?.invalid || undefined"
    />
</template>

<style>
.ui-input {
    box-sizing: border-box;
    width: 100%;
    min-height: var(--ui-control);
    padding: 0 0.6em;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius);
    background: var(--ui-sunken);
    color: var(--ui-text);
    font: inherit;
    transition:
        border-color 0.12s,
        box-shadow 0.12s;
}

.ui-input-small {
    min-height: auto;
    padding-block: 0.2em;
    font-size: 0.86em;
}

.ui-input::placeholder {
    color: var(--ui-muted);
    opacity: 0.75;
}

.ui-input:hover {
    border-color: var(--ui-muted);
}

.ui-input:focus {
    outline: none;
    border-color: var(--ui-accent);
    box-shadow:
        0 0 0 1px var(--ui-accent),
        var(--ui-glow);
}

.ui-input[aria-invalid='true'] {
    border-color: var(--ui-danger);
}

.ui-input[aria-invalid='true']:focus {
    box-shadow: 0 0 0 1px var(--ui-danger);
}

.ui-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
</style>
