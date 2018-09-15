<template>
<div>
  <div class="section-title">Services</div>

  <table style="width:100%;padding-top:10px">
    <col width="*">
    <col width="60">
    <tr
      v-for="rec in services"
      :key="rec.path"
    >
      <td>
      <el-button type="info" size="medium" style="width:100%;text-align:left;font-size:14px;font-family:courier"
        @click="_handleSelectService( rec )"
      >
        {{rec.path}}
      </el-button>
      </td><td>
      <el-button type="danger" plain size="small" icon="el-icon-delete" circle
        @click="_handleRemoveService( rec )"
      />
      </td>
    </tr>
  </table>

  <hr />

  <el-button type="success" plain size="small" icon="el-icon-plus"
    @click="handleAddService"
  >
    Add Service Path
  </el-button>
</div>
</template>

<script lang="ts">
/*
  Side Bar component

  displays the current services, allows additions of new ones
*/
// Libs
import Vue from 'vue'

// Constants / Interfaces
import { ServiceStruct, IServiceConnection, ServerStruct, IServerConnection } from '@/interfaces'

// Utils
import FGuiCtrl from '@/controllers/feathers-gui-ctrl'

export default Vue.extend({

  name: 'SideBar',

  props: ['serverConnection'],

  computed: {

    currentServerId() : string {
      return this.$store.getters['currentServerId']
    },

    currentServerData() : ServerStruct {
      const { currentServerId } = this
      const serverFunc = this.$store.getters['getServerByServerId']
      return serverFunc(currentServerId)
    },

    // services() : IServiceConnection[] {
    //   const objs: IServiceConnection[] = this.$store.getters['getServiceConnectionsList']
    //   return objs.sort(function(a, b) {
    //     return (a.path < b.path) ? -1 : 1
    //   })
    // },

    currentServerConnection() : IServerConnection | null {
      const { currentServerId } = this
      const getSrvrConnByIdFunc = this.$store.getters['getServerConnectionByServerId']
      return getSrvrConnByIdFunc(currentServerId)
    },

    services() : IServiceConnection[] {
      const { currentServerConnection } = this
      let objs : IServiceConnection[] = []
      if (currentServerConnection) {
        objs = currentServerConnection.serviceConnectionsList
      }
      return objs
    },

  },

  methods: {

    handleAddService() {
      const { currentServerId: serverId, currentServerConnection: srvrConn } = this
      const success = (result: {path:string}) => {
        const { path } = result
        const addServiceProps = {
          path,
          serverId,
        }
        if (srvrConn) {
          srvrConn.addService(addServiceProps)
        }
      }
      const cancel = () => console.log('CANCEL add service dialog')

      FGuiCtrl.showAddServiceDialog({ success, cancel })
    },

    _handleRemoveService(service: IServiceConnection) {
      const { currentServerConnection: srvrConn } = this
      if (srvrConn) {
        srvrConn.removeService(service)
      }
    },

    _handleSelectService(service: IServiceConnection) {
      const { currentServerConnection: srvrConn } = this
      if (srvrConn) {
        srvrConn.setSelectedService(service)
      }
    },

  },

})
</script>

<style>
</style>
