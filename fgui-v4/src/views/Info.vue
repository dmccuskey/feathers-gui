<template>
  <div id="info-view">
    <p>
      <strong>Feathers GUI</strong> is a simple, real-time interface to view and
      modify data records in a Feathersjs server. It is akin to the one
      available for Google Firebase or Firestore.
    </p>
    <p class="notice" v-if="!usingFeathersGui">
      You are using Feathers GUI online, so your Feathersjs server must be
      configured to use secure HTTPS.
      <a href="https://feathersgui.dev" target="_blank">See the online docs</a>
      for help.
    </p>
  </div>
</template>

<script lang="ts">
// Libs
import Vue from 'vue'

// Controllers & Services
import AppCtrl from '@/controllers/app-ctrl.model'

/*
  Vuejs Interfaces
*/
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IProps {}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IData {}

interface IComputed {
  usingFeathersGui: boolean
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IMethods {}

export default Vue.extend<IData, IMethods, IComputed, IProps>({
  name: 'InfoView',

  computed: {
    usingFeathersGui() {
      return AppCtrl.usingFeathersGui
    },
  },
})
</script>

<style lang="scss" scoped>
$item-xy: 20px;
$item-lr: 10px;
$item-margin: 10px;
$item-max-width: 300px;
$item-min-width: 200px;

#info-view {
  margin-left: $item-margin;

  p {
    font-size: 20px;
  }
}
</style>
