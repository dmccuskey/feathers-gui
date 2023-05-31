<template>
  <div id="records-viewer">
    <div v-if="!haveRecords">No Records in Service</div>

    <div style="text-align: center; margin-top: 40px" v-else-if="!haveFields">
      <div style="margin-bottom: 10px">
        Click button to add some fields for display:
      </div>
      <el-button
        type="primary"
        icon="el-icon-plus"
        @click="_handleSelectFields"
      >
        Add Display Fields
      </el-button>
    </div>

    <template v-else>
      <el-table
        style="width: 100%"
        :stripe="true"
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
            <div v-html="_formatFieldData(scope.row, scope.column)"></div>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </div>
</template>

<script lang="ts">
// Libs
import Vue from 'vue'

// Constants / Interfaces
import { FeathersRecord } from '@/services/feathers-server.interfaces'
import {
  IService,
  PropertyLookupHash,
  ServiceField,
} from '@/models/service.interfaces'
import { SelectServiceFieldsDialogProps } from '@/controllers/dialog.interfaces'

// Components
import AppCtrl from '@/controllers/app-ctrl.model'

// Utils
import { packPropertyTypeStruct } from '@/utils/data-utils'

const showQuotes = true

const noDataStr = (txt: string) => {
  return `<span class="no-data">&lt;${txt}&gt;</span>`
}

const getSortFunc = (label: string, lookup: PropertyLookupHash) => {
  let type = lookup[label]

  let func
  switch (type) {
    case 'number':
    case 'date':
      func = (a: FeathersRecord, b: FeathersRecord) => {
        return a[label] - b[label]
      }
      break
    case 'string':
    default:
      func = (a: FeathersRecord, b: FeathersRecord) => {
        if (a[label] > b[label]) return 1
        if (a[label] < b[label]) return -1
        return 0
      }
      break
  }
  return func
}

interface ColumnProps {
  label: string
}

/*
  Vuejs Interfaces
*/
interface IProps {
  serviceInstance: IService
}

interface IData {
  height: number
  sortField: string
  sortReverse: boolean
}

interface IComputed {
  fields: ServiceField[]
  haveFields: boolean
  haveRecords: boolean
  propertyTypeLookup: PropertyLookupHash
  records: FeathersRecord[]
}

interface IMethods {
  _handleHeaderClick: (column: ColumnProps) => void
  _handleRowClick: (record: FeathersRecord) => void
  _handleSelectFields: () => void
  _handleSelectionChange: (selectedRows: FeathersRecord[]) => void
  _formatFieldData: (
    record: FeathersRecord,
    column: { label: string }
  ) => string
}

export default Vue.extend<IData, IMethods, IComputed, IProps>({
  props: {
    serviceInstance: {
      type: Object as () => IService,
    },
  },

  data() {
    return {
      height: 800,
      sortField: '_id',
      sortReverse: false,
    }
  },

  computed: {
    fields() {
      return this.serviceInstance.fields || []
    },

    haveFields() {
      const { fields } = this
      return fields.length > 0
    },

    propertyTypeLookup() {
      const fields = this.fields
      return packPropertyTypeStruct(fields)
    },

    records() {
      const { propertyTypeLookup, serviceInstance, sortField, sortReverse } =
        this
      const { records } = serviceInstance

      const sortFunc = getSortFunc(sortField, propertyTypeLookup)
      records.sort(sortFunc)
      if (sortReverse) {
        records.reverse()
      }

      return records
    },

    haveRecords(): boolean {
      return this.records.length > 0
    },
  },

  methods: {
    _handleHeaderClick(column: ColumnProps) {
      const { sortField, sortReverse } = this
      const { label } = column
      this.sortReverse = sortField === label ? !sortReverse : false
      this.sortField = label
    },

    _handleRowClick(record: FeathersRecord) {
      AppCtrl.setCurrentRecordId(record._id)
    },

    _handleSelectionChange(selectedRows: FeathersRecord[]) {
      const { serviceInstance } = this
      serviceInstance.selectedRecords = selectedRows
    },

    _formatFieldData(record: FeathersRecord, column: ColumnProps) {
      const { propertyTypeLookup: lookup } = this
      const { label } = column // eg, 'account_id'

      let type = lookup[label]
      let data = record[label] // eg, '3425325'

      if (data === undefined) {
        data = noDataStr('undefined')
        type = 'undefined'
      }

      let result
      switch (type) {
        case 'undefined':
          result = noDataStr('undefined')
          break
        case 'number':
          result = data == null ? noDataStr('null') : data
          break
        case 'string':
          if (data == null) {
            result = noDataStr('null')
          } else {
            result = data.toString()
            if (showQuotes) {
              result = `"${result}"`
            } else {
              result = result === '' ? noDataStr('empty') : result
            }
          }
          break
        case 'array':
          if (data == null) {
            result = noDataStr('null')
          } else if (Array.isArray(data)) {
            result = `[ ${data.toString()} ]`
          } else {
            result = noDataStr('not an array')
          }
          break
        case 'date':
          try {
            if (data == null) {
              result = noDataStr('null')
            } else {
              const d = new Date(data)
              result = d.toISOString()
            }
          } catch (err) {
            result = noDataStr('not a date')
          }
          break
        case 'object':
          try {
            if (data == null) {
              result = noDataStr('null')
            } else {
              result = JSON.stringify(data, null, ' ')
            }
          } catch (err) {
            result = noDataStr('not an object')
          }
          break
        case 'boolean':
        case 'relation':
        default:
          result = data == null ? noDataStr('null') : data.toString()
          break
      }
      return result
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

<style lang="scss">
#records-viewer {
  .no-data {
    color: #aaa;
    font-style: italic;
  }
}
</style>
