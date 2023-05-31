<template>
  <div id="feathers-view">
    <dialog-controller />
    <feathers-browser />
  </div>
</template>

<script lang="ts">
// Libs
import Vue from 'vue'

// Components
import FeathersBrowser from '@/components/FeathersBrowser.vue'

// Controllers & Services
import DialogController from '@/components/DialogController.vue'

export default Vue.extend({
  name: 'FeathersView',

  components: {
    FeathersBrowser,
    DialogController,
  },
})
</script>

<style lang="scss">
#feathers-view {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}
</style>
