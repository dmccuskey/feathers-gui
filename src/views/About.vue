<template>
  <div id="about-view">
    <app-header />
    Feathers GUI is an interface to view and modify data records similar to the
    one available for Google Firebase or Firestore.
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
  name: 'AboutView',

  components: {
    AppFooter,
    AppHeader,
  },
})
</script>
