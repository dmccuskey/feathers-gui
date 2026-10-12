<script setup lang="ts">
// What the app is.
import { UiButton, UiDialog } from '../widgets/index.ts'

defineProps<{ input: null }>()

const emit = defineEmits<{ answer: [null]; cancel: [] }>()
</script>

<template>
    <UiDialog title="feathers-gui" @cancel="emit('cancel')" @submit="emit('cancel')">
        <p class="info-dialog-text">
            A simple, real-time interface to view and change the records of a Feathersjs server, akin to the one there
            is for Google Firebase or Firestore.
        </p>
        <template #buttons>
            <UiButton variant="primary" type="submit">Close</UiButton>
        </template>
    </UiDialog>
</template>

<style>
.info-dialog-text {
    margin: 0;
}
</style>
