<script setup lang="ts">
// A new record, as JSON text, until the record editor: it starts from the template it is given. Text that is not a
// JSON object is said, and not sent. The dialog stays while the server answers, and shows its reasons, field by
// field, when it refuses the record, so the text is not lost. Cmd or Ctrl and Enter creates it, as the button does.
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import type { RecordDialogInput } from '../app/app.ts'
import { reasonsOf, readRecord } from '../app/new-record.ts'
import { WriteError } from '../app/service-view.ts'
import { UiButton, UiDialog, UiField, UiTextArea } from '../widgets/index.ts'

const props = defineProps<{ input: RecordDialogInput }>()

const emit = defineEmits<{ answer: [null]; cancel: [] }>()

const text = ref(JSON.stringify(props.input.record, null, 2))
const isBusy = ref(false)
const failure = ref<{ message: string; reasons: string[] }>()
const textArea = useTemplateRef<{ $el: HTMLTextAreaElement }>('textArea')

const read = computed(() => readRecord(text.value))

async function submit(): Promise<void> {
    const record = read.value.record

    if (isBusy.value || !record) return

    isBusy.value = true
    failure.value = undefined
    try {
        await props.input.create(record)
        emit('answer', null)
    } catch (caught) {
        failure.value = {
            message: caught instanceof Error ? caught.message : String(caught),
            reasons: caught instanceof WriteError ? reasonsOf(caught.errors) : [],
        }
        isBusy.value = false
        await nextTick()
        textArea.value?.$el.focus()
    }
}
</script>

<template>
    <UiDialog class="record-dialog" title="New Record" @cancel="emit('cancel')" @submit="submit">
        <p class="record-dialog-path">
            In <strong>{{ input.path }}</strong>
        </p>

        <UiField label="Record, as JSON" :error="read.error">
            <UiTextArea
                ref="textArea"
                v-model="text"
                mono
                rows="14"
                spellcheck="false"
                autocomplete="off"
                :disabled="isBusy"
                autofocus
                @keydown.meta.enter.prevent="submit"
                @keydown.ctrl.enter.prevent="submit"
            />
        </UiField>

        <div v-if="failure" class="record-dialog-failure" role="alert">
            <p>{{ failure.message }}</p>
            <ul v-if="failure.reasons.length > 0">
                <li v-for="(reason, index) in failure.reasons" :key="index">{{ reason }}</li>
            </ul>
        </div>

        <template #buttons>
            <UiButton @click="emit('cancel')">Cancel</UiButton>
            <UiButton variant="primary" type="submit" :disabled="isBusy || !read.record">{{
                isBusy ? 'Creating…' : 'Create'
            }}</UiButton>
        </template>
    </UiDialog>
</template>

<style>
.ui-dialog.record-dialog {
    width: min(44rem, calc(100vw - 2rem));
}

.record-dialog-path {
    margin: 0;
    color: var(--ui-muted);
}

.record-dialog-path strong {
    color: var(--ui-text);
    font-family: var(--ui-mono);
    font-weight: 600;
}

.record-dialog-failure {
    color: var(--ui-danger);
    font-size: 0.92em;
}

.record-dialog-failure p,
.record-dialog-failure ul {
    margin: 0;
}

.record-dialog-failure ul {
    padding-left: 1.4em;
    font-family: var(--ui-mono);
}
</style>
