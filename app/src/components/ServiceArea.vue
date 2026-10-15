<script setup lang="ts">
// The area of the current service. Until there is one, it says what is missing and offers the way to it. Of the
// service it shows its view's records as they are, read again each time the service is chosen. The records stay,
// dimmed, while the connection is being brought back.
import { computed, watch } from 'vue'
import { useApp } from '../app/app.ts'
import { UiButton } from '../widgets/index.ts'

const app = useApp()
const setup = app.setup

const server = computed(() => (setup.currentServerId === null ? undefined : setup.server(setup.currentServerId)))
const services = computed(() => (server.value ? setup.servicesOf(server.value.id) : []))
const service = computed(() => {
    const id = server.value ? setup.currentServiceId(server.value.id) : null

    return id === null ? undefined : setup.service(id)
})

const status = computed(() => app.session?.status)
const view = computed(() => (service.value ? app.session?.view(service.value.id) : undefined))
const records = computed(() => view.value?.records ?? null)
const failure = computed(() => view.value?.status.error?.message ?? null)

// A view newly shown reads again: the one shown at the start, of a service chosen, or of a new session
watch(view, shown => void shown?.read(), { immediate: true })
</script>

<template>
    <section class="service-area">
        <p v-if="setup.status === 'newer'" class="service-area-notice" role="alert">
            The setup was saved by a newer version of the app. Reload the page.
        </p>
        <p v-else-if="setup.status === 'unreadable'" class="service-area-notice" role="alert">
            The setup stored in the browser cannot be read.
        </p>

        <div v-if="setup.servers.length === 0" class="service-area-empty">
            <p>No servers are set up.</p>
            <UiButton variant="primary" @click="app.addServer()">Add Server</UiButton>
        </div>
        <div v-else-if="!server" class="service-area-empty">
            <p>No server is chosen. Choose one in the side bar.</p>
        </div>
        <div v-else-if="services.length === 0" class="service-area-empty">
            <p>No services are set up for this server.</p>
            <UiButton variant="primary" @click="app.addService()">Add Service</UiButton>
        </div>
        <div v-else-if="!service" class="service-area-empty">
            <p>No service is chosen. Choose one in the side bar.</p>
        </div>
        <!-- The service view comes here. -->
        <template v-else>
            <h2 class="service-area-path">{{ service.path }}</h2>
            <p
                v-if="status?.error && status.phase !== 'login-needed' && status.phase !== 'lost'"
                class="service-area-notice"
                role="alert"
            >
                {{ status.error.message }}
            </p>
            <p v-else-if="failure" class="service-area-notice" role="alert">{{ failure }}</p>
            <p v-else-if="status?.phase === 'connecting'" class="service-area-status">Connecting…</p>
            <div v-else-if="status?.phase === 'login-needed'" class="service-area-empty">
                <p>Log in to read this server's records.</p>
                <UiButton variant="primary" @click="app.logIn()">Log In</UiButton>
            </div>
            <p v-else-if="!records && status?.phase === 'lost'" class="service-area-status">Connection lost.</p>
            <p v-else-if="!records" class="service-area-status">Loading…</p>
            <p v-else-if="records.length === 0" class="service-area-status">No records.</p>
            <ol v-else class="service-area-records" :class="{ 'service-area-stale': status?.phase !== 'ready' }">
                <li v-for="record in records" :key="record.id">{{ JSON.stringify(record.raw) }}</li>
            </ol>
        </template>
    </section>
</template>

<style>
.service-area {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    padding: calc(var(--ui-space) * 2) calc(var(--ui-space) * 3);
    overflow: auto;
}

.service-area-notice {
    margin: 0 0 calc(var(--ui-space) * 2);
    padding: var(--ui-space) calc(var(--ui-space) * 1.5);
    border: 1px solid var(--ui-danger);
    border-radius: var(--ui-radius);
    color: var(--ui-danger);
}

.service-area-empty {
    display: grid;
    flex: 1;
    place-content: center;
    justify-items: center;
    gap: var(--ui-space);
    color: var(--ui-muted);
}

.service-area-empty p {
    margin: 0;
}

.service-area-path {
    margin: 0;
    font-family: var(--ui-mono);
    font-size: 1.15em;
    font-weight: 600;
}

.service-area-path + .service-area-notice {
    margin-top: calc(var(--ui-space) * 2);
}

.service-area-status {
    color: var(--ui-muted);
}

.service-area-records {
    margin: calc(var(--ui-space) * 2) 0 0;
    padding: 0;
    list-style: none;
    font-family: var(--ui-mono);
    font-size: 0.9em;
}

.service-area-stale {
    opacity: 0.5;
}

.service-area-records li {
    padding: calc(var(--ui-space) * 0.5) 0;
    border-bottom: 1px solid var(--ui-border);
    overflow-wrap: anywhere;
}
</style>
