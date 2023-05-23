/* eslint-disable @typescript-eslint/no-explicit-any */
/*
  Feathers Server Model
*/
// Libs
import Vue from 'vue'
import Debug from 'debug'
import StateMachine from '@taoqf/javascript-state-machine'
import socketio from '@feathersjs/socketio-client'
import io from 'socket.io-client'
import auth from '@feathersjs/authentication-client'

// Constants & Interfaces
import feathers, {
  Application,
  NullableId,
  Params,
  Service,
} from '@feathersjs/feathers'
import { AuthenticationRequest } from '@feathersjs/authentication'
import { FeathersServerEvent } from './feathers-server.constants'
import {
  Listener,
  FeathersRecord,
  FeathersEvents,
  IFeathersServer,
  IFeathersServerEvent,
  IData,
  IMethods,
  IComputed,
  IProps,
  CreateFeathersServerProps,
  IFeathersServerConnectedEvent,
  IFeathersServerInitializedEvent,
  IFeathersServerAuthenticatedEvent,
  IFeathersServerReadyEvent,
  BooleanEventCallback,
} from './feathers-server.interfaces'

// Utils

const LogPrefix = '[Feathers Srvc]'

/*
  active Feathers client ; singleton
  this is the actual connection to Feathers Database
  will be created/destroyed as necessary
*/
let gClient: Application<any> | null = null

/*
  Helper functions
*/

// create callback key using Path and Event
type PathEventKey = string
const createServiceEventKey = function (
  path: string,
  eName: string
): PathEventKey {
  return `${path}:${eName}`
}

interface CreateSocketProps {
  url: string
}
const createSocket = function (props: CreateSocketProps) {
  const { url } = props
  return io(url, {
    transports: ['websocket'],
    // forceNew: true,
  })
}

