<script setup lang="ts">
// A button. `primary` is the one a dialog or a form is for; `danger` is for what cannot be undone; `quiet` has no
// frame, for a row of tools.
withDefaults(
    defineProps<{
        variant?: 'plain' | 'primary' | 'danger' | 'quiet'
        /** `submit` in a dialog or a form makes it the button that Enter presses. */
        type?: 'button' | 'submit'
    }>(),
    { variant: 'plain', type: 'button' },
)
</script>

<template>
    <button class="ui-button" :class="`ui-button-${variant}`" :type="type"><slot /></button>
</template>

<style>
.ui-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4em;
    box-sizing: border-box;
    min-height: var(--ui-control);
    padding: 0 0.9em;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius);
    background: var(--ui-panel);
    color: var(--ui-text);
    font: inherit;
    line-height: 1;
    white-space: nowrap;
    cursor: pointer;
    transition:
        background-color 0.12s,
        border-color 0.12s,
        box-shadow 0.12s;
}

.ui-button:hover {
    border-color: var(--ui-accent);
}

.ui-button:active {
    background: var(--ui-sunken);
}

.ui-button-primary {
    border-color: var(--ui-accent);
    background: var(--ui-accent);
    color: var(--ui-on-accent);
    font-weight: 600;
    box-shadow: var(--ui-glow);
}

.ui-button-primary:hover,
.ui-button-primary:active {
    background: color-mix(in srgb, var(--ui-accent), var(--ui-text) 14%);
}

.ui-button-danger {
    border-color: color-mix(in srgb, var(--ui-danger), transparent 45%);
    color: var(--ui-danger);
}

.ui-button-danger:hover {
    border-color: var(--ui-danger);
    background: color-mix(in srgb, var(--ui-danger), transparent 88%);
}

.ui-button-quiet {
    border-color: transparent;
    background: none;
}

.ui-button-quiet:hover {
    border-color: transparent;
    background: var(--ui-sunken);
}

.ui-button:disabled {
    opacity: 0.45;
    box-shadow: none;
    cursor: not-allowed;
    pointer-events: none;
}
</style>
