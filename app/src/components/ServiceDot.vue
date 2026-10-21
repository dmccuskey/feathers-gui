<script setup lang="ts">
// The dot of a service's view: live, stale or failed, in the accent while a change is not seen yet. It pulses at each
// record that changes, then goes back to what it was. Nothing is marked for a view not loaded whole, but its place is
// kept, so that the paths beside it line up.
import { computed, ref, watch } from 'vue'
import type { ServiceView } from '../app/service-view.ts'
import { viewDot } from './view-status.ts'

const props = defineProps<{ view: ServiceView | undefined }>()

const dot = computed(() => viewDot(props.view))

// Counts the pulses: a new one makes the dot again, which starts its animation over
const pulses = ref(0)

watch(
    () => props.view?.changeCount ?? 0,
    (changes, before) => {
        if (changes > before) pulses.value++
    },
)
</script>

<template>
    <span
        :key="pulses"
        class="service-dot"
        :class="[`service-dot-${dot.tone}`, { 'service-dot-unseen': dot.unseen, 'service-dot-pulse': pulses > 0 }]"
        :role="dot.tone === 'none' ? undefined : 'img'"
        :aria-label="dot.label || undefined"
        :aria-hidden="dot.tone === 'none' || undefined"
        :title="dot.label || undefined"
    />
</template>

<style>
.service-dot {
    flex: none;
    width: 0.5em;
    height: 0.5em;
    border: 1px solid transparent;
    border-radius: 50%;
}

.service-dot-live {
    border-color: var(--ui-muted);
    background: var(--ui-muted);
}

.service-dot-stale {
    border-color: var(--ui-muted);
}

.service-dot-failed {
    border-color: var(--ui-danger);
    background: var(--ui-danger);
}

.service-dot-unseen {
    border-color: var(--ui-accent);
    background: var(--ui-accent);
}

.service-dot-pulse {
    animation: service-dot-pulse 0.9s ease-out;
}

@keyframes service-dot-pulse {
    0% {
        border-color: var(--ui-accent);
        background: var(--ui-accent);
        box-shadow: 0 0 0 0 var(--ui-accent);
        transform: scale(1);
    }

    30% {
        border-color: var(--ui-accent);
        background: var(--ui-accent);
        transform: scale(1.6);
    }

    100% {
        box-shadow: 0 0 0 0.6em transparent;
        transform: scale(1);
    }
}

/* With less motion asked for, a blink of the accent in place of the pulse */
@media (prefers-reduced-motion: reduce) {
    @keyframes service-dot-pulse {
        0%,
        60% {
            border-color: var(--ui-accent);
            background: var(--ui-accent);
        }
    }
}
</style>
