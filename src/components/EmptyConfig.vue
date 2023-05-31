<template>
  <div id="empty-config">
    <template v-if="noServers">
      <h3 class="notice">There aren't any Servers configured.</h3>
      <p class="notice">Add your first Server to the left.</p>
    </template>
    <template v-else-if="noServices">
      <h3 class="notice">There aren't any Services configured.</h3>
      <p class="notice">Add your first Service to the left.</p>
    </template>
  </div>
</template>

<script lang="ts">
/*
  HTML Main component

  creates the structure for the application Body
*/
// Libs
import Vue from 'vue'

/*
  Vuejs Interfaces
*/
interface IProps {
  noServers: boolean
  noServices: boolean
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IData {}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IComputed {}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IMethods {}

export default Vue.extend<IData, IMethods, IComputed, IProps>({
  name: 'EmptyConfig',

  props: {
    noServers: {
      type: Boolean,
      required: true,
    },
    noServices: {
      type: Boolean,
      required: true,
    },
  },
})
</script>

<style lang="scss" scoped>
#empty-config {
  text-align: center;
  h3 {
    font-weight: bold;
  }
}
</style>
