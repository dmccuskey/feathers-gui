// Libs
import Vue from 'vue'

// Constants / Interfaces
import {
  DataRecord,
  FeathersError,
  FeathersRecord,
  GetRepresentativeRecordProps,
  IServerConnection,
  IServerConnectionIsInitializedEvent,
  IServiceConnection,
  IServiceConnectionData,
  ServiceFieldsStruct,
  ServiceProps,
  ServiceStruct,
  IServerConnectionIsConnectedEvent,
  IServiceConnectionErrorStruct
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
      isError: null,
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

    readRecord(id:string) : DataRecord | null {
      const { records } = this
      const findById = createFindItemId(id)
      const idx = records.findIndex(findById)
      return (idx === -1) ? null : cleanFeathersRecord(records[idx])
    },

    updateRecord(id:string, record:DataRecord) : Promise<any> {
      const { params, path, serverConnection } = this
      return serverConnection.update(path, id, record, params)
    },

    deleteRecord(id:string) : Promise<any> {
      const { path, serverConnection } = this
      return serverConnection.remove(path, id)
    },

    patchRecord(id:string, record:DataRecord) : Promise<any> {
      const { params, path, serverConnection } = this
      return serverConnection.patch(path, id, record, params)
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
        console.warn('FGUI WARN: record not found', record)
      } else {
        records.splice(idx, 1)
      }
    },

    _handleOnPatched(record:FeathersRecord) {
      const { records } = this
      const { _id } = record
      const findById = createFindItemId(_id)
      const idx = records.findIndex(findById)
      if (idx === -1) {
        console.warn('FGUI WARN: record not found', record)
      } else {
        records.splice(idx, 1, record)
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
        .catch((fError:FeathersError) => {
          console.warn('FGUI:SRVC CONN _loadRecords', fError)
          const { name, message, code } = fError
          const err: IServiceConnectionErrorStruct = {
            code,
            message,
            name,
          }
          this.isError = err
        })
    },

    _handleServerConnectedChange(event:IServerConnectionIsConnectedEvent) {
      const { data } = event
      if (data) {
        this._doServerIsConnectedActions()
      } else {
        this._doServerNotConnectedActions()
      }
    },

    _doServerIsConnectedActions() {
      this._loadRecords()
    },

    _doServerNotConnectedActions() {
      this._clearRecords()
    },

    _handleServerInitializedChange(event:IServerConnectionIsInitializedEvent) {
      const { data } = event
      if (data) {
        this._doServerIsInitializedActions()
      } else {
        this._doServerNotInitializedActions()
      }
    },

    _doServerIsInitializedActions() {
      this._setupServerInitListeners()
    },

    _doServerNotInitializedActions() {
      this._removeServerInitListeners()
    },

    _setupServerBaseListeners() {
      const { IS_CONNECTED, IS_INITIALIZED } = ServerConnectionEvents
      const { serverConnection } = this
      serverConnection.$on(IS_CONNECTED, this._handleServerConnectedChange)
      serverConnection.$on(IS_INITIALIZED, this._handleServerInitializedChange)
    },

    _removeServerBaseListeners() {
      const { IS_CONNECTED, IS_INITIALIZED } = ServerConnectionEvents
      const { serverConnection } = this
      serverConnection.$off(IS_CONNECTED, this._handleServerConnectedChange)
      serverConnection.$off(IS_INITIALIZED, this._handleServerInitializedChange)
    },

    _setupServerInitListeners() {
      const { path, serverConnection } = this

      serverConnection.onCreated(path, this._handleOnCreated)
      serverConnection.onRemoved(path, this._handleOnRemoved)
      serverConnection.onUpdated(path, this._handleOnUpdated)
      serverConnection.onPatched(path, this._handleOnPatched)
    },

    _removeServerInitListeners() {
      const { path, serverConnection } = this

      serverConnection.offCreated(path, this._handleOnCreated)
      serverConnection.offRemoved(path, this._handleOnRemoved)
      serverConnection.offUpdated(path, this._handleOnUpdated)
      serverConnection.offPatched(path, this._handleOnPatched)
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

    // console.log(`SRVC CONN Creating service connection: ${data.path}`)

    this.updateService(data) // save initial state
    this._setupServerBaseListeners()
    if (serverConnection.isInitialized) {
      this._doServerIsInitializedActions()
    }
    if (serverConnection.isConnected) {
      this._doServerIsConnectedActions()
    }

    this.isInitialized = true
  },

  beforeDestroy() {
    this._removeServerInitListeners()
    this._removeServerBaseListeners()
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
