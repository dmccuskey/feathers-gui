// Libs
import Vue from 'vue'

// Constants / Interfaces
import {
  DataRecord,
  FeathersRecord,
  GetRepresentativeRecordProps,
  IServerConnection,
  IServerConnectionIsInitializedEvent,
  IServiceConnection,
  IServiceConnectionData,
  ServiceFieldsStruct,
  ServiceProps,
  ServiceStruct
} from '@/interfaces'

// Components
import store from '@/store'

// Utils
import {
  cleanFeathersRecord,
  cloneFeathersRecord,
  cloneRecord,
  createFindItemId,
  createRepresentativeRecord,
  unpackPropertyTypeStruct
} from '@/utils/data-utils'
import { ServerConnectionEvents } from '@/app-constants'

export const ServiceConnectionClass = Vue.extend({

  name: 'service-connection',

  props: [ 'id', 'data', 'serverConnection' ],

  data() : IServiceConnectionData {
    return {
      fieldsValue: [],
      filtersValue: [],
      pathValue: '',

      isInitialized: false,
      params: {},
      records: [],
      representative: { _id: '' },
      saveTimerRef: null,
      selectedRecords: [],
      selectedRecord: null,
    }
  },

  computed: {

    fields: {
      get() : ServiceFieldsStruct[] {
        return this.fieldsValue
      },
      set(newValue:ServiceFieldsStruct[]) {
        this.fieldsValue = newValue
        if (this.isInitialized) this._isDirty()
      },
    },

    filters: {
      get() : DataRecord[] {
        return this.filtersValue
      },
      set(newValue:DataRecord[]) {
        this.filtersValue = newValue
        if (this.isInitialized) this._isDirty()
      },
    },

    path: {
      get() : string {
        return this.pathValue
      },
      set(newValue:string) {
        this.pathValue = newValue
        if (this.isInitialized) this._isDirty()
      },
    },

    serverId() : string {
      const { serverConnection } = this
      return serverConnection.id
    },

    currentServiceId() : string | null {
      return store.getters['currentServiceId']
    },

  },

  methods: {

    setSelectedRecord(record:FeathersRecord | null) {
      this.selectedRecord = record
      this._saveSelectedRecord()
    },

    updateFields(packedfields:DataRecord) {
      this.fields = unpackPropertyTypeStruct(packedfields)
    },

    updateService(props:ServiceProps) {
      const { fields, filters, path } = props
      this.fields = fields
      this.filters = filters
      this.path = path
    },

    updateRepresentativeRecord(record:FeathersRecord) {
      const { representative } = this
      this.representative = Object.assign({}, representative, record)
    },

    getRepresentativeRecord(props: GetRepresentativeRecordProps) : DataRecord | FeathersRecord {
      const { representative, fields } = this
      let { count, cleanId } = props
      count = count || 5
      cleanId = (cleanId === undefined) ? true : cleanId

      let dRec: DataRecord
      if (cleanId) {
        dRec = cleanFeathersRecord(representative)
      } else {
        dRec = cloneRecord(representative)
      }
      return createRepresentativeRecord(dRec, fields)
    },

    // data record CRUD actions

    createRecord(record:DataRecord) : Promise<any> {
      const { params, path, serverConnection } = this
      return serverConnection.create(path, record, params)
    },

    updateRecord(id:string, record:DataRecord) : Promise<any> {
      const { params, path, serverConnection } = this
      return serverConnection.update(path, id, record, params)
    },

    readRecord(id:string) : DataRecord | null {
      const { records } = this
      const findById = createFindItemId(id)
      const idx = records.findIndex(findById)
      return (idx === -1) ? null : cleanFeathersRecord(records[idx])
    },

    deleteRecord(id:string) : Promise<any> {
      const { path, serverConnection } = this
      return serverConnection.remove(path, id)
    },

    removeSelectedRecords() : Promise<any> {
      const { selectedRecords, serverConnection } = this
      const promises:Promise<any>[] = []

      if (serverConnection) {
        selectedRecords.forEach(record => {
          const { _id } = record
          const p = this.deleteRecord(_id)
          promises.push(p)
        })
      }
      return Promise.all(promises)
        .then(result => {
          this.selectedRecords = []
          return result
        })
    },

    _clearRecords() {
      this.records = []
    },

    _handleOnCreated(record:FeathersRecord) {
      const item = cloneFeathersRecord(record)
      this.records.push(item)
      this.updateRepresentativeRecord(item)
    },

    _handleOnUpdated(record:FeathersRecord) {
      const { records } = this
      const { _id } = record

      const findById = createFindItemId(_id)
      const idx = records.findIndex(findById)
      if (idx === -1) {
        console.warn('GUI WARN: record not found', record)
      } else {
        records.splice(idx, 1, record)
        this.updateRepresentativeRecord(record)
      }
    },

    _handleOnRemoved(record:FeathersRecord) {
      const { records } = this
      const { _id } = record

      const findById = createFindItemId(_id)
      const idx = records.findIndex(findById)
      if (idx === -1) {
        console.warn('GUI WARN: record not found', record)
      } else {
        records.splice(idx, 1)
      }
    },

    _loadRecords() {
      const { params, serverConnection, path } = this
      const processResults = (function(self) {
        return function(records:any[]) {
          records.forEach(function(record) {
            const item = cloneFeathersRecord(record)
            self.records.push(item)
            self.updateRepresentativeRecord(item)
          })
        }
      })(this)

      serverConnection.find(path, params)
        .then((results:FeathersRecord) => results.data || [])
        .then(processResults)
        .catch((err:any) => console.warn('err', err))
    },

    _handleServerIsInitialized(event:IServerConnectionIsInitializedEvent) {
      const { data, target } = event
      // console.warn('SRVC CONN server is ready', data)
      if (data) {
        this._doServerIsInitializedActions()
      } else {
        this._doServerNotInitializedActions()
      }
    },

    _setupListeners() {
      const { IS_INITIALIZED } = ServerConnectionEvents
      const { serverConnection } = this
      serverConnection.$on(IS_INITIALIZED, this._handleServerIsInitialized)
    },

    _removeListeners() {
      const { IS_INITIALIZED } = ServerConnectionEvents
      const { serverConnection } = this
      serverConnection.$off(IS_INITIALIZED, this._handleServerIsInitialized)
    },

    _doServerIsInitializedActions() {
      this._loadRecords()
      this._setupServerInitListeners()
    },

    _doServerNotInitializedActions() {
      this._clearRecords()
      this._removeServerInitListeners()
    },

    _setupServerInitListeners() {
      const { serverConnection } = this
      serverConnection.onCreated(this.path, this._handleOnCreated)
      serverConnection.onRemoved(this.path, this._handleOnRemoved)
      serverConnection.onUpdated(this.path, this._handleOnUpdated)
    },

    _removeServerInitListeners() {
      const { serverConnection } = this
      serverConnection.offCreated(this.path, this._handleOnCreated)
      serverConnection.offRemoved(this.path, this._handleOnRemoved)
      serverConnection.offUpdated(this.path, this._handleOnUpdated)
    },

    /*
      when value is changed, start timer to save in store
    */
    _isDirty() {
      const { saveTimerRef } = this
      if (saveTimerRef) {
        clearTimeout(saveTimerRef)
      }
      this.saveTimerRef = setTimeout(() => {
        this._saveServiceToStore()
        this.saveTimerRef = null
      }, 50)
    },

    _saveServiceToStore() {
      // saveServiceToStore _removeCurrentState
      const { id, fields, filters, path, serverId } = this
      const srvcStruct: ServiceStruct = { id, fields, filters, path, serverId }
      store.commit('updateService', srvcStruct)
    },

    _removeServiceFromStore() {
      const { id, currentServiceId } = this
      store.commit('removeServiceById', { id })
      if (id === currentServiceId) {
        store.dispatch('setCurrentService', null)
      }
    },

    _saveSelectedRecord() {
      const { selectedRecord } = this
      store.commit('setCurrentRecord', selectedRecord)
    },

  },

  created() {
    const { data, serverConnection } = this

    console.warn(`SRVC CONN Creating service connection: ${data.path}`)

    this.updateService(data) // save initial state
    this._setupListeners()
    if (serverConnection.isInitialized) {
      this._doServerIsInitializedActions()
    }

    this.isInitialized = true
  },

  beforeDestroy() {
    console.warn('SRVC CONN: beforeDestroy')
    this._removeServerInitListeners()
    this._removeListeners()
    this._removeServiceFromStore()
  },

})

/*
  create Service Connection based on structure
*/
export const createServiceConnection = function(srvcConn:IServerConnection, record: ServiceStruct) : IServiceConnection {
  const { id, fields, filters, path } = record
  const data = { fields, filters, path } // modifiable properties
  return new ServiceConnectionClass({
    propsData: {
      id, data, serverConnection: srvcConn,
    },
  })
}

/*
  destroy Service Connection
*/
export const destroyServiceConnection = function(srvcConn:IServiceConnection) {
  srvcConn.$destroy()
}
