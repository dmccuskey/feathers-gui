<script setup lang="ts">
// Renders the dialogs that are open, in the order they were opened, and settles each by what its component
// emits. A dialog's component takes `input` and emits `answer`, with the answer, or `cancel`.
import type { Component } from 'vue'
import type { OpenDialog } from '../app/dialogs.ts'

defineProps<{
    dialogs: { readonly open: readonly OpenDialog[] }
    /** The component of each kind of dialog. */
    components: Readonly<Record<string, Component>>
}>()
</script>

<template>
    <component
        :is="components[dialog.kind]"
        v-for="dialog in dialogs.open"
        :key="dialog.id"
        :input="dialog.input"
        @answer="dialog.answer"
        @cancel="dialog.cancel"
    />
</template>
