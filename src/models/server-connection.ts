/*
  Feathers Data Service

  this is the main connection to the Feathers instance.
*/

// Libs
import Vue from 'vue'
import io from 'socket.io-client'
import feathers, { Application, Service } from '@feathersjs/feathers'
import socketio from '@feathersjs/socketio-client'

// Components
import store from '@/store'

// Constants / Interfaces
import {
  AddServiceProps,
  DataRecord,
  Listener,
  IServerConnection,
  IServerConnectionData,
  ServerProps,
  ServerStruct,
  ServiceStruct,
  IServiceConnection,
  IServerConnectionEvent,
  FeathersRecord,
  StateMachineEvent
} from '@/interfaces'
import { FeathersEvents, ServerConnectionEvents } from '@/app-constants'
import { createServiceStruct } from '@/utils/data-utils'
import { createServiceConnection, destroyServiceConnection } from '@/models/service-connection'

const StateMachine = require('javascript-state-machine')

interface CreateSocketProps {
  url: string;
}
function createSocket(props: CreateSocketProps) : SocketIOClient.Socket {
  const { url } = props
  return io(url, {
    transports: ['websocket'],
    // forceNew: true,
  })
}

// number of times to retry connection
const errorRetryAttempts = 5

/*
  store client instances in a hash
  putting in Vue data area will break them

  Application<object> | Service<object>
*/
export interface FeathersClientHash {
  [key:string] : any
}
const clientHash : FeathersClientHash = {}

