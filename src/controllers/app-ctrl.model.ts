/*
  Feathers Gui Controller

  main controller for the application
*/
// Libs
import Vue from 'vue'
import { Deferred } from 'ts-deferred'

// Constants & Iterfaces
import {
  DialogEvent,
  DialogEventListener,
  IAppCtrl,
  IComputed,
  IData,
  IMethods,
  IProps,
} from './app-ctrl.interfaces'
import { Mutations } from '@/store/mutations'
import { IServer, Server, ServerProps } from '@/models/server.interfaces'
import { PropertyLookupHash, ServiceProps } from '@/models/service.interfaces'
import {
  AddEditServerDialogResultProps,
  AddServiceDialogProps,
  AddServiceRecordDialogProps,
  SelectServiceFieldsDialogProps,
} from './dialog.interfaces'

// Components
import {
  create as createServer,
  destroy as destroyServer,
} from '@/models/server.model'

// Controllers & Services
import store from '@/store'

// Utils
import { createServerStruct, createServiceStruct } from './app-ctrl.utils'
import { DialogType } from './dialog.constants'

const Event = {
  DISPLAY_DIALOG: '--display-dialog-event--',
}

const handleCatch = () => {
  // pass
}

const ObjectClass = Vue.extend<IData, IMethods, IComputed, IProps>({
  name: 'AppCtrl',

  computed: {
    currentServerId() {
      return store.state.currentServerId
    },

    currentServerConfig() {
      const { currentServerId } = this
      if (!currentServerId) return null
      const { servers } = store.state
      return servers[currentServerId] || null
    },

    currentServiceId() {
      return store.state.currentServiceId
    },

    serverInstance() {
      return store.state.serverInstance
    },

    serversList() {
      const { servers } = store.state
      return Object.values(servers)
    },

    serverConfigs() {
      return store.state.servers
    },
  },

  methods: {
    /*
      Public Methods
    */

    /*
      Store support
    */

    setCurrentServiceId(id: string | null) {
      store.commit(Mutations.SET_SERVICE_ID, id)
    },
    setCurrentRecordId(id: string | null) {
      store.commit(Mutations.SET_RECORD_ID, id)
    },

    addServer(props: ServerProps) {
      const struct = createServerStruct(props)
      store.commit(Mutations.ADD_SERVER, struct)
    },

    updateServer(server: Server) {
      store.commit(Mutations.UPDATE_SERVER, server)
    },

    removeServer(server: Server) {
      const { serverInstance } = this

      // services
      const services = this._getServicesByServerId(server.id)
      services.forEach((item) => {
        this.removeService(item.id)
      })

      // server
      if (serverInstance && serverInstance.id === server.id) {
        this._destroyCurrentIServer()
      }
      store.commit(Mutations.REMOVE_SERVER, server)
    },

    activateServer(server: Server) {
      const { serverInstance } = this

      // destroy current server instance
      if (serverInstance !== null) {
        this._destroyCurrentIServer()
        this._setCurrentServerId(null)
      }

      // create new server instance
      this._setCurrentServerId(server.id)
      const srvr = createServer(server)
      this._setCurrentServer(srvr)
    },

    addService(props: ServiceProps) {
      const struct = createServiceStruct(props)
      store.commit(Mutations.ADD_SERVICE, struct)
    },

    removeService(id: string) {
      const { currentServiceId } = this

      if (currentServiceId === id) {
        store.commit(Mutations.SET_SERVICE_ID, null)
      }
      store.commit(Mutations.REMOVE_SERVICE, id)
    },

    _getServicesByServerId(id: string) {
      const { services } = store.state
      return Object.values(services).filter((item) => item.serverId === id)
    },

    /*
      Server support
    */

    addDialogEventListener(callback: DialogEventListener) {
      this.$on(Event.DISPLAY_DIALOG, callback)
    },
    removeDialogEventListener(callback: DialogEventListener) {
      this.$off(Event.DISPLAY_DIALOG, callback)
    },

    /*
       Services Support
    */

    showAddServiceDialog(props: AddServiceDialogProps) {
      const { currentServerId } = this
      const { current, existing } = props
      const deferred = new Deferred<string>()

      if (!currentServerId) {
        return Promise.reject('no current server id')
      }

      const event: DialogEvent = {
        target: this,
        data: {
          type: DialogType.ADD_SERVICE,
          deferred,
          props: {
            current,
            existing,
          },
        },
      }
      this._requestDialog(event)

      // promise-chain support
      //
      const createServiceProps = (path: string) => {
        const props: ServiceProps = {
          serverId: currentServerId,
          path,
          fields: [],
        }
        return props
      }
      //
      const addNewService = (props: ServiceProps) => {
        this.addService(props)
      }

      // promise-chain
      deferred.promise
        .then(createServiceProps)
        .then(addNewService)
        .catch(handleCatch)

      return deferred.promise
    },

    /*
      Add Service Record Dialog Support
    */

    showAddServiceRecordDialog(props: AddServiceRecordDialogProps) {
      const { recordTmpl } = props
      const deferred = new Deferred<string>()

      const event: DialogEvent = {
        target: this,
        data: {
          type: DialogType.ADD_SERVICE_RECORD,
          deferred,
          props: {
            recordTmpl,
          },
        },
      }
      this._requestDialog(event)

      return deferred.promise
    },

    /*
      Select Service Fields Dialog Support
    */

    showSelectServiceFieldsDialog(props: SelectServiceFieldsDialogProps) {
      const { currentServerId } = this
      const { recordTmpl, serviceInstance } = props
      const deferred = new Deferred<PropertyLookupHash>()

      if (!currentServerId) {
        return Promise.reject('no current server id')
      }

      const event: DialogEvent = {
        target: this,
        data: {
          type: DialogType.SELECT_SERVICE_FIELDS,
          deferred,
          props: {
            recordTmpl,
            serviceInstance,
          },
        },
      }
      this._requestDialog(event)

      // promise-chain support
      const handleResponse = (packedFields: PropertyLookupHash) => {
        serviceInstance.updateFields(packedFields)
      }
      // promise-chain
      deferred.promise.then(handleResponse).catch(handleCatch)

      return deferred.promise
    },

    showManageServersDialog() {
      const deferred = new Deferred<void>()

      const event: DialogEvent = {
        target: this,
        data: {
          type: DialogType.MANAGE_SERVERS,
          deferred,
          props: {},
        },
      }
      this._requestDialog(event)

      return deferred.promise
    },

    _requestDialog(event: DialogEvent) {
      this.$emit(Event.DISPLAY_DIALOG, event)
    },

    showAddEditServerDialog(record?: Server) {
      const deferred = new Deferred<AddEditServerDialogResultProps>()

      const event: DialogEvent = {
        target: this,
        data: {
          type: DialogType.ADD_EDIT_SERVER,
          deferred,
          props: {
            server: record || null,
          },
        },
      }
      this._requestDialog(event)

      // promise-chain support
      const handleResponse = (result: AddEditServerDialogResultProps) => {
        const { id, props } = result

        if (id) {
          const server: Server = { id, ...props }
          this.updateServer(server)
        } else {
          this.addServer(props)
        }
      }

      // promise-chain
      deferred.promise.then(handleResponse).catch(handleCatch)

      return deferred.promise
    },

    /*
      private methods
    */

    _setCurrentServerId(id: string | null) {
      store.commit(Mutations.SET_SERVER_ID, id)
    },
    _setCurrentServer(instance: IServer | null) {
      store.commit(Mutations.SET_SERVER_INSTANCE, instance)
    },

    _destroyCurrentIServer() {
      const { serverInstance } = this

      if (serverInstance) destroyServer(serverInstance)
      this._setCurrentServer(null)
    },

    // load server data from data store & create instances
    _initializeServer() {
      const { currentServerConfig } = this

      if (currentServerConfig != null) {
        this.activateServer(currentServerConfig)
      }
    },

    _ctor() {
      this._initializeServer()
    },
  },
})

const create = function (): IAppCtrl {
  const obj = new ObjectClass({})
  obj._ctor()
  return obj
}

// create singleton
export default create()
