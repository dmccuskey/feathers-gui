/*
  Feathers Service Class

  there is a single instance per service path, eg 'messages'

  the model handles loading data and event handling from Feathers service
  as well as manipulating data for display in the UI

  changes to Service config updated in Vuex store
*/

// Libs
import Vue from 'vue'
import Debug from 'debug'

// Constants / Interfaces
import { Paginated, Params } from '@feathersjs/feathers'
import { FeathersServerEvent } from './feathers-server.constants'
import {
  IData,
  IMethods,
  IComputed,
  IProps,
  IFeathersService,
  IServiceError,
  DataArrayCallbackListener,
  DataRecordCallbackListener,
  CreateFeathersServiceProps,
} from './feathers-service.interfaces'
import {
  DataRecord,
  FeathersFindResponse,
  FeathersRecord,
  IFeathersServer,
  IFeathersServerConnectedEvent,
  IFeathersServerInitializedEvent,
  IFeathersServerReadyEvent,
} from '@/services/feathers-server.interfaces'

// Config

const LogPrefix = '[Feathers Service]'

const Event = {
  LOADED: '--loaded-event--',
  CREATED: '--created-event--',
  PATCHED: '--patched-event--',
  UPDATED: '--updated-event--',
  REMOVED: '--removed-event--',
}

// type guards for Feathers find() response
function isPaginated<T>(
  response: FeathersFindResponse<T>
): response is Paginated<T> {
  return (response as Paginated<T>).data !== undefined
}

function isDataRecordArray<T>(
  response: FeathersFindResponse<T>
): response is T[] {
  return Array.isArray(response)
}

function isDataRecord<T>(response: FeathersFindResponse<T>): response is T {
  return !isDataRecordArray(response) && !isPaginated(response)
}

