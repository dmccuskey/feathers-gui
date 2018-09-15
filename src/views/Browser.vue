<template>
<div id="browser">
  <feathers-gui-support />
  <app-header />
  <app-main />
  <app-footer />
</div>
</template>

<script lang="ts">
import Vue from 'vue'

// components
import AppFooter from '@/components/AppFooter.vue'
import AppHeader from '@/components/AppHeader.vue'
import AppMain from '@/components/AppMain.vue'
import FeathersGuiSupport from '@/components/FeathersGuiSupport.vue'

export default Vue.extend({

  name: 'App',

  components: {
    AppFooter,
    AppHeader,
    AppMain,
    FeathersGuiSupport,
  },

})
</script>

<style lang="scss">
#browser {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}
</style>
