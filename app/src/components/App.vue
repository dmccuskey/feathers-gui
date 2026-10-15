<script setup lang="ts">
// The app's frame: the header, the side bar and the area of the current service, and the dialogs over them.
import { onBeforeUnmount, ref, type Component } from 'vue'
import { useApp, type AppDialogs } from '../app/app.ts'
import AppHeader from './AppHeader.vue'
import AskDialog from './AskDialog.vue'
import DialogHost from './DialogHost.vue'
import InfoDialog from './InfoDialog.vue'
import LoginDialog from './LoginDialog.vue'
import ServerDialog from './ServerDialog.vue'
import ServersDialog from './ServersDialog.vue'
import ServiceArea from './ServiceArea.vue'
import ServiceDialog from './ServiceDialog.vue'
import SideBar from './SideBar.vue'
import WidgetsPage from './WidgetsPage.vue'

const app = useApp()

/** The component of each kind of dialog the app has. */
const DIALOGS: Record<keyof AppDialogs, Component> = {
    info: InfoDialog,
    ask: AskDialog,
    servers: ServersDialog,
    server: ServerDialog,
    service: ServiceDialog,
    login: LoginDialog,
}

/** The page of the widgets is at this address, and nothing links to it. */
const WIDGETS_HASH = '#/widgets'

const hash = ref(window.location.hash)
const onHashChange = (): void => {
    hash.value = window.location.hash
}

window.addEventListener('hashchange', onHashChange)
onBeforeUnmount(() => window.removeEventListener('hashchange', onHashChange))
</script>

<template>
    <div class="app">
        <AppHeader />
        <main v-if="hash === WIDGETS_HASH" class="app-page"><WidgetsPage /></main>
        <main v-else class="app-browser">
            <SideBar />
            <ServiceArea />
        </main>
    </div>
    <DialogHost :dialogs="app.dialogs" :components="DIALOGS" />
</template>

<style>
.app {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    height: 100vh;
}

.app-page {
    padding: 1rem 1.5rem 3rem;
    overflow: auto;
}

.app-browser {
    display: grid;
    grid-template-columns: 18rem minmax(0, 1fr);
    min-height: 0;
}
</style>
