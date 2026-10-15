<script setup lang="ts">
// The state of the session with the current server, under the server's select: a dot, a line, the reason of the
// last failure, and the button to log in or out, or to try again at once.
import { computed } from 'vue'
import { useApp } from '../app/app.ts'
import { UiButton } from '../widgets/index.ts'
import { statusText } from './session-status.ts'

const app = useApp()

const text = computed(() => {
    const session = app.session

    return statusText(session?.status, session ? app.setup.server(session.serverId)?.login : undefined)
})
</script>

<template>
    <div class="session-status" role="status">
        <p class="session-status-line">
            <span class="session-status-dot" :class="`session-status-${text.tone}`" />
            <span>
                <strong v-if="text.strong">{{ text.strong }}</strong>
                {{ text.line }}
            </span>
        </p>
        <p v-if="text.detail" class="session-status-detail">{{ text.detail }}</p>
        <UiButton v-if="text.action === 'log-in'" class="session-status-button" @click="app.logIn()">Log In</UiButton>
        <UiButton v-else-if="text.action === 'try-now'" class="session-status-button" @click="app.session?.retryNow()"
            >Try Now</UiButton
        >
        <UiButton
            v-else-if="text.action === 'log-out'"
            variant="quiet"
            class="session-status-button"
            @click="app.logOut()"
            >Log Out</UiButton
        >
    </div>
</template>

<style>
.session-status {
    display: grid;
    justify-items: start;
    gap: calc(var(--ui-space) * 0.5);
    color: var(--ui-muted);
    font-size: 0.86em;
}

.session-status-line {
    display: flex;
    align-items: baseline;
    gap: 0.5em;
    margin: 0;
    overflow-wrap: anywhere;
}

.session-status-line strong {
    color: var(--ui-text);
    font-weight: 600;
}

.session-status-dot {
    flex: none;
    width: 0.6em;
    height: 0.6em;
    border: 1px solid var(--ui-muted);
    border-radius: 50%;
}

.session-status-busy {
    border-color: var(--ui-warning);
    background: var(--ui-warning);
}

.session-status-ok {
    border-color: var(--ui-success);
    background: var(--ui-success);
}

.session-status-detail {
    margin: 0 0 0 1.1em;
    overflow-wrap: anywhere;
}

.session-status-button {
    margin-left: 1.1em;
    font-size: inherit;
}
</style>