/*
  Server Connection Class
*/
export const ServerConnectionClass = Vue.extend({

  name: 'server-connection',

  props: ['data', 'id'],

  data() : IServerConnectionData {
    return {
      // real values for getters/setters
      isActiveValue: false,
      urlValue: '',
      authentication: null,

      isInitialized: false, // finished setting initial state
      errorCount: 0,
      isError: null,
      isConnected: false,
      socket: null,
      stateChangeTimerRef: null,
      saveTimerRef: null,
      selectedService: null,
      serviceConnections: {},
      stateMachine: null,
      serviceCallbacks: {
        /*
          key'd on path and event
          '/charts:removed': [ func, func, ...],
          '/charts:created': [ func, func, ... ]
        */
      },
      localCallbacks: {
        /*
          key'd on path and event
          '/charts:removed': func,
          '/charts:created': func
        */
      },
    }
  },

  computed: {

    isActive: {
      get() : boolean {
        return this.isActiveValue
      },
      set(newValue:boolean) {
        this.isActiveValue = newValue
        if (this.isInitialized) {
          this._isDirty()
          this._isStale()
        }
      },
    },

    url: {
      get() : string {
        return this.urlValue
      },
      set(newValue:string) {
        this.urlValue = newValue
        if (this.isInitialized) {
          this._isDirty()
          this._isStale()
        }
      },
    },

    // authentication: {
    //   get() : string {
    //     return this.urlValue
    //   },
    //   set(newValue:string) {
    //     this.urlValue = newValue
    //     if (this.isInitialized) {
    //       this._isDirty()
    //     }
    //   },
    // },

    servicesList() : ServiceStruct[] {
      const { id } = this
      const srvcsFunc = store.getters['getServicesListByServerId']
      return srvcsFunc(id)
    },

    serviceConnectionsList() : IServiceConnection[] {
      const { serviceConnections } = this
      return Object.values(serviceConnections).sort(function(a, b) {
        return (a.path < b.path) ? -1 : 1
      })
    },

  },

  methods: {

    /*
      Public API
    */

    toggleActiveState() {
      this.isActive = !this.isActive
    },

    updateServer(props:ServerProps) {
      const { url, isActive } = props
      this.url = url
      this.isActive = isActive
    },

    addService(props: AddServiceProps) {
      const { path, serverId } = props
      const srvcStruct = createServiceStruct({ path, serverId })
      store.commit('addService', srvcStruct)
      this._createServiceConnection(srvcStruct)
    },

    removeService(service: ServiceStruct | IServiceConnection) {
      const { id } = service
      store.commit('removeServiceById', { id })
      this._deleteServiceConnection(service)
    },

    getServiceConnectionById(id:string) : IServiceConnection | null{
      const { serviceConnections } = this
      return serviceConnections[id] || null
    },

    setSelectedService(service: ServiceStruct | IServiceConnection) {
      const { id } = service
      const srvcConn = this.getServiceConnectionById(id)
      this.selectedService = srvcConn
    },

    storeClient(client:any) {
      const { id } = this
      clientHash[id] = client
    },

    // Application<object> | Service<object>
    loadClient() : any | null {
      const { id } = this
      return clientHash[id] || null
    },

    removeClient() : any | null {
      const { id } = this
      clientHash[id] = null
    },

    service(location:string) : Service<any> {
      const client = this._getApplication()
      if (client === null) {
        throw new Error('no client. check client status before making calls.')
      }
      return client.service(location)
    },

    // Service Calls

    find(path:string, params?:any) : Promise<any> {
      return this.service(path).find(params)
    },

    create(path:string, data:DataRecord, params?:any) : Promise<any> {
      return this.service(path).create(data, params)
    },

    patch(path:string, id:string, data:DataRecord, params?:any) : Promise<any> {
      return this.service(path).patch(id, data, params)
    },

    remove(path:string, id:string, params?:any) : Promise<any> {
      return this.service(path).remove(id, params)
    },

    update(path:string, id:string, data:DataRecord, params?:any) : Promise<any> {
      return this.service(path).update(id, data, params)
    },

    // Event Listeners

    onCreated(path:string, callback:Listener) : Service<any> {
      return this.service(path).on(FeathersEvents.CREATED, callback)
    },

    offCreated(path:string, callback:Listener) : Service<any> {
      return this.service(path).removeListener(FeathersEvents.CREATED, callback)
    },

    onRemoved(path:string, callback:Listener) : Service<any> {
      return this.service(path).on(FeathersEvents.REMOVED, callback)
    },

    offRemoved(path:string, callback:Listener) : Service<any> {
      return this.service(path).removeListener(FeathersEvents.REMOVED, callback)
    },

    onUpdated(path:string, callback:Listener) {
      return this.service(path).on(FeathersEvents.UPDATED, callback)
    },

    offUpdated(path:string, callback:Listener) {
      return this.service(path).removeListener(FeathersEvents.UPDATED, callback)
    },

    /*
      private support
    */

    _getApplication() : Application<object> {
      const client = this.loadClient()
      if (client === null) {
        throw new Error('SRVR CONN no client in _getApplication()')
      }
      return client
    },

    _getService() : Service<object> {
      const client = this.loadClient()
      if (client === null) {
        throw new Error('SRVR CONN no client in _getService()')
      }
      return client as Service<object>
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
        this._saveCurrentState()
        this.saveTimerRef = null
      }, 100)
    },

    /*
      when value is changed, start timer to see if status of
      socket connection needs to be updated

      only called if URL or isActive changes
    */
    _isStale() {
      const { stateChangeTimerRef } = this
      if (stateChangeTimerRef) {
        clearTimeout(stateChangeTimerRef)
      }
      this.stateChangeTimerRef = setTimeout(() => {
        this._updateConnectionState()
        this.stateChangeTimerRef = null
      }, 100)
    },

    _updateConnectionState() {
      const { isActive, stateMachine, socket } = this

      // console.log('_updateConnectionState', isActive, socket, socket && socket.disconnected)
      if (isActive && socket) {
        // if URL has changed or we are already trying to connect
        stateMachine.restart()
      } else if (isActive) {
        stateMachine.connect()
      } else {
        stateMachine.disconnect()
      }
    },

    _saveCurrentState() {
      const { authentication, id, isActive, url } = this
      const srvrStruct = { id, url, isActive, authentication }
      store.commit('updateServer', srvrStruct)
    },

    /*
      create instance of Service Connection
      and put in Vuex Store
    */
    _createServiceConnection(service: ServiceStruct) {
      const { serviceConnections } = this
      const { id } = service
      const srvcConn : IServiceConnection = createServiceConnection(this, service)
      this.$set(serviceConnections, id, srvcConn)
    },

    /*
      remove instance of Service Connection from Vuex Store
    */
    _deleteServiceConnection(service: ServiceStruct | IServiceConnection) {
      const { serviceConnections } = this
      const { id } = service
      const srvcConn = this.getServiceConnectionById(id)
      if (srvcConn) {
        destroyServiceConnection(srvcConn)
        this.$delete(serviceConnections, id)
      }
    },

    /*
      loop through services list (from Vuex Store)
      and create an instance of Service Connection
    */
    _loadServices() {
      const { servicesList } = this
      servicesList.forEach(srvcStruct => {
        this._createServiceConnection(srvcStruct)
      })
    },

    /*
      State Machine Handlers
    */

    _doStateInitialize() {
      const { data } = this
      this.updateServer(data) // save initial state
      this._loadServices()
      this.isInitialized = true
    },

    _doStateConnect() {
      const { url } = this
      console.warn(`Attempting connection to ${url}`)
      const client = feathers()
      this.socket = createSocket({ url })

      this._setupSocketListeners()
      client.configure(socketio(this.socket))
      this.storeClient(client)

      this._activateLocalEventListeners()
    },

    _doStateDisconnect() {
      const { socket } = this
      this._deactivateLocalEventListeners()

      if (socket) {
        const { disconnected } = socket // get 'snapshot'
        // teardown socket
        socket.disconnect()
        if (disconnected) {
          // socket does not fire Disconnected Event on socket.disconnect()
          // if currently attempting to connection, so do it manually
          this._handleSocketDisconnect()
        }
        this._teardownSocketListeners()
        this.socket = null

        // teardown client
        const client = this._getApplication()
        client.removeAllListeners()
        this.removeClient()
      }
    },

    /*
      Socket Handlers & Support
    */

    _clearError() {
      this.errorCount = 0
      this.isError = null
    },

    _handleSocketConnect() {
      console.warn('_handleSocketConnect')
      this.stateMachine.connectOk()
      this._clearError()
    },

    _handleSocketDisconnect() {
      console.warn('_handleSocketDisconnect')
      this.stateMachine.connectErr()
      this._clearError()
    },

    _handleSocketConnectError() {
      console.warn('_handleSocketConnectError')
      this.errorCount += 1
    },
    _handleSocketConnectTimeout() {
      console.warn('_handleSocketConnectTimeout')
    },

    _handleSocketError() {
      console.warn('_handleSocketError')
    },

    _createEvent<T>(name:string, data:any) : IServerConnectionEvent<T> {
      return { target: this, name, data }
    },

    _emitEvent(event:IServerConnectionEvent<any>) {
      const { name } = event
      this.$emit(name, event)
    },

    _setupSocketListeners() {
      const { socket } = this
      if (socket) {
        socket.on('connect', this._handleSocketConnect)
        socket.on('disconnect', this._handleSocketDisconnect)
        socket.on('connect_error', this._handleSocketConnectError)
        socket.on('connect_timeout', this._handleSocketConnectTimeout)
        socket.on('error', this._handleSocketError)
      }
    },

    _teardownSocketListeners() {
      const { socket } = this
      if (socket) {
        socket.off('connect', this._handleSocketConnect)
        socket.off('disconnect', this._handleSocketDisconnect)
        socket.off('connect_error', this._handleSocketConnectError)
        socket.off('error', this._handleSocketError)
      }
    },

  },

  watch: {

    isConnected(newVal:boolean, oldVal:boolean) {
      const { IS_CONNECTED } = ServerConnectionEvents
      // console.log('WATCH isConnected', newVal, oldVal)
      const event = this._createEvent<boolean>(IS_CONNECTED, newVal)
      this._emitEvent(event)
    },

    isInitialized(newVal:boolean) {
      const { IS_INITIALIZED } = ServerConnectionEvents
      const event = this._createEvent<boolean>(IS_INITIALIZED, newVal)
      this._emitEvent(event)
    },

    selectedService(newVal: IServiceConnection | null) {
      store.commit('setCurrentService', newVal)
    },

    errorCount(newVal:number) {
      const { stateMachine } = this
      if (newVal >= errorRetryAttempts) {
        this.isActive = false
        this.isError = 'timeout error'
        stateMachine.unsetRestartFlag()
      }
    },

  },

  created() {
    this.stateMachine = new StateMachine({

      init: 'created',

      transitions: [
        // initialize
        { name: 'initialize', from: 'created', to: 'initialized' },
        // connect
        { name: 'connect', from: 'initialized', to: 'connecting' },
        { name: 'connect', from: 'disconnected', to: 'connecting' },
        // disconnect
        { name: 'disconnect', from: ['initialized', 'disconnected'], to: 'disconnected' },
        { name: 'disconnect', from: 'connected', to: 'disconnecting' },
        { name: 'disconnect', from: 'connecting', to: 'disconnecting' },
        // (socket transitions)
        { name: 'connectOk', from: 'connecting', to: 'connected' },
        { name: 'connectErr', from: ['connecting', 'disconnecting'], to: 'disconnected' },
        { name: 'connectErr', from: 'connected', to: 'recovered' },
        // restart
        { name: 'restart', from: 'connected', to: 'disconnecting' },
        { name: 'restart', from: 'connecting', to: 'disconnecting' },
        { name: 'restart', from: 'recovered', to: 'disconnecting' },
        { name: 'restart', from: 'disconnected', to: 'connecting' },
      ],
      data: {
        // flag used when going through RESTART cycle
        isRestarting: false,
      },
      methods: {
        /*
          Vue.nextTick() is ised to wait until out of transition
          before starting another
        */

        /* e:StateMachineEvent */
        onEnterCreated: () => {
          console.info(`SRVR CONN Created: ${this.data.url}`)
        },
        onEnterInitialized: () => {
          this._doStateInitialize()
        },
        onAfterInitialize: () => {
          const { stateMachine, isActive } = this
          if (isActive) {
            Vue.nextTick(() => stateMachine.connect())
          } else {
            Vue.nextTick(() => stateMachine.disconnect())
          }
        },
        onEnterConnecting: () => {
          this._doStateConnect()
        },
        onEnterConnected: () => {
          console.warn('Socket is Connected')
          const { stateMachine } = this
          this.isConnected = true

          stateMachine.unsetRestartFlag()
          // stateMachine.isRestarting = false // unset restart flag
        },
        onEnterDisconnecting: () => {
          // disconnect happens immediately so wait
          // until out of transition before starting another
          // console.warn('onEnterDisconnecting')
          Vue.nextTick(() => this._doStateDisconnect())
        },
        onEnterDisconnected: () => {
          const { stateMachine } = this
          this.isConnected = false

          console.warn('Socket is Disconnected', stateMachine.isRestarting)
          if (stateMachine.isRestarting) {
            Vue.nextTick(() => stateMachine.connect())
          }
        },
        /*
          onBeforeRestart
          only transition-based function
          set restart flag before doing
        */
        onBeforeRestart: () => {
          console.warn('Socket is Restarting')
          const { stateMachine } = this
          stateMachine.setRestartFlag()
        },
        /*
          perhaps after computer wakes from sleep
          or server gets shut down while connected
        */
        onEnterRecovered: () => {
          const { stateMachine } = this
          // console.warn('onEnterRecovered', stateMachine)
          Vue.nextTick(() => stateMachine.restart())
        },

        /*
          non-state related methods
        */

        setRestartFlag: () => {
          // console.log('setRestartFlag')
          const { stateMachine } = this
          stateMachine.isRestarting = true
        },

        unsetRestartFlag: () => {
          // console.log('unsetRestartFlag')
          const { stateMachine } = this
          stateMachine.isRestarting = false
        },
      },
    })
    this.stateMachine.initialize()
  },

  beforeDestroy() {
    console.warn('SRVR CONN: beforeDestroy')
  },

})

/*
  create Server Connection based on data structure
*/
export const createServerConnection = function(record: ServerStruct) : IServerConnection {
  const { id, isActive, url } = record
  const data = { isActive, url }
  return new ServerConnectionClass({
    propsData: {
      id, data,
    },
  })
}

/*
  destroy Server Connection
*/
export const destroyServerConnection = function(srvrConn:IServerConnection) {
  srvrConn.$destroy()
}
