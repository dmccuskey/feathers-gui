<script setup lang="ts">
// A dialog over the page, on the native `<dialog>`: it keeps the focus in itself, and gives it back to where it
// was when it goes. It is open for as long as it is rendered, and closes when its owner stops rendering it:
// Escape only asks, by `cancel`. Its content is a form, so Enter presses the button of type `submit`.
import { onBeforeUnmount, onMounted, useId, useTemplateRef } from 'vue'

defineProps<{ title: string }>()

const emit = defineEmits<{
    /** Escape, or the browser closing the dialog itself. */
    cancel: []
    /** Enter in a control, or a press of the `submit` button. */
    submit: []
}>()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const titleId = useId()
let leaving = false

onMounted(() => dialog.value?.showModal())

// Closed, not only removed: that is what gives the focus back.
onBeforeUnmount(() => {
    leaving = true
    dialog.value?.close()
})

function onCancel(event: Event): void {
    event.preventDefault()
    emit('cancel')
}

// A browser closes a dialog whose `cancel` is refused twice in a row. Its owner is told, so it is not left
// rendered and shut.
function onClose(): void {
    if (!leaving) emit('cancel')
}
</script>

<template>
    <dialog ref="dialog" class="ui-dialog" :aria-labelledby="titleId" @cancel="onCancel" @close="onClose">
        <form class="ui-dialog-form" method="dialog" @submit.prevent="emit('submit')">
            <h2 :id="titleId" class="ui-dialog-title">{{ title }}</h2>
            <div class="ui-dialog-body"><slot /></div>
            <footer v-if="$slots.buttons" class="ui-dialog-buttons"><slot name="buttons" /></footer>
        </form>
    </dialog>
</template>

<style>
.ui-dialog {
    box-sizing: border-box;
    width: min(32rem, calc(100vw - 2rem));
    max-height: calc(100vh - 2rem);
    padding: 0;
    border: 1px solid var(--ui-border);
    border-radius: calc(var(--ui-radius) * 1.5);
    background: var(--ui-panel);
    color: var(--ui-text);
    box-shadow:
        0 1.2rem 3rem rgb(0 0 0 / 0.28),
        var(--ui-glow);
}

.ui-dialog::backdrop {
    background: color-mix(in srgb, var(--ui-page), #000 55%);
    opacity: 0.7;
}

.ui-dialog-form {
    display: grid;
    gap: calc(var(--ui-space) * 2.5);
    padding: calc(var(--ui-space) * 3);
}

.ui-dialog-title {
    margin: 0;
    font-size: 1.15em;
    font-weight: 600;
}

.ui-dialog-body {
    display: grid;
    gap: calc(var(--ui-space) * 2);
}

.ui-dialog-buttons {
    display: flex;
    justify-content: flex-end;
    gap: var(--ui-space);
}
</style>
