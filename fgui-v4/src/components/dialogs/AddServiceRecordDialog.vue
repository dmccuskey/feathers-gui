<template>
  <el-dialog title="Type in your record" :visible="true">
    <el-input
      type="textarea"
      placeholder="input"
      :rows="10"
      v-model="textAreaStr"
      :style="textAreaStyles"
    />

    <div v-if="!isValid" class="text-error">Invalid JSON !</div>

    <span slot="footer" class="dialog-footer">
      <el-button @click="_handleCancelDialog"> Cancel </el-button>
      <el-button
        type="primary"
        @click="_handleConfirmDialog"
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
import { Deferred } from 'ts-deferred'

// Constants & Interfaces
import { DataRecord } from '@/services/feathers-server.interfaces'
import { ShowDialogProps } from '@/controllers/app-ctrl.interfaces'
import { AddServiceRecordDialogProps } from '@/controllers/dialog.interfaces'
import { Events } from '@/controllers/dialog.constants'

// Utils
import { pJsonStr, validateJsonStr } from '@/utils/data-utils'

/*
  Vuejs Interfaces
*/
interface IProps {
  data: ShowDialogProps
}

interface IData {
  textAreaStr: string
}

interface IComputed {
  props: AddServiceRecordDialogProps
  deferred: Deferred<string>
  isValid: boolean
  textAreaStyles: DataRecord
}

interface IMethods {
  _handleCancelDialog(): void
  _handleConfirmDialog(): void
}

export default Vue.extend<IData, IMethods, IComputed, IProps>({
  props: {
    data: {
      type: Object as () => ShowDialogProps,
      required: true,
    },
  },

  data() {
    return {
      textAreaStr: '',
    }
  },

  computed: {
    props() {
      const { data } = this
      return data.props as AddServiceRecordDialogProps
    },

    deferred() {
      const { data } = this
      return data.deferred
    },

    isValid() {
      const { textAreaStr } = this
      return validateJsonStr(textAreaStr)
    },

    textAreaStyles() {
      const { isValid } = this
      let styles: DataRecord = {}
      if (!isValid) {
        styles.border = '2px solid red'
      }
      return styles
    },
  },

  methods: {
    _handleCancelDialog() {
      this.deferred.reject(Events.CANCELLED)
    },

    _handleConfirmDialog() {
      const { deferred, textAreaStr } = this
      deferred.resolve(textAreaStr)
    },
  },

  created() {
    const { recordTmpl } = this.props

    // save incoming template
    this.textAreaStr = pJsonStr(recordTmpl)
  },
})
</script>
