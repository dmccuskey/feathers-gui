<script setup lang="ts">
// The app's frame. Empty for now, but for the dialogs: the skeleton only shows that the page builds and serves.
import type { Component } from 'vue'
import { useApp, type AppDialogs } from '../app/app.ts'
import DialogHost from './DialogHost.vue'

const app = useApp()

/** The component of each kind of dialog the app has. */
const DIALOGS: Record<keyof AppDialogs, Component> = {}
</script>

<template>
    <main class="app">
        <h1>feathers-gui</h1>
    </main>
    <DialogHost :dialogs="app.dialogs" :components="DIALOGS" />
</template>

<style scoped>
.app {
    font-family: system-ui, sans-serif;
    padding: 1rem;
}
</style>
