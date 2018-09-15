<template>
<div style="padding-top:10px;padding-bottom:10px">
  <el-button type="primary" size="small" icon="el-icon-plus"
    @click="_handleAddRecord"
  >
    Record
  </el-button>

  <el-button type="primary" size="small" icon="el-icon-minus"
    @click="_handleRemoveRows"
    :disabled="!haveSelectedRecords"
  >
    Row
  </el-button>

  <el-button type="primary" size="small"
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

  shows main action buttons for the Service Viewer
*/
// Libs
import Vue from 'vue'

// Constants / Interfaces
import {
  DataRecord,
  FeathersRecord,
  IServiceConnection,
  ShowSelectServiceFieldsDialogProps,
  SelectServiceFieldsDialogData
} from '@/interfaces'

// Components
import FGuiCtrl from '@/controllers/feathers-gui-ctrl'

export default Vue.extend({

  props: ['serviceConnection'],

  computed: {

    selectedRecords(): FeathersRecord[] {
      const { serviceConnection } = this
      return serviceConnection.selectedRecords
    },

    haveSelectedRecords() : boolean {
      const { selectedRecords } = this
      return (selectedRecords.length > 0)
    },

    serviceFields() : DataRecord[] {
      const { serviceConnection } = this
      const { fields } = serviceConnection
      return fields
    },

    haveFields() : boolean {
      const { serviceFields } = this
      return (serviceFields.length > 0)
    },

    selectFieldsIcon() {
      const { haveFields } = this
      return (haveFields) ? 'el-icon-edit' : 'el-icon-plus'
    },

  },

  methods: {

    _handleAddRecord() {
      const { serviceConnection } = this

      const record = serviceConnection.getRepresentativeRecord({ cleanId: true })
      const success = (jsonStr:string) => {
        const rec = JSON.parse(jsonStr) // make into data record
        serviceConnection.createRecord(rec)
          .then((result:any) => console.log('OK create record', result))
          .catch((err:any) => console.warn('ERR create record', err))
      }

      FGuiCtrl.showAddServiceRecordDialog({ success, record })
    },

    _handleRemoveRows() {
      const { serviceConnection } = this
      serviceConnection.removeSelectedRecords()
        .then((result:any) => console.log('OK removed records', result))
        .catch((err:any) => console.warn('ERR removed records', err))
    },

    _handleSelectFields() {
      const { serviceConnection } = this

      const record = serviceConnection.getRepresentativeRecord({ cleanId: false })
      const success = (fields:DataRecord) => {
        serviceConnection.updateFields(fields)
      }
      const data: SelectServiceFieldsDialogData = {
        record,
        serviceConnection,
      }
      FGuiCtrl.showSelectServiceFieldsDialog({ success, data })
    },

  },

})
</script>
