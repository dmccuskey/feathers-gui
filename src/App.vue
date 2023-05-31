<template>
  <div id="app">
    <LayoutController>
      <router-view></router-view>
    </LayoutController>
  </div>
</template>

<script lang="ts">
import Vue from 'vue'

import LayoutController from '@/layouts/LayoutController.vue'

export default Vue.extend({
  name: 'App',
  components: { LayoutController },
})
</script>

<style lang="scss">
#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  width: 100%;
  height: 100%;
}

.notice {
  color: rgb(255, 111, 0);
}
</style>
