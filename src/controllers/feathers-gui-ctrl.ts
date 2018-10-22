/*
  Feathers Gui Controller

  main controller for the application
*/
// Libs
import Vue from 'vue'

// Components
import store from '@/store'

// Constants & Iterfaces
import { DialogTypes, ServerConnectionEvents } from '@/app-constants'
import {
  DataRecord,
  DisplayDialog,
  IServerConnection,
  IServerConnectionIsInitializedEvent,
  IServerConnectionsHash,
  ServerProps,
  ServerStruct,
  IServiceConnectionsHash,
  ShowAddServiceDialogProps,
  ShowAddServiceRecordDialogProps,
  ShowSelectServiceFieldsDialogProps
} from '@/interfaces'

// Utils
import {
  createServerConnection,
  destroyServerConnection
} from '@/models/server-connection'
import {
  createServiceConnection,
  destroyServiceConnection
} from '@/models/service-connection'
import { createServerStruct } from '@/utils/data-utils'

const FeathersGuiCtrlClass = Vue.extend({

  name: 'FeathersGuiCtrl',

  data() {
    return {

      /*
        hash of servers for which waiting for initialized signal
        will be empty when all servers initialized

        key'd on server id
      */
      waitServerInit: {
        /*
          'ngf5pec3s8g0': <server connection>,
          '5f6rz3d8i6w0': <server connection>
          ...
        */
      },

    }
  },

  computed: {

    activeServerConnectionsList() : IServerConnection[] {
      const { serverConnections } = this
      return Object.values(serverConnections).filter(item => item.isActive)
    },

    currentServerId() : string | null {
      return store.getters['currentServerId']
    },

    serverConnections() : IServerConnectionsHash {
      return store.getters['currentServerConnections']
    },

    serversAreInitialized() : boolean {
      const { waitServerInit } = this
      const list = Object.keys(waitServerInit)
      return (list.length === 0)
    },

    serversList() : ServerStruct[] {
      return store.getters['getServersList']
    },

    serviceConnections() : IServiceConnectionsHash {
      return store.getters['currentServiceConnections']
    },

    serviceConnectionsList() {
      return store.getters['getServiceConnectionsList']
    },

  },

  methods: {

    /*
      Public Methods
    */

    getServerConnectionByServerId(serverId:string) : IServerConnection | null {
      const getSrvrConnByIdFunc = store.getters['getServerConnectionByServerId']
      return getSrvrConnByIdFunc(serverId)
    },

    addServer(props: ServerProps) {
      const { url, isActive } = props
      const srvrStruct = createServerStruct({ url, isActive })
      store.commit('addServer', srvrStruct)
      this._createServerConnection(srvrStruct)
    },

    removeServer(server: ServerStruct | IServerConnection) {
      const { id } = server
      store.commit('removeServerById', { id })
      this._removeServerConnection(server)
    },

    selectServer(server: IServerConnection | null) {
      store.dispatch('setCurrentServer', server)
    },

    /*
      Server support
    */

    _handleServerIsInitialized(event:IServerConnectionIsInitializedEvent) {
      const { waitServerInit } = this
      const { target } = event
      const { id } = target
      Vue.delete(waitServerInit, id)
    },

    _createServerConnection(server: ServerStruct) : IServerConnection {
      const { IS_INITIALIZED } = ServerConnectionEvents
      const srvrConn = createServerConnection(server)

      srvrConn.$on(IS_INITIALIZED, this._handleServerIsInitialized)
      store.commit('addServerConnection', srvrConn)
      return srvrConn
    },

    _removeServerConnection(server: ServerStruct | IServerConnection) {
      const { IS_INITIALIZED } = ServerConnectionEvents
      const { id } = server
      const srvrConn = this.getServerConnectionByServerId(id)
      if (srvrConn) {
        srvrConn.$off(IS_INITIALIZED, this._handleServerIsInitialized)
        destroyServerConnection(srvrConn)
        store.commit('removeServerConnectionById', { id })
      }
    },

    /*
      Add Service Dialog Support
    */

    showAddServiceDialog(props: ShowAddServiceDialogProps) {
      const { serverConnection, success, cancel } = props

      const successWrap = (result:DataRecord) => {
        store.commit('removeCurrentDialog')
        if (success) { success(result) }
      }
      const cancelWrap = () => {
        store.commit('removeCurrentDialog')
        if (cancel) { cancel() }
      }

      const payload: DisplayDialog = {
        type: DialogTypes.ADD_SERVICE,
        success: successWrap,
        cancel: cancelWrap,
        data: {
          serverConnection,
        },
      }
      store.commit('showDialog', payload)
    },

    /*
      Add Service Record Dialog Support
    */

    showAddServiceRecordDialog(props: ShowAddServiceRecordDialogProps) {
      const { cancel, record, success } = props
      const successWrap = (jsonStr: string) => {
        store.commit('removeCurrentDialog')
        if (success) success(jsonStr)
      }
      const cancelWrap = () => {
        store.commit('removeCurrentDialog')
        if (cancel) cancel()
      }

      const payload: DisplayDialog = {
        type: DialogTypes.ADD_SERVICE_RECORD,
        data: record,
        success: successWrap,
        cancel: cancelWrap,
      }
      store.commit('showDialog', payload)
    },

    /*
      Select Service Fields Dialog Support
    */

    showSelectServiceFieldsDialog(props: ShowSelectServiceFieldsDialogProps) {
      const { data, success, cancel } = props

      const successWrap = (result: any) => {
        store.commit('removeCurrentDialog')
        if (success) success(result)
      }
      const cancelWrap = () => {
        store.commit('removeCurrentDialog')
        if (cancel) cancel()
      }

      const payload: DisplayDialog = {
        type: DialogTypes.SELECT_SERVICE_FIELDS,
        data,
        success: successWrap,
        cancel: cancelWrap,
      }
      store.commit('showDialog', payload)
    },

    showManageServersDialog() {
      const success = () => {
        store.commit('removeCurrentDialog')
      }

      const payload: DisplayDialog = {
        type: DialogTypes.MANAGE_SERVERS,
        success,
      }
      store.commit('showDialog', payload)
    },

    showAddEditServerDialog(record?:ServerStruct | IServerConnection) {
      const success = (serverInfo:DataRecord) => {
        const { id, url, isActive, authentication } = serverInfo

        const props: ServerProps = { url, isActive, authentication }
        if (id === null) {
          this.addServer(props)
        } else {
          const srvrConn = this.getServerConnectionByServerId(id)
          if (srvrConn) srvrConn.updateServer(props)
        }

        // restore provenance of showAddEditServerDialog
        this.showManageServersDialog()
      }
      const cancel = () => {
        this.showManageServersDialog()
      }

      const payload: DisplayDialog = {
        type: DialogTypes.ADD_EDIT_SERVER,
        data: record || {},
        success,
        cancel,
      }
      store.commit('showDialog', payload)
    },

    /*
      private methods
    */

    _checkValidCurrentServerId() {
      const { currentServerId, activeServerConnectionsList: activeSrvrConn } = this
      if (activeSrvrConn.length === 0 || currentServerId === null) {
        this.showManageServersDialog()
      }
    },

    // load server data from data store & create instances
    _initializeServers() {
      const { serversList, waitServerInit } = this
      if (serversList.length === 0) {
        store.dispatch('setCurrentServer', null)
        this.showManageServersDialog()
      } else {
        serversList.forEach(item => {
          const { id } = item
          const srvrConn = this._createServerConnection(item)
          Vue.set(waitServerInit, id, srvrConn)
        })
      }
    },

  },

  watch: {

    activeServerConnectionsList(newVal:IServerConnection[]) {
      if (newVal.length === 0) {
        this.showManageServersDialog()
      } if (newVal.length === 1) {
        this.selectServer(newVal[0])
      }
    },

    serversAreInitialized(newVal:boolean) {
      if (newVal === true) {
        this._checkValidCurrentServerId()
      }
    },

  },

  created() {
    this._initializeServers()
  },

})

// create singleton
export default new FeathersGuiCtrlClass({})
