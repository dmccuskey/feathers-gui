<template>
  <div id="browser-view">
    <dialog-controller />
    <app-header />
    <app-main />
    <app-footer />
  </div>
</template>

<script lang="ts">
// Libs
import Vue from 'vue'

// Components
import AppFooter from '@/components/AppFooter.vue'
import AppHeader from '@/components/AppHeader.vue'
import AppMain from '@/components/AppMain.vue'

// Controllers & Services
import DialogController from '@/components/DialogController.vue'

export default Vue.extend({
  name: 'App',

  components: {
    AppFooter,
    AppHeader,
    AppMain,
    DialogController,
  },
})
</script>

<style lang="scss">
#browser-view {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}
</style>
