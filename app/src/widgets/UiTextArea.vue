<script setup lang="ts">
// Lines of text, as `UiInput` is one. What a native text area takes (`rows`, `placeholder`, `disabled`) is passed
// on to it. `mono` sets it in the fixed-width font, for code and JSON.
import { inject } from 'vue'
import { FIELD_KEY } from './field.ts'

defineProps<{ mono?: boolean }>()

const value = defineModel<string>({ default: '' })
const field = inject(FIELD_KEY, null)
</script>

<template>
    <textarea
        :id="field?.id"
        v-model="value"
        class="ui-input ui-text-area"
        :class="{ 'ui-text-area-mono': mono }"
        :aria-describedby="field?.describedBy"
        :aria-invalid="field?.invalid || undefined"
    />
</template>

<style>
.ui-text-area {
    padding: 0.4em 0.6em;
    line-height: 1.4;
    resize: vertical;
}

.ui-text-area-mono {
    font-family: var(--ui-mono);
    font-size: 0.92em;
    tab-size: 2;
}
</style>
