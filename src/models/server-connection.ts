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
import { ServerStruct, IServerConnection, Listener, DataRecord, ServerProps, IServiceConnectionData, IServerConnectionData, AddServiceProps, ServiceStruct, IServiceConnection } from '@/interfaces'
import { FeathersEvents } from '@/app-constants'
import { createServiceStruct } from '@/utils/data-utils'
import { createServiceConnection, destroyServiceConnection } from '@/models/service-connection'

interface CreateSocketProps {
  url: string;
}
function createSocket(props: CreateSocketProps) {
  const { url } = props
  return io(url, {
    transports: ['websocket'],
    // forceNew: true,
  })
}

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

      isInitialized: false,
      saveTimerRef: null,
      selectedService: null,
      serviceConnections: {},
    }
  },

  computed: {

    isActive: {
      get() : boolean {
        return this.isActiveValue
      },
      set(newValue:boolean) {
        this.isActiveValue = newValue
        if (this.isInitialized) this._isDirty()
      },
    },

    url: {
      get() : string {
        return this.urlValue
      },
      set(newValue:string) {
        this.urlValue = newValue
        if (this.isInitialized) this._isDirty()
      },
    },

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

    isReady() {
      return this.isInitialized
    },

  },

  methods: {

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

    initialize() {
      const client = feathers()
      this.storeClient(client)
      this._initConnection()
    },

    service(location:string) : Service<any> {
      const client = this._getApplication()
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

    _initConnection() {
      const { url } = this
      const client = this._getApplication()

      if (client && url !== '') {
        const socket = createSocket({ url })
        console.warn('Initializing Server Connection', url, socket)

        client.configure(socketio(socket))
      } else {
        console.warn('ERR Server Connection', url, client)
      }
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
      }, 50)
    },

    _saveCurrentState() {
      const { id, isActive, url } = this
      const srvrStruct = { id, url, isActive, authentication: null }
      store.commit('updateServer', srvrStruct)
    },

    _createServiceConnection(service: ServiceStruct) {
      const { serviceConnections } = this
      const { id, path } = service
      console.log('SRVR CONNN _createServiceConnection', path)

      const srvcConn : IServiceConnection = createServiceConnection(this, service)
      this.$set(serviceConnections, id, srvcConn)
    },

    _deleteServiceConnection(service: ServiceStruct | IServiceConnection) {
      const { serviceConnections } = this
      const { id } = service
      const srvcConn = this.getServiceConnectionById(id)
      if (srvcConn) {
        destroyServiceConnection(srvcConn)
        this.$delete(serviceConnections, id)
      }
    },

    _loadServices() {
      const { servicesList } = this
      servicesList.forEach(item => {
        const { id } = item
        console.log('SRVR CONN checkinng', id)
        this._createServiceConnection(item)
      })
    },

  },

  watch: {

    isReady(newVal) {
      this.$emit('isReady', newVal)
    },

    selectedService(newVal: IServiceConnection | null) {
      store.commit('setCurrentService', newVal)
    },

  },

  created() {
    const { data } = this

    console.log(`Srvr Creating server connection: ${data.url}`)

    this.updateServer(data) // save initial state
    this._loadServices()
    this.initialize()
    this.isInitialized = true
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
