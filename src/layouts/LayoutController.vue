<template>
  <component :is="layout">
    <slot />
  </component>
</template>

<script lang="ts">
/*
  adapted from https://itnext.io/vue-tricks-smart-layouts-for-vuejs-5c61a472b69b
*/
import Vue from 'vue'

const defaultLayout = 'AppDefaultLayout'

export default Vue.extend({
  name: 'AppLayout',
  computed: {
    layout() {
      const layout = this.$route.meta?.layout || defaultLayout
      return () => import(`@/layouts/${layout}.vue`)
    },
  },
})
</script>
