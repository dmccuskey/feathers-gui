<template>
<el-dialog id="add-service-dialog" title="Add a New Service" :visible="true">
  <el-form
    v-model="addServiceForm"
  >
    <el-form-item label="Enter Service Path:">
      <el-input
        v-model="addServiceForm.path"
      />
    </el-form-item>
  </el-form>
  <div v-if="!isPathValid" class="text-error">That service path already exists !</div>
  <span slot="footer" class="dialog-footer">
    <el-button
      @click="_handleCancelDialog"
    >
      Cancel
    </el-button>
    <el-button type="primary"
      :disabled="!isPathValid"
      @click="_handleConfirmDialog"
    >
      Save
    </el-button>
  </span>
</el-dialog>
</template>

<script lang="ts">
// Libs
import Vue from 'vue'
import { IServerConnection } from '@/interfaces'

export default Vue.extend({

  props: ['data', 'cancel', 'success'],

  data() {
    return {
      addServiceForm: {
        path: '',
      },
    }
  },

  computed: {

    isPathValid() : boolean {
      const { serverConnection, path } = this
      return (serverConnection.hasService(path) === false)
    },

    path() : string {
      const { addServiceForm } = this
      return addServiceForm.path
    },

    serverConnection() : IServerConnection {
      const { serverConnection } = this.data
      return serverConnection
    },

  },

  methods: {

    _handleCancelDialog() {
      const { cancel } = this
      if (cancel) cancel()
    },

    _handleConfirmDialog() {
      const { success, addServiceForm } = this
      if (success) success({ path: addServiceForm.path })
    },

  },

})
</script>

<style lang="scss" scoped>
#add-service-dialog {

  .text-error {
    color:red;
    margin: 10px 0 5px
  }
}
</style>
