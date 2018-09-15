<template>
<el-dialog class="add-service-dialog" title="Add a New Service" :visible="true">
  <el-form
    v-model="addServiceForm"
  >
    <el-form-item label="Enter Service Path:">
      <el-input
        v-model="addServiceForm.path"
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
    >
      Save
    </el-button>
  </span>
</el-dialog>
</template>

<script lang="ts">
// Libs
import Vue from 'vue'

export default Vue.extend({

  props: ['data', 'cancel', 'success'],

  data() {
    return {
      addServiceForm: {
        path: '',
      },
    }
  },

  methods: {

    handleCancelDialog() {
      const { cancel } = this
      if (cancel) cancel()
    },

    handleConfirmDialog() {
      const { success, addServiceForm } = this
      if (success) success({ path: addServiceForm.path })
    },

  },

})
</script>
