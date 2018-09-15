// Libs
import Vue from 'vue'

// Components
import store from '@/store'

// Constants & Iterfaces
import { DialogTypes } from '@/app-constants'
import {
  DataRecord,
  DisplayDialog,
  ServerStruct,
  IServerConnectionsHash,
  ServiceStruct,
  IServiceConnection, IServiceConnectionsHash,
  ShowAddServiceDialogProps,
  ShowAddServiceRecordDialogProps,
  ShowSelectServiceFieldsDialogProps,
  IServerConnection,
  ServerProps
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
import { createServerStruct, createServiceStruct } from '@/utils/data-utils'
import { join } from 'path'

const FeathersGuiCtrlClass = Vue.extend({

  computed: {

    currentServerId() : string | null {
      return store.getters['currentServerId']
    },

    serviceConnections() : IServiceConnectionsHash {
      return store.getters['currentServiceConnections']
    },

    serverConnections() : IServerConnectionsHash {
      return store.getters['currentServerConnections']
    },

    currentServerConnection() : IServerConnection | null {
      const { currentServerId } = this
      const getSrvrConnByIdFunc = store.getters['getServerConnectionByServerId']
      return getSrvrConnByIdFunc(currentServerId)
    },

    activeServerConnectionsList() : IServerConnection[] {
      const { serverConnections } = this
      return Object.values(serverConnections).filter(item => item.isActive)
    },

    serviceConnectionsList() {
      return store.getters['getServiceConnectionsList']
    },

    serversList() : ServerStruct[] {
      return store.getters['getServersList']
    },

  },

  methods: {

    getServerConnectionByServerId(serverId:string) : IServerConnection | null {
      const getSrvrConnByIdFunc = store.getters['getServerConnectionByServerId']
      return getSrvrConnByIdFunc(serverId)
    },

    addServer(props: ServerProps) {
      const { url, isActive } = props
      const srvrStruct = createServerStruct({ url, isActive })
      // console.log('addServer struct', srvrStruct)
      store.commit('addServer', srvrStruct)
      this._createServerConnection(srvrStruct)
    },

    removeServer(server: ServerStruct | IServerConnection) {
      const { id } = server
      store.commit('removeServerById', { id })
      this._removeServerConnection(server)
    },

    addServerConnection(server: ServerStruct) {
      const { id, url } = server
      console.log('creating ServerConnection', id, url)
      const srvrConnect = createServerConnection(server)
      store.commit('addServerConnection', srvrConnect)
    },

    selectServer(server: IServerConnection | null) {
      store.commit('setCurrentServer', server)
    },

    /*
      Server support
    */

    _createServerConnection(server: ServerStruct) {
      const srvrConnect = createServerConnection(server)
      console.log('creating ServerConnection', srvrConnect)

      store.commit('addServerConnection', srvrConnect)
    },

    _removeServerConnection(server: ServerStruct | IServerConnection) {
      const { id } = server
      const srvrConn = this.getServerConnectionByServerId(id)
      if (srvrConn) {
        destroyServerConnection(srvrConn)
        store.commit('removeServerConnectionById', { id })
      }
    },

    /*
      Add Service Dialog Support
    */

    showAddServiceDialog(props: ShowAddServiceDialogProps) {
      const { success, cancel } = props

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
      console.log('showAddEditServerDialog')

      const success = (serverInfo:DataRecord) => {
        console.log('success showAddEditServerDialog', serverInfo)
        const { id, url, isActive, authentication } = serverInfo
        console.log('back from add/edit', id)

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
        console.log('cancel showAddEditServerDialog')
        // store.commit('removeCurrentDialog')
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

    showSelectActiveServerDialog() {
      console.log('showSelectActiveServerDialog')
    },

    _checkValidCurrentServerId() {
      const { currentServerId, activeServerConnectionsList: activeSrvrConn } = this
      if (activeSrvrConn.length === 0 || currentServerId === null) {
        this.showManageServersDialog()
      }
    },

  },

  watch: {

    // servicesList(newVal:ServiceStruct[], oldVal:ServiceStruct[]) {
    //   console.log('FGUI Watch servicesList', newVal)

    //   if (newVal.length < oldVal.length) {
    //     // remove service connection
    //     oldVal
    //       .filter(oS => !newVal.find(nS => nS.id === oS.id))
    //       .forEach(service => this.removeServiceConnection(service))
    //   } else if (newVal.length > oldVal.length) {
    //     // create service connection
    //     newVal
    //       .filter(nS => !oldVal.find(oS => oS.id === nS.id))
    //       .forEach(service => this.createServiceConnection(service))
    //   } else {
    //     // a service was updated
    //     // services will update themselves and their stored data
    //     // nothing to do here
    //   }
    // },

    currentServerId(newVal, oldVal) {
      console.log('FGUI Watch currentServerId', newVal, oldVal)
    },

    currentServerConnection(newVal, oldVal) {
      console.log('FGUI Watch currentServerConnection', newVal, oldVal)
    },

    serverConnections(newVal, oldVal) {
      console.log('FGUI Watch serverConnections', newVal, oldVal)
    },

    activeServerConnectionsList(newVal:IServerConnection[]) {
      console.log('FGUI Watch activeServerConnectionsList', newVal.length)
      if (newVal.length === 0) {
        this.showManageServersDialog()
      } if (newVal.length === 1) {
        this.selectServer(newVal[0])
      }
    },

  },

  created() {
    const { serversList, serviceConnections, serverConnections, currentServerConnection } = this
    // console.log('ctrl created', serviceConnections, Object.keys(serviceConnections))
    // console.log('ctrl created', servicesList)
    // console.log('feathres build', serversList)

    /*
      load servers
    */
    serversList.forEach(item => {
      const { id } = item
      const srvrConn = this.getServerConnectionByServerId(id)
      if (srvrConn === null) {
        this._createServerConnection(item)
      }
    })

    /*
      load services
    */
    // servicesList.forEach(item => {
    //   const { id } = item
    //   // console.log('checkinng', id, serviceConnections[id])
    //   const connection = serviceConnections[id] || null
    //   if (connection === null) {
    //     this.createServiceConnection(item)
    //   }
    // })

    console.warn('mounted currentServerConnection', currentServerConnection)
    if (currentServerConnection === null) {
      // there is no server for this id, it must have been deleted
      store.commit('setCurrentServer', { id: null })
    }
    this._checkValidCurrentServerId()
  },

})

// create singleton
export default new FeathersGuiCtrlClass({})
