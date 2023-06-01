<template>
  <el-dialog id="manage-server-dialog" :visible="true">
    <template slot="title">
      <div>Manage Feathers Servers</div>
    </template>

    <template v-if="!haveServers">
      <div class="no-server-warning">
        <div class="note">There are no servers to which we can connect.</div>
        <div class="note">Click the button to add a server.</div>
      </div>
    </template>

    <template v-else>
      <el-table :data="serversList" style="width: 100%" max-height="275">
        <el-table-column width="75" label="Active" prop="isActive">
          is active
        </el-table-column>
        <el-table-column label="Name" prop="name" align="left" width="120" />
        <el-table-column label="Url" prop="url" align="left" />
        <el-table-column label="" width="60">
          <template slot-scope="scope">
            <el-button
              type="primary"
              plain
              icon="el-icon-edit"
              circle
              @click="_handleEditServer(scope.row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="" width="50">
          <template slot-scope="scope">
            <el-button
              type="danger"
              plain
              icon="el-icon-delete"
              circle
              @click="_handleRemoveServer(scope.row)"
            />
          </template>
        </el-table-column>
      </el-table>
    </template>

    <template slot="footer">
      <span class="dialog-footer">
        <el-button
          type="success"
          icon="el-icon-plus"
          @click="_handleAddNewServer"
        >
          Add Server
        </el-button>
        <el-button type="primary" @click="_handleConfirmDialog">
          Done
        </el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script lang="ts">
// Libs
import Vue from 'vue'
import { Deferred } from 'ts-deferred'

// Constants / Interfaces
import { ShowDialogProps } from '@/controllers/app-ctrl.interfaces'
import { Server } from '@/models/server.interfaces'

// Controllers & Services
import AppCtrl from '@/controllers/app-ctrl.model'

/*
  Vuejs Interfaces
*/
export interface IProps {
  data: ShowDialogProps
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IData {}

export interface IComputed {
  haveServers: boolean
  serversList: Server[]
  deferred: Deferred<void>
}

export interface IMethods {
  _handleAddNewServer(): void
  _handleConfirmDialog(): void
  _handleEditServer(server: Server): void
  _handleRemoveServer(server: Server): void
}

export default Vue.extend<IData, IMethods, IComputed, IProps>({
  name: 'ManageServerDialog',

  props: {
    data: {
      type: Object as () => ShowDialogProps,
      required: true,
    },
  },

  computed: {
    deferred() {
      const { data } = this
      return data.deferred
    },

    haveServers(): boolean {
      const { serversList } = this
      return serversList.length > 0
    },

    serversList() {
      return AppCtrl.serversList
    },
  },

  methods: {
    _handleAddNewServer() {
      void AppCtrl.showAddEditServerDialog()
    },

    _handleEditServer(server: Server) {
      void AppCtrl.showAddEditServerDialog(server)
    },

    _handleRemoveServer(server: Server) {
      AppCtrl.removeServer(server)
    },

    _handleConfirmDialog() {
      const { deferred } = this
      deferred.resolve()
    },
  },
})
</script>

<style lang="scss" scoped>
#manage-server-dialog {
  .no-server-warning {
    .note {
      margin-bottom: 16px;
      text-align: center;
    }
  }
  .dialog-footer {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  }
}
</style>
