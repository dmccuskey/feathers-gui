/*
  core interfaces
*/

// Libs
import Vue from 'vue'
import { Service } from '@feathersjs/feathers'

// Interface

/*
  Misc
*/

export interface PropertyLookupHash {
  [key:string] : string
}

/*
  Vuex Store
*/

export interface RootState {
  displayDialog: DisplayDialog | null
  currentServerId: string | null
  currentServiceId: string | null
  currentRecordId: string | null
  serverConnections: IServerConnectionsHash
  servers: ServersHash
  services: ServicesHash
  serviceConnections: IServiceConnectionsHash
}

/*
  Record Structures
*/

export interface GetRepresentativeRecordProps {
  count?: number
  cleanId?: boolean
}

export interface DataRecord {
  [key:string] : any
}
export interface FeathersRecord extends DataRecord {
  _id:string
}

/*
  Dialogs
*/

export interface DisplayDialog {
  type: string
  data?: any
  success: Function
  cancel?: Function
}

export interface ShowDialogProps {
  success?: Function | null
  cancel?: Function | null
}

export interface ShowAddServiceDialogProps extends ShowDialogProps {
  serverConnection: IServerConnection
}
export interface ShowAddServiceRecordDialogProps extends ShowDialogProps {
  record: DataRecord
}
export interface SelectServiceFieldsDialogData {
  record: DataRecord
  serviceConnection: IServiceConnection
}
export interface ShowSelectServiceFieldsDialogProps extends ShowDialogProps {
  data: SelectServiceFieldsDialogData
}

export type Listener = (...args: any[]) => void

/*
  Servers
*/

export interface ServerProps {
  url: string
  isActive: boolean
  authentication: object | null
}

export interface ServerStruct extends ServerProps {
  id: string
}

export interface ServersHash {
  [key:string] : ServerStruct
}
export interface ServiceCallbacksHash {
  [key:string] : Listener[]
}
export interface LocalCallbackHash {
  [key:string] : Listener
}

export interface IServerConnectionEvent<T> {
  target: IServerConnection
  name: string
  data: T
}

export interface IServerConnectionIsInitializedEvent extends IServerConnectionEvent<boolean> {}
export interface IServerConnectionIsConnectedEvent extends IServerConnectionEvent<boolean> {}

export interface AddServiceProps {
  path: string
  serverId: string
}
export interface AddServerProps {
  url: string
  isActive: boolean
  authentication: null
}

export interface StateMachineEvent {
  transition: string
  from: string
  to: string
}

export interface IServerConnectionData {
  isActiveValue: boolean
  urlValue: string
  authentication: null

  errorCount: number
  isError: string | null

  socket: SocketIOClient.Socket | null,
  isInitialized: boolean
  isConnected: boolean
  saveTimerRef: NodeJS.Timer | null
  stateChangeTimerRef: NodeJS.Timer | null
  selectedService: IServiceConnection | null
  serviceConnections: IServiceConnectionsHash
  serviceCallbacks: ServiceCallbacksHash
  localCallbacks: LocalCallbackHash
  stateMachine: any | null
  debug: debug.IDebugger | null
}

export interface IServerConnection extends Vue {
  id: string
  url: string
  isActive: boolean
  isConnected: boolean
  isError: string | null
  isInitialized: boolean

  serviceConnectionsList: IServiceConnection[]

  toggleActiveState() : void
  updateServer(props:ServerProps) : void
  addService(props: AddServiceProps) : void
  hasService(path:string) : boolean
  removeService(service: ServiceStruct | IServiceConnection) : void
  setSelectedService(service: ServiceStruct | IServiceConnection) : void

  // Feathers calls
  find(path:string, params?:any): Promise<any>
  create(path:string, jsonRec:any, params?:any): Promise<any>
  patch(path:string, id:string, data:any, params?:any) : Promise<any>
  remove(path:string, id:string, params?:any) : Promise<any>
  update(path:string, id:string, data:any, params?:any) : Promise<any>

  // Feathers events
  onCreated(path:string, callback:Listener) : void
  offCreated(path:string, callback:Listener) : void
  onRemoved(path:string, callback:Listener) : void
  offRemoved(path:string, callback:Listener) : void
  onUpdated(path:string, callback:Listener) : void
  offUpdated(path:string, callback:Listener) : void
  onPatched(path:string, callback:Listener) : void
  offPatched(path:string, callback:Listener) : void
}

export interface IServerConnectionsHash {
  [key:string] : IServerConnection
}

/*
  Services
*/

export interface ServiceFieldsStruct {
  property: string
  type: string
}

export interface ServiceProps {
  fields: ServiceFieldsStruct[]
  filters: any[]
  path: string
}

export interface ServiceStruct {
  id: string
  fields: ServiceFieldsStruct[]
  filters: any[]
  path: string
  serverId: string
}

export interface ServicesHash {
  [key:string] : ServiceStruct
}

export interface IServiceConnectionErrorStruct {
  message: string
  name: string
  code: number
}
export interface IServiceConnectionData {
  fieldsValue: ServiceFieldsStruct[]
  filtersValue: DataRecord[]
  pathValue: string

  isInitialized: boolean
  isError: IServiceConnectionErrorStruct | null
  params: any
  records: FeathersRecord[]
  representative: FeathersRecord
  selectedRecords: FeathersRecord[]
  selectedRecord: FeathersRecord | null
  saveTimerRef: NodeJS.Timer | null
}

export interface IServiceConnection extends Vue, IServiceConnectionData {
  id: string
  path: string
  fields: any[]
  serverId: string
  // filters: any[]

  isError: IServiceConnectionErrorStruct | null

  updateFields(fields:any) : void
  getRepresentativeRecord(props: GetRepresentativeRecordProps): any
  setSelectedRecord(record:FeathersRecord | null) : void

  // data record CRUD actions
  createRecord(record:any): Promise<any>
  readRecord(id:string) : DataRecord | null
  updateRecord(id:string, record:DataRecord) : Promise<any>
  deleteRecord(id:string) : Promise<any>

  removeSelectedRecords() : Promise<any>
}

export interface IServiceConnectionsHash {
  [key:string] : IServiceConnection
}

export interface FeathersError {
  name: string // error name eg 'BadRequest'
  message: string // error message string
  code: number // http status
  className: string // css style
  data?: any
  errors: any
}
