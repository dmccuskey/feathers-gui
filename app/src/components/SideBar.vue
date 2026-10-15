<script setup lang="ts">
// The side bar: the server this window works with, the state of the session with it, and its services.
import { computed } from 'vue'
import { useApp } from '../app/app.ts'
import type { ServerSetup } from '../app/setup.ts'
import { UiButton, UiSelect } from '../widgets/index.ts'
import AppIcon from './AppIcon.vue'
import SessionStatus from './SessionStatus.vue'

const app = useApp()
const setup = app.setup

function serverLabel(server: ServerSetup): string {
    return server.name ? `${server.name} (${server.url})` : server.url
}

const serverOptions = computed(() => {
    const options: { value: string | null; label: string }[] = setup.servers.map(server => ({
        value: server.id,
        label: serverLabel(server),
    }))

    // Only while none is chosen: a server is left by choosing another.
    if (setup.currentServerId === null) options.unshift({ value: null, label: 'Choose a server' })

    return options
})

const serverId = computed({
    get: () => setup.currentServerId,
    set: id => {
        if (id !== null) app.activateServer(id)
    },
})

const services = computed(() => {
    const id = setup.currentServerId

    return id === null ? [] : [...setup.servicesOf(id)].sort((a, b) => a.path.localeCompare(b.path))
})

const serviceId = computed(() => {
    const id = setup.currentServerId

    return id === null ? null : setup.currentServiceId(id)
})

function chooseService(id: string): void {
    if (setup.currentServerId !== null) setup.setCurrentService(setup.currentServerId, id)
}
</script>

<template>
    <aside class="side-bar">
        <section class="side-bar-part">
            <h2 class="side-bar-title">Server</h2>
            <div class="side-bar-server">
                <UiSelect
                    v-model="serverId"
                    :options="serverOptions"
                    :disabled="setup.servers.length === 0"
                    aria-label="Server"
                />
                <UiButton
                    variant="quiet"
                    class="side-bar-tool"
                    aria-label="Manage servers"
                    title="Manage servers"
                    @click="app.manageServers()"
                >
                    <AppIcon name="gear" />
                </UiButton>
            </div>
            <SessionStatus v-if="setup.currentServerId !== null" />
        </section>

        <section v-if="setup.currentServerId !== null" class="side-bar-part side-bar-services">
            <div class="side-bar-heading">
                <h2 class="side-bar-title">Services</h2>
                <UiButton
                    variant="quiet"
                    class="side-bar-tool"
                    aria-label="Add a service"
                    title="Add a service"
                    @click="app.addService()"
                >
                    <AppIcon name="plus" />
                </UiButton>
            </div>
            <ul class="side-bar-list">
                <li
                    v-for="service in services"
                    :key="service.id"
                    class="side-bar-service"
                    :class="{ 'side-bar-current': service.id === serviceId }"
                >
                    <button
                        class="side-bar-path"
                        type="button"
                        :aria-current="service.id === serviceId || undefined"
                        @click="chooseService(service.id)"
                    >
                        {{ service.path }}
                    </button>
                    <span class="side-bar-row-tools">
                        <UiButton
                            variant="quiet"
                            class="side-bar-tool"
                            :aria-label="`Edit ${service.path}`"
                            title="Edit"
                            @click="app.editService(service.id)"
                        >
                            <AppIcon name="pencil" />
                        </UiButton>
                        <UiButton
                            variant="quiet"
                            class="side-bar-tool"
                            :aria-label="`Remove ${service.path}`"
                            title="Remove"
                            @click="app.removeService(service.id)"
                        >
                            <AppIcon name="x" />
                        </UiButton>
                    </span>
                </li>
            </ul>
        </section>
    </aside>
</template>

<style>
.side-bar {
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-right: 1px solid var(--ui-border);
    background: var(--ui-panel);
}

.side-bar-part {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--ui-space);
    padding: calc(var(--ui-space) * 2);
}

.side-bar-services {
    flex: 1;
    align-content: start;
    min-height: 0;
    border-top: 1px solid var(--ui-border);
    overflow-y: auto;
}

.side-bar-title {
    margin: 0;
    color: var(--ui-muted);
    font-size: 0.8em;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.side-bar-heading,
.side-bar-server {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--ui-space) / 2);
}

.side-bar-server .ui-select {
    min-width: 0;
}

.side-bar-tool {
    flex: none;
    width: var(--ui-control);
    padding: 0;
}

.side-bar-list {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1px;
    margin: 0 calc(var(--ui-space) * -1);
    padding: 0;
    list-style: none;
}

.side-bar-service {
    display: flex;
    align-items: center;
    border-radius: var(--ui-radius);
}

.side-bar-service:hover,
.side-bar-current {
    background: var(--ui-sunken);
}

.side-bar-path {
    flex: 1;
    min-width: 0;
    min-height: var(--ui-control);
    padding: 0 var(--ui-space);
    border: 0;
    border-radius: var(--ui-radius);
    background: none;
    color: var(--ui-text);
    font: inherit;
    font-family: var(--ui-mono);
    font-size: 0.92em;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    cursor: pointer;
}

.side-bar-current .side-bar-path {
    color: var(--ui-accent);
    font-weight: 600;
}

/* A row's tools show on the row the pointer or the keyboard is on, and on the current one. */
.side-bar-row-tools {
    display: flex;
    opacity: 0;
}

.side-bar-service:hover .side-bar-row-tools,
.side-bar-service:focus-within .side-bar-row-tools,
.side-bar-current .side-bar-row-tools {
    opacity: 1;
}
</style>
