<template>
  <div id="record-inspector">
    <div class="section-title">Record Inspector</div>

    <div v-if="recordId === null">no service selected</div>

    <div v-else-if="noRecordAvail">No Record to Display</div>

    <template v-else>
      <div style="text-align: center">
        <div style="padding: 15px 0 10px 0">
          Rec ID: <span class="selected-path">{{ recordId }}</span>
        </div>

        <el-input
          type="textarea"
          placeholder="input"
          :rows="12"
          :style="textAreaStyles"
          v-model="textAreaStr"
        />

        <div class="text-error" v-if="!isValid">Invalid JSON !</div>

        <el-checkbox style="margin-top: 10px" v-model="showPrettyPrint">
          Pretty Print
        </el-checkbox>

        <hr />

        <el-button
          type="primary"
          size="small"
          icon="el-icon-upload"
          style="width: 200px"
          @click="_handleUpdateRecord"
          :disabled="!isValid || !isModified"
        >
          Update
        </el-button>
        <el-button
          type="primary"
          size="small"
          icon="el-icon-upload"
          style="width: 200px"
          @click="_handleResetInspector"
          :disabled="!isModified"
        >
          Reset
        </el-button>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
/*
  Record Inspector component

  displays selected record content. the record can be edited and updated.
*/

// Libs
import Vue from 'vue'

// Constants & Interfaces
import { DataRecord } from '@/services/feathers-server.interfaces'
import { IService } from '@/models/service.interfaces'

// Utils
import {
  cleanFeathersRecord,
  jsonStr,
  pJsonStr,
  validateJsonStr,
} from '@/utils/data-utils'

/*
  Vuejs Interfaces
*/
interface IProps {
  recordId: string
  serviceInstance: IService
}

interface IData {
  jsonStr: string
  inReset: boolean
  isValid: boolean
  showPrettyPrint: boolean
  textAreaStr: string
}

interface IComputed {
  isModified: boolean
  textAreaStyles: DataRecord
  selectedRecord: DataRecord | null
  noRecordAvail: boolean
}

interface IMethods {
  updateTextAreaStr(record: DataRecord): void
  _handleUpdateRecord(): void
  _handleResetInspector(): void
  resetJsonRecord(): void
  clearIsModified(): void
}

export default Vue.extend<IData, IMethods, IComputed, IProps>({
  props: {
    recordId: {
      type: String,
      required: true,
    },
    serviceInstance: {
      type: Object as () => IService,
      required: true,
    },
  },

  data() {
    return {
      jsonStr: '',
      inReset: false,
      isValid: true,
      showPrettyPrint: true,
      textAreaStr: '',
    }
  },

  computed: {
    isModified(): boolean {
      const { jsonStr } = this
      return jsonStr !== ''
    },

    textAreaStyles(): DataRecord {
      const { isValid } = this
      let style: DataRecord = {}
      if (!isValid) {
        style = {
          border: '2px solid red',
        }
      }
      return style
    },

    selectedRecord(): DataRecord | null {
      const { serviceInstance, recordId } = this

      const fRec = recordId ? serviceInstance.getRecordById(recordId) : null
      return fRec ? cleanFeathersRecord(fRec) : null
    },

    noRecordAvail(): boolean {
      return this.selectedRecord === null
    },
  },

  methods: {
    updateTextAreaStr(record: DataRecord) {
      const { showPrettyPrint } = this
      this.textAreaStr = showPrettyPrint ? pJsonStr(record) : jsonStr(record)
    },

    _handleUpdateRecord() {
      const { serviceInstance, textAreaStr, recordId } = this
      const data = JSON.parse(textAreaStr)

      serviceInstance
        .updateRecord(recordId, data)
        .then((result) => console.log('OK record update record', result))
        .then((result) => {
          this.clearIsModified()
          return result
        })
        .catch((err) => console.warn('ERR update record', err))
    },

    _handleResetInspector() {
      this.resetJsonRecord()
    },

    resetJsonRecord() {
      const { selectedRecord } = this // showPrettyPrint
      this.inReset = true
      if (selectedRecord === null) {
        this.textAreaStr = ''
      } else {
        this.updateTextAreaStr(selectedRecord)
      }
      this.clearIsModified()
    },

    clearIsModified() {
      this.jsonStr = ''
    },
  },

  watch: {
    selectedRecord() {
      this.resetJsonRecord()
    },

    textAreaStr(newVal) {
      const { inReset } = this // showPrettyPrint
      this.isValid = validateJsonStr(newVal)
      if (!inReset) {
        this.jsonStr = jsonStr(newVal)
      }
      this.inReset = false
    },

    showPrettyPrint() {
      const { textAreaStr } = this
      const rec = JSON.parse(textAreaStr)
      this.updateTextAreaStr(rec)
    },
  },
})
</script>

<style lang="scss" scoped>
#record-inspector {
  .text-error {
    color: red;
    margin: 10px 0 5px;
  }
  .selected-path {
    font-weight: bold;
    font-family: Courier New, Courier, monospace;
  }
}
</style>
