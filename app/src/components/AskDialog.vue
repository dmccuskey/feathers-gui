<script setup lang="ts">
// A question, with a button for each answer. The focus starts on the first, so Enter never picks one that cannot
// be undone.
import type { Question } from '../app/app.ts'
import { UiButton, UiDialog } from '../widgets/index.ts'

defineProps<{ input: Question }>()

const emit = defineEmits<{ answer: [string]; cancel: [] }>()
</script>

<template>
    <UiDialog :title="input.title" @cancel="emit('cancel')">
        <p class="ask-dialog-text">{{ input.text }}</p>
        <template #buttons>
            <UiButton
                v-for="choice in input.choices"
                :key="choice.value"
                :variant="choice.variant"
                @click="emit('answer', choice.value)"
            >
                {{ choice.label }}
            </UiButton>
        </template>
    </UiDialog>
</template>

<style>
.ask-dialog-text {
    margin: 0;
}
</style>
