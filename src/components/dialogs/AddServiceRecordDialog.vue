<template>
<el-dialog title="Type in your record" :visible="true">

  <el-input type="textarea" placeholder="input" :rows="10"
    v-model="textAreaStr"
    :style="textAreaStyles"
  />

  <div v-if="!isValid" class="text-error">Invalid JSON !</div>

  <span slot="footer" class="dialog-footer">
    <el-button
      @click="handleCancelDialog"
    >
      Cancel
    </el-button>
    <el-button type="primary"
      @click="handleConfirmDialog"
      :disabled="!isValid"
    >
      Create
    </el-button>
  </span>
</el-dialog>
</template>

<script lang="ts">
// Libs
import Vue from 'vue'

// Constants / Interfaces
import { DataRecord } from '@/interfaces'

// Utils
import { pJsonStr, validateJsonStr } from '@/utils/data-utils'

export default Vue.extend({

  props: ['data', 'cancel', 'success'],

  data() {
    return {
      textAreaStr: '',
    }
  },

  computed: {

    isValid() : boolean {
      const { textAreaStr } = this
      return validateJsonStr(textAreaStr)
    },

    textAreaStyles() : DataRecord {
      const { isValid } = this
      let styles: DataRecord = {}
      if (!isValid) {
        styles.border = '2px solid red'
      }
      return styles
    },

  },

  methods: {

    handleCancelDialog() {
      const { cancel } = this
      if (cancel) cancel()
    },

    handleConfirmDialog() {
      const { success, textAreaStr } = this
      if (success) success(textAreaStr)
    },

  },

  created() {
    const { data } = this
    const record = data || {}
    this.textAreaStr = pJsonStr(record)
  },

})
</script>