export const ObjectClass = Vue.extend<IData, IMethods, IComputed, IProps>({
  name: 'feathers-service',

  props: {
    fServer: {
      type: Object as () => IFeathersServer,
      required: true,
    },
  },

  data() {
    return {
      debug: null,
      path: '',
      isInitialized: false,
      isError: null,
      params: {},
      fServerInitialized: false,
    }
  },

  methods: {
    /*
      add/remove CRUD event handlers
    */
    addCreatedEventListener(callback: DataRecordCallbackListener) {
      this.$on(Event.CREATED, callback)
    },
    removeCreatedEventListener(callback: DataRecordCallbackListener) {
      this.$off(Event.CREATED, callback)
    },

    addRemovedEventListener(callback: DataRecordCallbackListener) {
      this.$on(Event.REMOVED, callback)
    },
    removeRemovedEventListener(callback: DataRecordCallbackListener) {
      this.$off(Event.REMOVED, callback)
    },

    addPatchedEventListener(callback: DataRecordCallbackListener) {
      this.$on(Event.PATCHED, callback)
    },
    removePatchedEventListener(callback: DataRecordCallbackListener) {
      this.$off(Event.PATCHED, callback)
    },

    addUpdatedEventListener(callback: DataRecordCallbackListener) {
      this.$on(Event.UPDATED, callback)
    },
    removeUpdatedEventListener(callback: DataRecordCallbackListener) {
      this.$off(Event.UPDATED, callback)
    },

    addLoadedEventListener(callback: DataArrayCallbackListener) {
      this.$on(Event.LOADED, callback)
    },
    removeLoadedEventListener(callback: DataArrayCallbackListener) {
      this.$off(Event.LOADED, callback)
    },

    // data record CRUD actions

    // TODO: promise types
    createRecord<T>(record: Partial<T>, params?: Params) {
      const { path, fServer } = this
      return fServer.create(path, record, params)
    },

    updateRecord(id: string, record: DataRecord, params?: Params) {
      const { path, fServer } = this
      return fServer.update(path, id, record, params)
    },

    removeRecord(id: string, params?: Params) {
      const { path, fServer } = this
      return fServer.remove(path, id, params)
    },

    patchRecord(id: string, record: DataRecord, params?: Params) {
      const { path, fServer } = this
      return fServer.patch(path, id, record, params)
    },

    /*
      Feathers Service Event Handlers
    */
    _handleOnCreated(record: FeathersRecord) {
      this.$emit(Event.CREATED, record)
    },

    _handleOnUpdated(record: FeathersRecord) {
      this.$emit(Event.UPDATED, record)
    },

    _handleOnRemoved(record: FeathersRecord) {
      this.$emit(Event.REMOVED, record)
    },

    _handleOnPatched(record: FeathersRecord) {
      this.$emit(Event.PATCHED, record)
    },

    _loadRecords() {
      const { params, fServer, path } = this

      // promise-chain support
      //
      const handleResponse = (
        response: FeathersRecord | FeathersRecord[] | Paginated<FeathersRecord>
      ) => {
        let data: FeathersRecord[] = []
        if (isPaginated(response)) {
          data = response.data || []
        } else if (isDataRecordArray(response)) {
          data = response
        } else if (isDataRecord(response)) {
          data = [response]
        }
        return data
      }

      //
      const emitEvent = (records: FeathersRecord[]) => {
        this.$emit(Event.LOADED, records)
        return records
      }

      fServer
        .find<FeathersRecord>(path, params)
        .then(handleResponse)
        .then(emitEvent)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .catch((fError: any) => {
          console.warn(`ERROR ${LogPrefix} _loadRecords:find()`, fError)
          const { name, message, code } = fError
          const err: IServiceError = {
            code,
            message,
            name,
          }
          this.isError = err
        })
    },

    _handleServerConnectedChange(event: IFeathersServerConnectedEvent) {
      const { data } = event
      if (data) {
        this._doServerIsConnectedActions()
      } else {
        this._doServerNotConnectedActions()
      }
    },
    _doServerIsConnectedActions() {
      // pass
    },
    _doServerNotConnectedActions() {
      // clear records
    },

    /*
      Server Event Handlers
    */

    // Server Initialized Event

    _handleServerInitializedChange(event: IFeathersServerInitializedEvent) {
      const { data } = event
      if (data) {
        this._doServerIsInitializedActions()
      } else {
        this._doServerNotInitializedActions()
      }
    },
    _doServerIsInitializedActions() {
      const { fServerInitialized, path } = this

      if (fServerInitialized) return

      this._setupServiceListeners(path)
      this.fServerInitialized = true
    },
    _doServerNotInitializedActions() {
      const { path } = this
      this._removeServiceListeners(path)
      this.fServerInitialized = false
    },

    // Server Ready Event

    _handleServerReadyChange(event: IFeathersServerReadyEvent) {
      const { data } = event

      if (data) {
        this._doServerIsReadyActions()
      } else {
        this._doServerNotReadyActions()
      }
    },
    _doServerIsReadyActions() {
      this._loadRecords()
    },
    _doServerNotReadyActions() {
      this._loadRecords()
    },

    _setupServerListeners() {
      const { IS_INITIALIZED, IS_CONNECTED, IS_READY } = FeathersServerEvent
      const { fServer } = this

      fServer.$on(IS_INITIALIZED, this._handleServerInitializedChange)
      fServer.$on(IS_CONNECTED, this._handleServerConnectedChange)
      fServer.$on(IS_READY, this._handleServerReadyChange)
    },

    _removeServerListeners() {
      const { IS_INITIALIZED, IS_CONNECTED, IS_READY } = FeathersServerEvent
      const { fServer } = this

      fServer.$off(IS_INITIALIZED, this._handleServerInitializedChange)
      fServer.$off(IS_CONNECTED, this._handleServerConnectedChange)
      fServer.$off(IS_READY, this._handleServerReadyChange)
    },

    _setupServiceListeners(path: string) {
      const { fServer } = this

      fServer.onCreated(path, this._handleOnCreated)
      fServer.onRemoved(path, this._handleOnRemoved)
      fServer.onUpdated(path, this._handleOnUpdated)
      fServer.onPatched(path, this._handleOnPatched)
    },

    _removeServiceListeners(path: string) {
      const { fServer } = this

      fServer.offCreated(path, this._handleOnCreated)
      fServer.offRemoved(path, this._handleOnRemoved)
      fServer.offUpdated(path, this._handleOnUpdated)
      fServer.offPatched(path, this._handleOnPatched)
    },

    _initialize() {
      const { fServer } = this

      if (fServer.isInitialized) {
        this._doServerIsInitializedActions()
      }
      if (fServer.isConnected) {
        this._doServerIsConnectedActions()
      }
      if (fServer.isConnected) {
        this._doServerIsReadyActions()
      }

      this.isInitialized = true
    },

    _ctor(props) {
      const { path } = props

      this.debug = Debug(`feathers-service:${path}`)

      this.path = path
      this._setupServerListeners()
      this._initialize()
    },

    _dtor() {
      const { path } = this
      this._removeServiceListeners(path)
      this._removeServerListeners()

      this.debug = null
      this.path = ''
    },
  },

  watch: {
    path(nV, oV) {
      if (nV == '' || oV == '') return
      if (nV == oV) return

      this._removeServiceListeners(oV)
      this._setupServiceListeners(nV)
    },
  },
})

/*
  create Service based on structure
*/
export const create = function (
  props: CreateFeathersServiceProps
): IFeathersService {
  const { fServer } = props
  const obj = new ObjectClass({
    propsData: {
      fServer,
    },
  })
  obj._ctor(props)
  return obj
}

export const destroy = function (instance: IFeathersService): void {
  instance._dtor()
  instance.$destroy()
}
