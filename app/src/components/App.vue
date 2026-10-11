<script setup lang="ts">
// The app's frame. Empty for now, but for the dialogs and the page of the widgets: the skeleton only shows that
// the page builds and serves.
import { onBeforeUnmount, ref, type Component } from 'vue'
import { useApp, type AppDialogs } from '../app/app.ts'
import DialogHost from './DialogHost.vue'
import WidgetsPage from './WidgetsPage.vue'

const app = useApp()

/** The component of each kind of dialog the app has. */
const DIALOGS: Record<keyof AppDialogs, Component> = {}

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
    <main class="app">
        <h1>feathers-gui</h1>
        <WidgetsPage v-if="hash === WIDGETS_HASH" />
    </main>
    <DialogHost :dialogs="app.dialogs" :components="DIALOGS" />
</template>

<style scoped>
.app {
    padding: 1rem 1.5rem 3rem;
}

h1 {
    margin: 0 0 1rem;
    font-size: 1.4em;
    font-weight: 600;
}
</style>
