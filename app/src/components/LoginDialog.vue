<script setup lang="ts">
// Logging in to a server: its password, or an access token. The dialog stays while the server answers, and shows
// its reason when it refuses. It is a real login form, so the browser's password manager offers to save and fill
// the password: the username is in it, read-only (to change it, the server is edited).
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import type { LoginDialogInput } from '../app/app.ts'
import { UiButton, UiCheckbox, UiDialog, UiField, UiInput } from '../widgets/index.ts'

const props = defineProps<{ input: LoginDialogInput }>()

const emit = defineEmits<{ answer: [null]; cancel: [] }>()

const server = props.input.server
const isToken = server.login.kind === 'token'
const what = isToken ? 'token' : 'password'

const secret = ref('')
const remember = ref(false)
const isBusy = ref(false)
const failure = ref(props.input.reason)
const tried = ref(false)
const secretInput = useTemplateRef<{ $el: HTMLInputElement }>('secretInput')

const error = computed(() => {
    if (tried.value && secret.value === '') return isToken ? 'Paste the token.' : 'Type the password.'

    return failure.value
})

async function submit(): Promise<void> {
    if (isBusy.value) return

    tried.value = true
    if (secret.value === '') return

    isBusy.value = true
    failure.value = undefined
    try {
        await props.input.logIn(
            isToken ? { token: secret.value } : { username: server.login.username, password: secret.value },
            remember.value,
        )
        emit('answer', null)
    } catch (caught) {
        failure.value = caught instanceof Error ? caught.message : String(caught)
        secret.value = ''
        tried.value = false
        isBusy.value = false
        await nextTick()
        secretInput.value?.$el.focus()
    }
}
</script>

<template>
    <UiDialog title="Log In" @cancel="emit('cancel')" @submit="submit">
        <p class="login-dialog-server">
            <strong>{{ server.name || server.url }}</strong>
            <template v-if="server.name"> ({{ server.url }})</template>
        </p>

        <UiField v-if="!isToken" label="Username">
            <UiInput :model-value="server.login.username" name="username" autocomplete="username" readonly />
        </UiField>
        <UiField :label="isToken ? 'Access token' : 'Password'" :error="error">
            <UiInput
                ref="secretInput"
                v-model="secret"
                type="password"
                :name="what"
                :autocomplete="isToken ? 'off' : 'current-password'"
                :disabled="isBusy"
                autofocus
            />
        </UiField>

        <div>
            <UiCheckbox v-model="remember" :disabled="isBusy">Remember on this computer</UiCheckbox>
            <p v-if="remember" class="login-dialog-note">
                The {{ what }} is stored in this browser as plain text, with the rest of the setup.
            </p>
        </div>

        <template #buttons>
            <UiButton @click="emit('cancel')">Cancel</UiButton>
            <UiButton variant="primary" type="submit" :disabled="isBusy">{{
                isBusy ? 'Logging In…' : 'Log In'
            }}</UiButton>
        </template>
    </UiDialog>
</template>

<style>
.login-dialog-server {
    margin: 0;
    color: var(--ui-muted);
    overflow-wrap: anywhere;
}

.login-dialog-server strong {
    color: var(--ui-text);
    font-weight: 600;
}

.login-dialog-note {
    margin: 0;
    color: var(--ui-danger);
    font-size: 0.86em;
}
</style>
