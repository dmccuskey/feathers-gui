<script setup lang="ts">
// A server: its name, its address, how to log in to it, and whether it is only read. A password or a pasted token
// is held in memory unless the user has it remembered, which the dialog says is plain text in the browser (ADR 008).
import { computed, ref } from 'vue'
import type { ServerDialogAnswer, ServerDialogInput } from '../app/app.ts'
import type { LoginSetup } from '../app/setup.ts'
import { PLAIN_INPUT } from './plain-input.ts'
import { UiButton, UiCheckbox, UiDialog, UiField, UiInput, UiSelect } from '../widgets/index.ts'

const props = defineProps<{ input: ServerDialogInput }>()

const emit = defineEmits<{ answer: [ServerDialogAnswer]; cancel: [] }>()

type Kind = 'none' | LoginSetup['kind']

const KINDS: readonly { value: Kind; label: string }[] = [
    { value: 'none', label: 'None' },
    { value: 'local', label: 'A username and a password (local)' },
    { value: 'token', label: 'An access token' },
]

const before = props.input.server
const login = before?.login

const name = ref(before?.name ?? '')
const url = ref(before?.url ?? '')
const readOnly = ref(before?.readOnly ?? false)
const kind = ref<Kind>(login?.kind ?? 'none')
const path = ref(login?.path ?? 'authentication')
const usernameField = ref(login?.usernameField ?? 'email')
const passwordField = ref(login?.passwordField ?? 'password')
const username = ref(login?.username ?? '')
const remember = ref(login?.remember ?? false)
const secret = ref('')
const tried = ref(false)

/** Whether the secret in hand is one for the kind of login chosen. */
const held = computed(() => props.input.hasSecret && kind.value === login?.kind)
/** What the secret of the login chosen is called. */
const what = computed(() => (kind.value === 'token' ? 'token' : 'password'))
const secretPlaceholder = computed(() => (held.value ? 'Unchanged' : undefined))

const urlError = computed(() => {
    const text = url.value.trim()

    if (text === '') return 'A server needs its address.'

    try {
        const { protocol } = new URL(text)

        if (protocol === 'http:' || protocol === 'https:') return undefined
    } catch {
        // Not an address at all.
    }

    return 'An address starts with http:// or https://.'
})

const needed = (value: string): string | undefined => (value.trim() === '' ? 'Needed.' : undefined)

const errors = computed(() => ({
    url: urlError.value,
    path: kind.value === 'none' ? undefined : needed(path.value),
    usernameField: kind.value === 'local' ? needed(usernameField.value) : undefined,
    passwordField: kind.value === 'local' ? needed(passwordField.value) : undefined,
}))

/** An error is shown once the dialog was sent with it. */
const shown = computed(() => (tried.value ? errors.value : {}) as Partial<typeof errors.value>)

function submit(): void {
    tried.value = true

    if (Object.values(errors.value).some(Boolean)) return

    const local = kind.value === 'local'

    emit('answer', {
        server: {
            name: name.value.trim(),
            url: url.value.trim(),
            readOnly: readOnly.value,
            ...(kind.value !== 'none' && {
                login: {
                    kind: kind.value,
                    path: path.value.trim(),
                    usernameField: local ? usernameField.value.trim() : '',
                    passwordField: local ? passwordField.value.trim() : '',
                    username: local ? username.value : '',
                    remember: remember.value,
                },
            }),
        },
        secret: kind.value !== 'none' && secret.value !== '' ? secret.value : null,
    })
}
</script>

<template>
    <UiDialog :title="before ? 'Edit the Server' : 'Add a Server'" @cancel="emit('cancel')" @submit="submit">
        <UiField label="Name">
            <UiInput v-model="name" v-bind="PLAIN_INPUT" />
        </UiField>
        <UiField label="Address" :error="shown.url">
            <UiInput v-model="url" placeholder="http://localhost:3030" v-bind="PLAIN_INPUT" />
        </UiField>
        <UiField label="Login">
            <UiSelect v-model="kind" :options="KINDS" />
        </UiField>

        <template v-if="kind !== 'none'">
            <UiField label="Authentication service" :error="shown.path">
                <UiInput v-model="path" v-bind="PLAIN_INPUT" />
            </UiField>
        </template>

        <template v-if="kind === 'local'">
            <div class="server-dialog-pair">
                <UiField label="Username field" :error="shown.usernameField">
                    <UiInput v-model="usernameField" v-bind="PLAIN_INPUT" />
                </UiField>
                <UiField label="Username">
                    <UiInput v-model="username" v-bind="PLAIN_INPUT" />
                </UiField>
            </div>
            <div class="server-dialog-pair">
                <UiField label="Password field" :error="shown.passwordField">
                    <UiInput v-model="passwordField" v-bind="PLAIN_INPUT" />
                </UiField>
                <UiField label="Password">
                    <UiInput
                        v-model="secret"
                        type="password"
                        autocomplete="new-password"
                        :placeholder="secretPlaceholder"
                    />
                </UiField>
            </div>
        </template>

        <UiField v-if="kind === 'token'" label="Access token">
            <UiInput v-model="secret" type="password" autocomplete="off" :placeholder="secretPlaceholder" />
        </UiField>

        <div v-if="kind !== 'none'">
            <UiCheckbox v-model="remember">Remember the {{ what }}</UiCheckbox>
            <p class="server-dialog-note" :class="{ 'server-dialog-warning': remember }">
                <template v-if="remember">
                    The {{ what }} is stored in this browser as plain text, with the rest of the setup.
                </template>
                <template v-else
                    >The {{ what }} is held until the app's last window closes, and stored nowhere.</template
                >
            </p>
        </div>

        <UiCheckbox v-model="readOnly">Read-only: the app changes nothing on this server</UiCheckbox>

        <template #buttons>
            <UiButton @click="emit('cancel')">Cancel</UiButton>
            <UiButton variant="primary" type="submit">{{ before ? 'Save' : 'Add' }}</UiButton>
        </template>
    </UiDialog>
</template>

<style>
.server-dialog-pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--ui-space);
}

.server-dialog-note {
    margin: 0;
    color: var(--ui-muted);
    font-size: 0.86em;
}

.server-dialog-warning {
    color: var(--ui-danger);
}
</style>
