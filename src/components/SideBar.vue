<template>
<div id="side-bar">
  <div class="section-title">Services</div>

  <table style="width:100%;padding-top:10px">
    <col width="*">
    <col width="60">
    <tr
      v-for="rec in services"
      :key="rec.path"
    >
      <td>
        <el-tooltip effect="dark" :content="rec.isError.message" placement="right"
          v-if="rec.isError"
        >
          <el-button class="btn-srvc" type="warning" plain size="medium" icon="el-icon-warning"
          >
            {{rec.path}}
          </el-button>
        </el-tooltip>
        <el-button class="btn-srvc" type="info" size="medium"
          @click="_handleSelectService( rec )"
          v-else
        >
          {{rec.path}}
        </el-button>
      </td>
      <td>
        <el-button type="danger" plain size="small" icon="el-icon-delete" circle
          @click="_handleRemoveService( rec )"
        />
      </td>
    </tr>
  </table>

  <hr />

  <el-button type="success" plain size="small" icon="el-icon-plus"
    @click="_handleAddService"
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

    _handleAddService() {
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

      if (srvrConn) {
        FGuiCtrl.showAddServiceDialog({ serverConnection: srvrConn, success })
      } else {
        console.warn('showAddServiceDialog: no server connection')
      }
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

<style lang="scss" scoped>
#side-bar {

  .btn-srvc {
    width: 100%;
    text-align: left;
    font-family: courier
  }
}
</style>
