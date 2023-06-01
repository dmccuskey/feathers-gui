<template>
  <div style="padding-top: 10px; padding-bottom: 10px">
    <el-button
      type="primary"
      size="small"
      icon="el-icon-plus"
      @click="_handleAddRecord"
    >
      Record
    </el-button>

    <el-button
      type="primary"
      size="small"
      icon="el-icon-minus"
      @click="_handleRemoveRows"
      :disabled="!haveSelectedRecords"
    >
      Row
    </el-button>

    <el-button
      type="primary"
      size="small"
      @click="_handleSelectFields"
      :icon="selectFieldsIcon"
    >
      Fields
    </el-button>
  </div>
</template>

<script lang="ts">
/*
  Service Fields Control

  displays main action buttons for the Service Viewer
*/
// Libs
import Vue from 'vue'

// Constants & Interfaces
import {
  DataRecord,
  FeathersRecord,
} from '@/services/feathers-server.interfaces'
import { IService, ServiceField } from '@/models/service.interfaces'
import { SelectServiceFieldsDialogProps } from '@/controllers/dialog.interfaces'

// Controllers & Services
import AppCtrl from '@/controllers/app-ctrl.model'
import { Events } from '@/controllers/dialog.constants'

/*
  Vuejs Interfaces
*/
interface IProps {
  serviceInstance: IService
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IData {}

interface IComputed {
  selectedRecords: FeathersRecord[]
  haveSelectedRecords: boolean
  serviceFields: ServiceField[]
  haveFields: boolean
  selectFieldsIcon: string
}

interface IMethods {
  _handleAddRecord(): void
  _handleRemoveRows(): void
  _handleSelectFields(): void
}

export default Vue.extend<IData, IMethods, IComputed, IProps>({
  props: {
    serviceInstance: {
      type: Object as () => IService,
      required: true,
    },
  },

  computed: {
    selectedRecords() {
      const { serviceInstance } = this
      return serviceInstance.selectedRecords
    },

    haveSelectedRecords() {
      const { selectedRecords } = this
      return selectedRecords.length > 0
    },

    serviceFields() {
      const { serviceInstance } = this
      return serviceInstance.fields
    },

    haveFields() {
      const { serviceFields } = this
      return serviceFields.length > 0
    },

    selectFieldsIcon() {
      const { haveFields } = this
      return haveFields ? 'el-icon-edit' : 'el-icon-plus'
    },
  },

  methods: {
    _handleAddRecord() {
      const { serviceInstance } = this

      // setup
      const recordTmpl = serviceInstance.getRecordTemplate({
        cleanId: true,
      })

      // promise-chain support
      //
      const processResult = (jsonStr: string) => {
        return JSON.parse(jsonStr)
      }
      //
      const createRecord = (record: DataRecord) => {
        return serviceInstance.createRecord(record)
      }

      // promise-chain
      AppCtrl.showAddServiceRecordDialog({ recordTmpl })
        .then(processResult)
        .then(createRecord)
        .catch((err: unknown) => {
          if (err !== Events.CANCELLED) {
            console.warn('ERR create record', err)
          }
        })
    },

    _handleRemoveRows() {
      const { serviceInstance } = this

      serviceInstance.removeSelectedRecords()
    },

    _handleSelectFields() {
      const { serviceInstance } = this

      const recordTmpl = serviceInstance.getRecordTemplate({
        cleanId: false,
      })
      const props: SelectServiceFieldsDialogProps = {
        recordTmpl,
        serviceInstance,
      }
      void AppCtrl.showSelectServiceFieldsDialog(props)
    },
  },
})
</script>
