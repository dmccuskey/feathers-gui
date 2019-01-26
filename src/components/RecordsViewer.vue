<template>
<div id="records-viewer">
  <div
    v-if="serviceId === null"
  >
    no service selected
  </div>

  <div
    v-else-if="!haveRecords"
  >
    No Records in Service
  </div>

  <div style="text-align:center;margin-top:40px"
    v-else-if="!haveFields"
  >
    <div style="margin-bottom:10px">
      Click button to add some fields for display:
    </div>
    <el-button
      type="primary" icon="el-icon-plus"
      @click="handleSelectFields"
    >
      Add Fields
    </el-button>
  </div>

  <template v-else>
  <el-table style="width:100%" :stripe="true"
    :data="records"
    row-key="_id"
    :show-header="true"
    :border="true"
    :height="height"
    @row-click="_handleRowClick"
    @selection-change="_handleSelectionChange"
    @header-click="_handleHeaderClick"
  >
    <el-table-column type="selection" width="50" />
    <el-table-column
      v-for="field in fields"
      :prop="field.property"
      :key="field.property"
      :label="field.property"
      resizable
    >
      <template slot-scope="scope">
        <div v-html="formatFieldData(scope.row, scope.column)"></div>
      </template>
    </el-table-column>
  </el-table>
  </template>
</div>
</template>

<script lang="ts">
// Libs
import Vue from 'vue'

// Components
import FGuiCtrl from '../controllers/feathers-gui-ctrl'

// Utils
import { packPropertyTypeStruct } from '@/utils/data-utils'

// Constants / Interfaces
import {
  DataRecord,
  FeathersRecord,
  PropertyLookupHash,
  SelectServiceFieldsDialogData,
  IServiceConnection,
  ServiceFieldsStruct
} from '@/interfaces'

const showQuotes = true

const getSortFunc = (label: string, lookup: PropertyLookupHash) => {
  let type = lookup[ label ]

  let func
  switch (type) {
    case 'number':
    case 'date':
      func = (a: any, b: any) => {
        return a[label] - b[label]
      }
      break
    case 'string':
    default:
      func = (a: any, b: any) => {
        if (a[label] > b[label]) return 1
        if (a[label] < b[label]) return -1
        return 0
      }
      break
  }
  return func
}

export default Vue.extend({

  props: ['serviceConnection', 'serviceId'],

  data() {
    return {
      height: 460,
      sortField: '_id',
      sortReverse: false,
    }
  },

  computed: {

    fields() : ServiceFieldsStruct[] {
      const { serviceConnection } = this
      return serviceConnection.fields || []
    },

    haveFields() : boolean {
      const { fields } = this
      return (fields.length > 0)
    },

    propertyTypeLookup() : PropertyLookupHash {
      const fields = this.fields
      return packPropertyTypeStruct(fields)
    },

    records() : FeathersRecord[] {
      const { propertyTypeLookup, serviceConnection, sortField, sortReverse } = this
      const { records } = serviceConnection

      const sortFunc = getSortFunc(sortField, propertyTypeLookup)
      records.sort(sortFunc)
      if (sortReverse) {
        records.reverse()
      }

      return records
    },

    haveRecords() : boolean {
      const { records } = this
      return (records.length > 0)
    },

  },

  methods: {

    _handleHeaderClick(column: any) {
      const { sortField, sortReverse } = this
      const { label } = column
      this.sortReverse = (sortField === label) ? !sortReverse : false
      this.sortField = label
    },

    _handleRowClick(record:FeathersRecord) {
      const { serviceConnection } = this
      const { _id: id } = record
      serviceConnection.setSelectedRecord(record)
    },

    _handleSelectionChange(selectedRows: FeathersRecord[]) {
      const { serviceConnection } = this
      serviceConnection.selectedRecords = selectedRows
    },

    formatFieldData(record: any, column:{ label:string }) {
      const { propertyTypeLookup: lookup } = this
      const { label } = column // eg, 'account_id'
      let type = lookup[ label ]

      let data = record[ label ] // eg, '3425325'
      if (data === undefined) {
        data = '<span class="no-data">&lt;undefined&gt;</span>'
        type = 'undefined'
      }

      let result
      switch (type) {
        case 'undefined':
          result = data
          break
        case 'number':
          result = data
          break
        case 'string':
          result = data.toString()
          if (showQuotes) {
            result = `"${result}"`
          } else {
            result = (result === '') ? '<span class="no-data">&lt;empty&gt;</span>' : result
          }
          break
        case 'array':
          result = data.toString()
          result = `[ ${result} ]`
          break
        case 'date':
          let d = new Date(data)
          result = d.toISOString()
          break
        case 'boolean':
        case 'object':
        case 'relation':
        default:
          result = data.toString()
          break
      }
      return result
    },

    handleSelectFields() {
      const { serviceConnection } = this

      const record = serviceConnection.getRepresentativeRecord({ cleanId: false })
      const success = (fields:DataRecord) => {
        serviceConnection.updateFields(fields)
      }
      const data: SelectServiceFieldsDialogData = {
        record,
        serviceConnection,
      }
      FGuiCtrl.showSelectServiceFieldsDialog({ data })
    },

  },

})
</script>

<style lang="scss">
#records-viewer {
  .no-data {
    color: #aaa;
    font-style: italic;
  }
}
</style>
