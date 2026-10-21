<script setup lang="ts">
// A field's value in a cell of the records table, as its type shows it: null and missing in the muted color, a
// value not of the field's type in the warning color. A tooltip, made as the pointer comes over the cell, has what
// the cell has no room for, and says when the value is not of the field's type.
import { computed, ref } from 'vue'
import { showFullValue, showValue, type FieldTypeDefinition } from '../app/field-types.ts'

const props = defineProps<{ value: unknown; type: FieldTypeDefinition }>()

const shown = computed(() => showValue(props.value, props.type))
const title = ref<string>()

function onEnter(event: MouseEvent) {
    const element = event.currentTarget as HTMLElement
    const full = showFullValue(props.value, props.type)
    const hidden = full !== shown.value.text || element.scrollWidth > element.clientWidth
    const lines = [
        shown.value.tone === 'mismatch' ? `Not of the field’s type, ${props.type.label.toLowerCase()}` : undefined,
        hidden ? full : undefined,
    ]

    title.value = lines.filter(line => line !== undefined).join('\n\n') || undefined
}
</script>

<template>
    <span class="record-cell" :class="shown.tone && `record-cell-${shown.tone}`" :title="title" @mouseenter="onEnter">
        {{ shown.text }}
    </span>
</template>

<style>
/* Its own block, so that it can tell when it is cut short by its column. */
.record-cell {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
}

.record-cell-none {
    color: var(--ui-muted);
    font-style: italic;
}

.record-cell-mismatch {
    color: var(--ui-warning);
}
</style>
