<script setup lang="ts">
// The bar at the top: the app's name, the choice of theme, and what the app is.
import { computed } from 'vue'
import { useApp } from '../app/app.ts'
import { SYSTEM, UiButton, UiSelect, useTheming } from '../widgets/index.ts'

const app = useApp()
const theming = useTheming()

const themeOptions = computed(() => [
    { value: SYSTEM, label: 'System' },
    ...theming.themes.map(theme => ({ value: theme.name, label: theme.label })),
])
const theme = computed({
    get: () => theming.choice,
    set: value => {
        theming.choice = value
    },
})
</script>

<template>
    <header class="app-header">
        <h1 class="app-header-name">feathers-gui</h1>
        <UiSelect v-model="theme" class="app-header-theme" :options="themeOptions" aria-label="Theme" />
        <UiButton variant="quiet" @click="app.showInfo()">Info</UiButton>
        <a class="app-header-link" href="https://github.com/dmccuskey/feathers-gui" target="_blank" rel="noopener">
            GitHub
        </a>
    </header>
</template>

<style>
.app-header {
    display: flex;
    align-items: center;
    gap: var(--ui-space);
    padding: var(--ui-space) calc(var(--ui-space) * 2);
    border-bottom: 1px solid var(--ui-border);
    background: var(--ui-panel);
}

.app-header-name {
    margin: 0 auto 0 0;
    font-size: 1.15em;
    font-weight: 600;
}

.app-header-theme {
    width: auto;
}

.app-header-link {
    padding: 0 0.9em;
    color: var(--ui-text);
    text-decoration: none;
}

.app-header-link:hover {
    color: var(--ui-accent);
}
</style>
