<template>
  <div id="side-bar">
    <server-selector />

    <template v-if="!haveServers">
      <div class="notice">Add your first server</div>
    </template>
    <template v-else-if="!haveSelectedServer">
      <div class="notice">Select A Server</div>
    </template>
    <template v-else>
      <service-selector />
    </template>
  </div>
</template>

<script lang="ts">
// Libs
import Vue from 'vue'

// Constants / Interfaces
import { IServer, Server } from '@/models/server.interfaces'

// Components
import ServerSelector from '@/components/ServerSelector.vue'
import ServiceSelector from '@/components/ServiceSelector.vue'

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
  currentServerInstance: IServer | null
  haveSelectedServer: boolean
  serversList: Server[]
  haveServers: boolean
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IMethods {}

export default Vue.extend<IData, IMethods, IComputed, IProps>({
  name: 'SideBar',

  components: {
    ServerSelector,
    ServiceSelector,
  },

  computed: {
    currentServerInstance() {
      return AppCtrl.serverInstance
    },

    serversList() {
      return AppCtrl.serversList
    },

    haveSelectedServer() {
      return this.currentServerInstance !== null
      // return false // TEST
    },

    haveServers() {
      return this.serversList.length > 0
      // return false // TEST
    },
  },
})
</script>

<style lang="scss" scoped>
$item-xy: 0px;
$item-lr: 10px;

#side-bar {
  padding: $item-xy $item-lr;
}
</style>
