<script setup lang="ts">
// The servers set up: each with what edits and removes it, a button that adds one, and the export and import of
// the whole setup.
import { useTemplateRef } from 'vue'
import { useApp } from '../app/app.ts'
import { UiButton, UiDialog } from '../widgets/index.ts'
import AppIcon from './AppIcon.vue'

defineProps<{ input: null }>()

const emit = defineEmits<{ answer: [null]; cancel: [] }>()

const app = useApp()
const setup = app.setup
const file = useTemplateRef<HTMLInputElement>('file')

/** Hands the setup to the browser as a file to save. It has no passwords. */
function exportSetup(): void {
    const link = document.createElement('a')

    link.href = URL.createObjectURL(new Blob([setup.export()], { type: 'application/json' }))
    link.download = 'feathers-gui-setup.json'
    link.click()
    URL.revokeObjectURL(link.href)
}

async function importSetup(): Promise<void> {
    const chosen = file.value?.files?.[0]

    if (!chosen || !file.value) return

    // So that the same file can be chosen again.
    file.value.value = ''
    await app.importSetup(await chosen.text())
}
</script>

<template>
    <UiDialog title="Servers" class="servers-dialog" @cancel="emit('cancel')" @submit="emit('cancel')">
        <p v-if="setup.servers.length === 0" class="servers-dialog-none">No servers are set up.</p>
        <table v-else class="servers-dialog-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Address</th>
                    <th><span class="servers-dialog-hidden">Tools</span></th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="server in setup.servers" :key="server.id">
                    <td>
                        {{ server.name }}
                        <span v-if="server.id === setup.currentServerId" class="servers-dialog-current">current</span>
                    </td>
                    <td class="servers-dialog-url">{{ server.url }}</td>
                    <td class="servers-dialog-tools">
                        <UiButton
                            variant="quiet"
                            class="servers-dialog-tool"
                            :aria-label="`Edit ${server.name || server.url}`"
                            title="Edit"
                            @click="app.editServer(server.id)"
                        >
                            <AppIcon name="pencil" />
                        </UiButton>
                        <UiButton
                            variant="quiet"
                            class="servers-dialog-tool"
                            :aria-label="`Remove ${server.name || server.url}`"
                            title="Remove"
                            @click="app.removeServer(server.id)"
                        >
                            <AppIcon name="x" />
                        </UiButton>
                    </td>
                </tr>
            </tbody>
        </table>
        <div>
            <UiButton @click="app.addServer()"><AppIcon name="plus" />Add Server</UiButton>
        </div>
        <input
            ref="file"
            class="servers-dialog-hidden"
            type="file"
            accept="application/json,.json"
            tabindex="-1"
            aria-hidden="true"
            @change="importSetup"
        />
        <template #buttons>
            <span class="servers-dialog-setup">
                <UiButton variant="quiet" :disabled="setup.servers.length === 0" @click="exportSetup">Export</UiButton>
                <UiButton variant="quiet" @click="file?.click()">Import</UiButton>
            </span>
            <UiButton variant="primary" type="submit">Close</UiButton>
        </template>
    </UiDialog>
</template>

<style>
.servers-dialog {
    width: min(40rem, calc(100vw - 2rem));
}

.servers-dialog-none {
    margin: 0;
    color: var(--ui-muted);
}

.servers-dialog-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
}

.servers-dialog-table th {
    padding: 0 var(--ui-space) 0.3em 0;
    border-bottom: 1px solid var(--ui-border);
    color: var(--ui-muted);
    font-size: 0.86em;
    font-weight: 600;
    text-align: left;
}

.servers-dialog-table th:last-child {
    width: calc(var(--ui-control) * 2);
}

.servers-dialog-table td {
    padding: 0.15em var(--ui-space) 0.15em 0;
    border-bottom: 1px solid var(--ui-border);
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
}

.servers-dialog-url {
    font-family: var(--ui-mono);
    font-size: 0.92em;
}

.servers-dialog-current {
    margin-left: 0.4em;
    color: var(--ui-accent);
    font-size: 0.86em;
}

.servers-dialog-table .servers-dialog-tools {
    padding-right: 0;
    white-space: nowrap;
}

.servers-dialog-tool {
    width: var(--ui-control);
    padding: 0;
}

.servers-dialog-setup {
    display: flex;
    margin-right: auto;
}

.servers-dialog-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
}
</style>
