<template>
  <div>
    <app-header />
    <slot />
    <app-footer />
  </div>
</template>

<script lang="ts">
import Vue from 'vue'

import AppHeader from './components/AppHeader.vue'
import AppFooter from './components/AppFooter.vue'

export default Vue.extend({
  name: 'App',
  components: { AppHeader, AppFooter },
})
</script>
