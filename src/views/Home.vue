<template>
<div id="home-view">
  <app-header />
  Easy to use interface for Feathers Servers
  <app-footer />
</div>
</template>

<script lang="ts">
// Libs
import Vue from 'vue'

// Components
import AppFooter from '@/components/AppFooter.vue'
import AppHeader from '@/components/AppHeader.vue'

export default Vue.extend({

  name: 'HomeView',

  components: {
    AppFooter,
    AppHeader,
  },

})
</script>
