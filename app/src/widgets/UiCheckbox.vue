<script setup lang="ts">
// A checkbox with its label: a click on either checks it.
defineProps<{ disabled?: boolean }>()

const checked = defineModel<boolean>({ default: false })
</script>

<template>
    <label class="ui-checkbox" :class="{ 'ui-checkbox-disabled': disabled }">
        <input v-model="checked" type="checkbox" :disabled="disabled" />
        <span><slot /></span>
    </label>
</template>

<style>
.ui-checkbox {
    display: inline-flex;
    align-items: center;
    gap: 0.5em;
    min-height: var(--ui-control);
    cursor: pointer;
}

.ui-checkbox input {
    appearance: none;
    display: grid;
    place-content: center;
    flex: none;
    width: 1.1em;
    height: 1.1em;
    margin: 0;
    border: 1px solid var(--ui-border);
    border-radius: calc(var(--ui-radius) * 0.6);
    background: var(--ui-sunken);
    font: inherit;
    cursor: inherit;
    transition:
        background-color 0.12s,
        border-color 0.12s;
}

.ui-checkbox:hover input {
    border-color: var(--ui-accent);
}

/* The tick: a corner of a box, turned. */
.ui-checkbox input::after {
    content: '';
    width: 0.28em;
    height: 0.55em;
    margin-top: -0.12em;
    border: solid var(--ui-on-accent);
    border-width: 0 0.14em 0.14em 0;
    transform: rotate(45deg) scale(0);
    transition: transform 0.1s;
}

.ui-checkbox input:checked {
    border-color: var(--ui-accent);
    background: var(--ui-accent);
    box-shadow: var(--ui-glow);
}

.ui-checkbox input:checked::after {
    transform: rotate(45deg) scale(1);
}

.ui-checkbox-disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
</style>
