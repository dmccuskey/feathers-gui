<template>
<el-dialog id="add-edit-server-dialog" title="Update Server" :visible="true">
  add edit server
  <el-form
    v-model="serverForm"
  >
    <el-form-item label="Server Url:">
      <el-input placeholder="http://localhost:8080"
        v-model="serverForm.url"
      />
    </el-form-item>
    <el-form-item label="Active">
      <el-switch
        v-model="serverForm.isActive"
      />
    </el-form-item>
  </el-form>
  <span slot="footer" class="dialog-footer">
    <el-button
      @click="handleCancelDialog"
    >
      Cancel
    </el-button>
    <el-button type="primary"
      @click="handleConfirmDialog"
      :disabled="!canConfirmDialog"
    >
      {{confirmButtonText}}
    </el-button>
  </span>
</el-dialog>
</template>

<script lang="ts">
// Libs
import Vue from 'vue'

export default Vue.extend({

  name: 'add-edit-server-dialog',

  props: ['data', 'cancel', 'success'],

  data() {
    return {
      serverForm: {
        id: null,
        url: '',
        isActive: false,
        authentication: null,
      },
    }
  },

  computed: {

    canConfirmDialog() : boolean {
      return (this.serverForm.url !== '')
    },

    serverId() : string | null {
      const { data } = this
      return data.serverId || null
    },

    haveServerId() : boolean {
      const { serverForm } = this
      return (serverForm.id !== null)
    },

    isEditAction() : boolean {
      return this.haveServerId
    },

    confirmButtonText() : string {
      const { isEditAction } = this
      return (isEditAction) ? 'Update' : 'Create'
    },

  },

  methods: {

    handleCancelDialog() {
      const { cancel } = this
      if (cancel) cancel()
    },

    handleConfirmDialog() {
      const { success, serverForm } = this
      const { id, url, isActive, authentication } = serverForm
      if (success) success({ id, url, isActive, authentication })
    },

  },

  created() {
    console.log('createsd stu', this.data)
    const data = this.data || {}
    const { serverForm } = this
    serverForm.url = data.url || ''
    serverForm.id = data.id || null
    serverForm.isActive = (data.isActive === undefined) ? false : data.isActive
  },

})
</script>