const ObjectClass = Vue.extend<IData, IMethods, IComputed, IProps>({
  name: 'feathers-server',

  data() {
    return {
      url: '',
      authentication: null,
      isActive: true,
      isConnected: false,
      isError: null,
      isInitialized: false,
      isAuthenticated: false,

      debug: null,
      socket: null,
      stateMachine: null,
      errorCount: 0,
      serviceCallbacks: {
        /*
          key'd on path and event, eg:
          '/charts:removed': [ func, func, ...],
          '/charts:created': [ func, func, ... ]
        */
      },
      localCallbacks: {
        /*
          key'd on path and event, eg:
          '/charts:removed': func,
          '/charts:created': func
        */
      },
    }
  },

  computed: {
    isReady(): boolean {
      const { isInitialized, isConnected, isAuthenticated } = this
      return isInitialized && isConnected && isAuthenticated
    },
  },

  methods: {
    /* **********************************************************
      Public Methods
    */

    // Auth #############################################

    authenticate(request: AuthenticationRequest) {
      const client = this._getClient()

      if (client === null) {
        return Promise.reject(Error('no client'))
      }

      return client.authenticate(request)
    },

    logout() {
      const client = this._getClient()
      if (client === null) {
        return Promise.reject(null)
      }
      return client.logout()
    },

    // Service Calls #############################################

    find(path: string, params?: Params) {
      return this._service(path).find(params)
    },

    create(path: string, data: Partial<any>, params?: Params) {
      const srvc = this._service(path)
      if (srvc) {
        return srvc.create(data, params)
      }
      return Promise.reject(Error(`ERROR ${LogPrefix}: no service available`))
    },

    patch(path: string, id: string, data: Partial<any>, params?: Params) {
      return this._service(path).patch(id, data, params)
    },

    remove(path: string, id: NullableId, params?: Params) {
      return this._service(path).remove(id, params)
    },

    update<T>(
      path: string,
      id: string,
      data: T, // Data Record
      params?: Params
    ): Promise<T | T[]> {
      return this._service(path).update(id, data, params)
    },

    // Public Event Listeners #############################################

    onCreated(path: string, callback: Listener): void {
      const key = createServiceEventKey(path, FeathersEvents.CREATED)
      this._addServiceEventListener(key, callback)
      this._verifyLocalEventListener(key)
    },

    onUpdated(path: string, callback: Listener): void {
      const key = createServiceEventKey(path, FeathersEvents.UPDATED)
      this._addServiceEventListener(key, callback)
      this._verifyLocalEventListener(key)
    },

    onPatched(path: string, callback: Listener): void {
      const key = createServiceEventKey(path, FeathersEvents.PATCHED)
      this._addServiceEventListener(key, callback)
      this._verifyLocalEventListener(key)
    },

    onRemoved(path: string, callback: Listener): void {
      const key = createServiceEventKey(path, FeathersEvents.REMOVED)
      this._addServiceEventListener(key, callback)
      this._verifyLocalEventListener(key)
    },

    offCreated(path: string, callback: Listener): void {
      const key = createServiceEventKey(path, FeathersEvents.CREATED)
      this._removeServiceEventListener(key, callback)
    },
    offUpdated(path: string, callback: Listener): void {
      const key = createServiceEventKey(path, FeathersEvents.UPDATED)
      this._removeServiceEventListener(key, callback)
    },
    offPatched(path: string, callback: Listener): void {
      const key = createServiceEventKey(path, FeathersEvents.PATCHED)
      this._removeServiceEventListener(key, callback)
    },
    offRemoved(path: string, callback: Listener): void {
      const key = createServiceEventKey(path, FeathersEvents.REMOVED)
      this._removeServiceEventListener(key, callback)
    },

    // Event Attachments #############################################

    addInitializedEventListener(callback: BooleanEventCallback) {
      const { IS_INITIALIZED } = FeathersServerEvent
      this.$on(IS_INITIALIZED, callback)
    },
    removeInitializedEventListener(callback: BooleanEventCallback) {
      const { IS_INITIALIZED } = FeathersServerEvent
      this.$off(IS_INITIALIZED, callback)
    },

    addConnectedEventListener(callback: BooleanEventCallback) {
      const { IS_CONNECTED } = FeathersServerEvent
      this.$on(IS_CONNECTED, callback)
    },
    removeConnectedEventListener(callback: BooleanEventCallback) {
      const { IS_CONNECTED } = FeathersServerEvent
      this.$off(IS_CONNECTED, callback)
    },

    addAuthenticatedEventListener(callback: BooleanEventCallback) {
      const { IS_AUTHENTICATED } = FeathersServerEvent
      this.$on(IS_AUTHENTICATED, callback)
    },
    removeAuthenticatedEventListener(callback: BooleanEventCallback) {
      const { IS_AUTHENTICATED } = FeathersServerEvent
      this.$off(IS_AUTHENTICATED, callback)
    },

    addReadyEventListener(callback: BooleanEventCallback) {
      const { IS_READY } = FeathersServerEvent
      this.$on(IS_READY, callback)
    },
    removeReadyEventListener(callback: BooleanEventCallback) {
      const { IS_READY } = FeathersServerEvent
      this.$off(IS_READY, callback)
    },

    /* **********************************************************
      Private Methods
    */

    _getClient(): Application<any> | null {
      return gClient
    },

    _removeClient(): void {
      gClient = null
    },

    _service(location: string): Service<any> {
      const client = this._getClient()
      if (client === null) {
        throw new Error(
          `${LogPrefix} no client. check client status before making calls.`
        )
      }
      return client.service(location)
    },

    _storeClient(client: Application<any>) {
      gClient = client
    },

    /*
      loop through the local listeners and attach them to current Feathers client
    */
    _activateLocalEventListeners() {
      const { localCallbacks } = this
      Object.entries(localCallbacks).forEach((items) => {
        const [key, callback] = items
        this._attachLocalListener(key, callback)
      })
    },

    _attachLocalListener(key: PathEventKey, callback: Listener) {
      const [path, event] = key.split(':')
      this._service(path).on(event, callback)
    },

    // save the callback to the localCallbacks list
    _addServiceEventListener(key: PathEventKey, callback: Listener) {
      const { serviceCallbacks } = this
      const scList = serviceCallbacks[key] || []
      scList.push(callback)
      serviceCallbacks[key] = scList
    },

    _removeServiceEventListener(key: PathEventKey, callback: Listener) {
      const { serviceCallbacks } = this
      const scList = serviceCallbacks[key]

      if (!scList) return

      const idx = scList.indexOf(callback)
      if (idx > -1) {
        scList.splice(idx, 1)
      }
    },

    _createEvent<T>(name: string, data: any): IFeathersServerEvent<T> {
      return { target: this, name, data }
    },

    _emitEvent(event: IFeathersServerEvent<any>) {
      const { name } = event
      this.$emit(name, event)
    },

    /*
      _createLocalEventListener

      create Server Local Callback Listener
      local listener is callback that is attached to Feathers client
      it proxies changes to stored Service Callback Listeners
    */
    _createLocalEventListener(key: PathEventKey): Listener {
      return (data: FeathersRecord) => {
        const { serviceCallbacks } = this
        const scList = serviceCallbacks[key] || []
        scList.forEach((serviceCallback) => {
          serviceCallback(data)
        })
      }
    },

    /*
      _verifyLocalEventListener

      check if listener on Client is already created
    */
    _verifyLocalEventListener(key: PathEventKey) {
      const { localCallbacks } = this

      if (localCallbacks[key] === undefined) {
        const callback = this._createLocalEventListener(key)
        localCallbacks[key] = callback

        const client = this._getClient()
        if (client) {
          // already have a client, so add new callback now
          this._attachLocalListener(key, callback)
        }
      }
    },

    _doAuthentication() {
      const { authentication } = this

      if (authentication == null) {
        this.isAuthenticated = true
      } else {
        this.authenticate(authentication)
          .then(() => {
            this.isAuthenticated = true
          })
          .catch((error: any) => {
            console.log('error authenticating', error)
            this.isAuthenticated = false
          })
      }
    },

    // State Machine Handlers #############################################

    _doStateConnect() {
      const { url, debug } = this
      debug && debug(`${LogPrefix} Attempting Connection to (${url})`)

      // socket
      const io = createSocket({ url })
      this._setupSocketListeners(io)
      const socket = socketio(io)
      this.socket = io

      // feathers client
      const client = feathers()
      client.configure(socket)
      client.configure(auth())
      this._storeClient(client)

      this._activateLocalEventListeners()
    },

    _doStateInitialize() {
      this.isInitialized = true
    },

    // Socket Handlers & Support #############################################

    _clearError() {
      this.errorCount = 0
      this.isError = null
    },

    _handleSocketConnect() {
      this.stateMachine.connectOk()
      this._clearError()
    },

    _handleSocketConnectError() {
      this.errorCount += 1
    },

    _handleSocketDisconnect() {
      this.stateMachine.connectErr()
      this._clearError()
    },

    _setupSocketListeners(socket: SocketIOClient.Socket) {
      socket.on('connect', this._handleSocketConnect)
      socket.on('disconnect', this._handleSocketDisconnect)
      socket.on('connect_error', this._handleSocketConnectError)
      // socket.on('connect_timeout', this._handleSocketConnectTimeout)
      // socket.on('error', this._handleSocketError)
    },

    _ctor(props: CreateFeathersServerProps) {
      const { url, authentication } = props

      this.url = url
      this.authentication = authentication
    },
  },

  watch: {
    isAuthenticated(newVal: boolean) {
      const { IS_AUTHENTICATED } = FeathersServerEvent
      const event: IFeathersServerAuthenticatedEvent =
        this._createEvent<boolean>(IS_AUTHENTICATED, newVal)
      this._emitEvent(event)
    },

    isConnected(newVal: boolean) {
      const { IS_CONNECTED } = FeathersServerEvent
      const event: IFeathersServerConnectedEvent = this._createEvent<boolean>(
        IS_CONNECTED,
        newVal
      )
      this._emitEvent(event)
    },

    isInitialized(newVal: boolean) {
      const { IS_INITIALIZED } = FeathersServerEvent
      const event: IFeathersServerInitializedEvent = this._createEvent<boolean>(
        IS_INITIALIZED,
        newVal
      )
      this._emitEvent(event)
    },

    isReady(newVal: boolean) {
      const { IS_READY } = FeathersServerEvent
      const event: IFeathersServerReadyEvent = this._createEvent<boolean>(
        IS_READY,
        newVal
      )
      this._emitEvent(event)
    },
  },

  created() {
    this.debug = Debug(`app:feathers`)

    this.stateMachine = new StateMachine({
      init: 'created',

      transitions: [
        {
          // initialize()
          name: 'initialize',
          from: 'created',
          to: 'initialized',
        },
        {
          // connect()
          name: 'connect',
          from: 'initialized',
          to: 'connecting',
        },
        {
          // connect()
          name: 'connect',
          from: 'disconnected',
          to: 'connecting',
        },
        // disconnect()
        // { name: 'disconnect', from: ['initialized', 'disconnected'], to: 'disconnected' },
        // { name: 'disconnect', from: 'connected', to: 'disconnecting' },
        // { name: 'disconnect', from: 'connecting', to: 'disconnecting' },

        // (socket transitions)
        {
          // connectOk()
          name: 'connectOk',
          from: ['connecting', 'recovered'],
          to: 'connected',
        },
        {
          // connectErr()
          name: 'connectErr',
          from: ['connecting', 'disconnecting'],
          to: 'disconnected',
        },
        {
          // connectErr()
          name: 'connectErr',
          from: 'connected',
          to: 'recovered',
        },
      ],

      data: {},

      methods: {
        onEnterCreated: () => {
          const { debug } = this
          debug && debug(`Service Created`)
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
          const { url, debug } = this

          debug && debug(`Socket is Connected (${url})`)
          this.isConnected = true

          this._doAuthentication()
        },
      },
    })
    this.stateMachine.initialize()
  },
})

let singleton: IFeathersServer // | null = null

/*
  create Feathers Service based on structure
*/
export const create = (props: CreateFeathersServerProps): IFeathersServer => {
  if (!singleton) {
    // console.log(`${LogPrefix} creating service connector`)
    singleton = new ObjectClass({
      propsData: {},
    })
    singleton._ctor(props)
  }
  return singleton
}

export const destroy = (instance: IFeathersServer): void => {
  instance.$destroy()
}

export const getInstance = (): IFeathersServer => {
  return singleton
}
