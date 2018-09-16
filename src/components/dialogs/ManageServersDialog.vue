<template>
<el-dialog id="manage-server-dialog" :visible="true">

  <template slot="title">
    <div>Manage Feathers Servers</div>
  </template>

  <template v-if="!haveServers">
  <div class="no-server-warning">
    <div class="note">There are no servers to which we can connect. <br />Click the button to add a server.</div>
    <el-button type="success" icon="el-icon-plus" circle
      @click="_handleAddNewServer"
    />
  </div>
  </template>

  <template v-else>
    <el-table
      :data="serverConnectionsList"
      style="width:100%"
      max-height="275"
    >
      <el-table-column width="75" label="Active" prop="isActive"
      >
        <template slot-scope="scope">
        <el-switch
          @change="_handleToggleIsActive(scope.row)"
          :value="scope.row.isActive"
        />
        </template>
      </el-table-column>
      <el-table-column label="Url" prop="url" align="left" />
      <el-table-column label="" width="60">
        <template slot-scope="scope">
        <el-button type="primary" plain icon="el-icon-edit" circle
          @click="_handleEditServer(scope.row)"
        />
        </template>
      </el-table-column>
      <el-table-column label="" width="50">
        <template slot-scope="scope">
        <el-button type="danger" plain icon="el-icon-delete" circle
          @click="_handleRemoveServer(scope.row)"
        />
        </template>
      </el-table-column>
    </el-table>
  </template>

  <template slot="footer" >
  <span class="dialog-footer">
    <el-button type="success" icon="el-icon-plus"
      @click="_handleAddNewServer"
    >
      Add Server
    </el-button>
    <el-button type="primary"
      :disabled="!canConfirmDialog"
      @click="_handleConfirmDialog"
    >
      Done
    </el-button>
  </span>
  </template>

</el-dialog>
</template>

<script lang="ts">
// Libs
import Vue from 'vue'

// Constants / Interfaces
import { ServerStruct, IServerConnection } from '@/interfaces'

// Components
import FGuiCtrl from '@/controllers/feathers-gui-ctrl'
import { Server } from 'http'

export default Vue.extend({

  name: 'ManageServerDialog',

  props: ['cancel', 'success'],

  data() {
    return {
    }
  },

  computed: {

    canConfirmDialog() : boolean {
      const { activeServers } = this
      return (activeServers.length > 0)
    },

    activeServers() : IServerConnection[] {
      const { serverConnectionsList } = this
      return serverConnectionsList.filter(item => item.isActive === true)
    },

    haveServers() : boolean {
      const { serverConnectionsList } = this
      return (serverConnectionsList.length > 0)
    },

    serverConnectionsList() : IServerConnection[] {
      return this.$store.getters['getServerConnectionsList']
    },

  },

  methods: {

    getServerConnectionByServerId(serverId:string) : IServerConnection | null {
      const getSrvrConnByIdFunc = this.$store.getters['getServerConnectionByServerId']
      return getSrvrConnByIdFunc(serverId)
    },

    _handleAddNewServer() {
      FGuiCtrl.showAddEditServerDialog()
    },

    _handleEditServer(server: IServerConnection) {
      FGuiCtrl.showAddEditServerDialog(server)
    },

    _handleRemoveServer(server: IServerConnection) {
      FGuiCtrl.removeServer(server)
    },

    _handleConfirmDialog() {
      const { success } = this
      if (success) success()
    },

    _handleToggleIsActive(server: ServerStruct) {
      const { id } = server
      const sC = this.getServerConnectionByServerId(id)
      if (sC) {
        sC.toggleActiveState()
      }
    },

  },

})
</script>

<style lang="scss" scoped>
#manage-server-dialog {

  .no-server-warning {

    .note {
      margin-bottom: 16px;
    }
  }
  .dialog-footer {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  }
}
</style>
