/* eslint-disable @typescript-eslint/no-explicit-any */
// Libs
import Vue from 'vue'

// Constants & Interfaces
import {
  Application,
  NullableId,
  Paginated,
  Params,
  Service,
} from '@feathersjs/feathers'
import {
  AuthenticationRequest,
  AuthenticationResult,
} from '@feathersjs/authentication'

/*
  Feathers Events
  names of Feathers record modification events
*/
export const FeathersEvents = {
  CREATED: 'created',
  PATCHED: 'patched',
  REMOVED: 'removed',
  UPDATED: 'updated',
}

export interface LocalAuth {
  strategy: 'local'
  // key/values for username and password to be added
  [key: string]: string
}

export interface FeathersError {
  name: string // error name eg 'BadRequest'
  message: string // error message string
  code: number // http status
  className: string // css style
  data?: any
  errors: any
}

// represents any database record
export interface DataRecord {
  [key: string]: any
}

// basic callback listener ; create specific when possible
export type Listener = (...args: any[]) => void

// Feathers record Id
export type DbRecordId = string

// represents a record from the feathers db
export interface FeathersRecord extends DataRecord {
  _id: DbRecordId
}

export interface FeathersRecordHash {
  [key: string]: FeathersRecord
}

export interface FeathersRecordsHash {
  [id: string]: FeathersRecordHash
}

export interface LocalCallbackHash {
  [key: string]: Listener
}

export interface IFeathersServerEvent<T> {
  target: IFeathersServer
  name: string
  data: T
}

export type IFeathersServerInitializedEvent = IFeathersServerEvent<boolean>
export type IFeathersServerConnectedEvent = IFeathersServerEvent<boolean>
export type IFeathersServerReadyEvent = IFeathersServerEvent<boolean>
export type IFeathersServerAuthenticatedEvent = IFeathersServerEvent<boolean>

export type BooleanEventCallback = (evt: IFeathersServerEvent<boolean>) => void

export interface ServiceCallbacksHash {
  [key: string]: Listener[]
}

export interface CreateFeathersServerProps {
  url: string
  authentication: LocalAuth | null
}

/*
  Vuejs Component Interfaces
*/

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IProps {}

export type FeathersFindResponse<T> = T | T[] | Paginated<T>

export interface IData {
  url: string
  authentication: LocalAuth | null

  isActive: boolean
  isConnected: boolean
  isError: string | null
  isInitialized: boolean
  isAuthenticated: boolean

  debug: debug.IDebugger | null
  socket: SocketIOClient.Socket | null
  stateMachine: any | null
  errorCount: number
  // callbacks attached to our Feathers Service
  serviceCallbacks: ServiceCallbacksHash
  // callbacks attached to Feathersjs Client
  localCallbacks: LocalCallbackHash
}

export interface IComputed {
  isReady: boolean
}

export interface IMethods {
  authenticate(request: AuthenticationRequest): Promise<AuthenticationResult>
  logout(): Promise<AuthenticationResult | null>

  // Feathers calls
  find<R = FeathersRecord>(
    path: string,
    params?: Params
  ): Promise<R | R[] | Paginated<R>>
  create<T = DataRecord, R = FeathersRecord>(
    path: string,
    data: Partial<T | T[]>,
    params?: Params
  ): Promise<R | R[]>
  patch<T = DataRecord, R = FeathersRecord>(
    path: string,
    id: NullableId,
    data: Partial<T>,
    params?: Params
  ): Promise<R | R[]>
  remove<R = FeathersRecord>(
    path: string,
    id: NullableId,
    params?: Params
  ): Promise<R | R[]>
  update(path: string, id: string, data: any, params?: Params): Promise<any>

  // Feathers event listeners
  onCreated(path: string, callback: Listener): void
  offCreated(path: string, callback: Listener): void
  onRemoved(path: string, callback: Listener): void
  offRemoved(path: string, callback: Listener): void
  onUpdated(path: string, callback: Listener): void
  offUpdated(path: string, callback: Listener): void
  onPatched(path: string, callback: Listener): void
  offPatched(path: string, callback: Listener): void

  addInitializedEventListener(callback: BooleanEventCallback): void
  removeInitializedEventListener(callback: BooleanEventCallback): void
  addConnectedEventListener(callback: BooleanEventCallback): void
  removeConnectedEventListener(callback: BooleanEventCallback): void
  addAuthenticatedEventListener(callback: BooleanEventCallback): void
  removeAuthenticatedEventListener(callback: BooleanEventCallback): void
  addReadyEventListener(callback: BooleanEventCallback): void
  removeReadyEventListener(callback: BooleanEventCallback): void

  _doAuthentication(): void

  // eslint-disable-next-line @typescript-eslint/ban-types
  _getClient(): Application<any> | null
  _service(location: string): Service<any>
  _storeClient(client: any): void
  _removeClient(): any | null
  _activateLocalEventListeners(): void
  _addServiceEventListener(key: string, callback: Listener): void
  _removeServiceEventListener(key: string, callback: Listener): void
  _attachLocalListener(key: string, callback: Listener): void

  _createLocalEventListener(key: string): Listener

  _createEvent<T>(name: string, data: any): IFeathersServerEvent<T>
  _emitEvent(event: IFeathersServerEvent<any>): void
  _verifyLocalEventListener(key: string): void
  _doStateConnect(): void
  _doStateInitialize(): void
  _handleSocketConnect(): void
  _clearError(): void
  _handleSocketConnectError(): void
  _handleSocketDisconnect(): void
  _setupSocketListeners(socket: SocketIOClient.Socket): void

  _ctor(props: CreateFeathersServerProps): void
}

export type IFeathersServer = Vue & IData & IMethods & IComputed & IProps
