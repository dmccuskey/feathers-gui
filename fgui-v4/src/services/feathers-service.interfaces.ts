// Constants & Interfaces
import {
  DataRecord,
  FeathersRecord,
  IFeathersServer,
  IFeathersServerConnectedEvent,
  IFeathersServerInitializedEvent,
  IFeathersServerReadyEvent,
} from '@/services/feathers-server.interfaces'
import { NullableId, Params } from '@feathersjs/feathers'

export interface IServiceError {
  message: string
  name: string
  code: number
}

export interface GetRepresentativeRecordProps {
  count?: number
  cleanId?: boolean
}

export interface IServerConnectionEvent<T> {
  target: IFeathersServer
  name: string
  data: T
}

export type IServerConnectionIsInitializedEvent =
  IServerConnectionEvent<boolean>

export type IServerConnectionIsConnectedEvent = IServerConnectionEvent<boolean>

export type DataRecordCallbackListener = (record: FeathersRecord) => void
export type DataArrayCallbackListener = (records: FeathersRecord[]) => void

export interface CreateFeathersServiceProps {
  fServer: IFeathersServer
  path: string
}

/*
  Vuejs Component Interfaces
*/

export interface IProps {
  fServer: IFeathersServer
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IComputed {}

export interface IData {
  debug: debug.IDebugger | null
  path: string
  isInitialized: boolean
  isError: IServiceError | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params: any // TODO check params usages
  fServerInitialized: boolean
}

export interface IMethods {
  addLoadedEventListener(callback: DataArrayCallbackListener): void
  removeLoadedEventListener(callback: DataArrayCallbackListener): void
  addCreatedEventListener(callback: DataRecordCallbackListener): void
  removeCreatedEventListener(callback: DataRecordCallbackListener): void
  addRemovedEventListener(callback: DataRecordCallbackListener): void
  removeRemovedEventListener(callback: DataRecordCallbackListener): void
  addUpdatedEventListener(callback: DataRecordCallbackListener): void
  removeUpdatedEventListener(callback: DataRecordCallbackListener): void
  addPatchedEventListener(callback: DataRecordCallbackListener): void
  removePatchedEventListener(callback: DataRecordCallbackListener): void

  // CRUD
  // TODO: promise types
  createRecord<T = DataRecord, R = FeathersRecord>(
    record: Partial<T>
  ): Promise<R | R[]>
  updateRecord(id: string, record: DataRecord): Promise<FeathersRecord>
  removeRecord<R = FeathersRecord>(
    id: NullableId,
    params?: Params
  ): Promise<R | R[]>
  patchRecord<T = DataRecord, R = FeathersRecord>(
    id: string,
    record: Partial<T>,
    params?: Params
  ): Promise<R | R[]>

  _handleOnCreated(record: FeathersRecord): void
  _handleOnUpdated(record: FeathersRecord): void
  _handleOnPatched(record: FeathersRecord): void
  _handleOnRemoved(record: FeathersRecord): void

  _loadRecords(): void

  _handleServerInitializedChange(event: IFeathersServerInitializedEvent): void
  _doServerIsInitializedActions(): void
  _doServerNotInitializedActions(): void

  _handleServerConnectedChange(event: IFeathersServerConnectedEvent): void
  _doServerIsConnectedActions(): void
  _doServerNotConnectedActions(): void

  _handleServerReadyChange(event: IFeathersServerReadyEvent): void
  _doServerIsReadyActions(): void
  _doServerNotReadyActions(): void

  _setupServerListeners(): void

  _removeServerListeners(): void
  _setupServiceListeners(path: string): void
  _removeServiceListeners(path: string): void

  _initialize(): void

  _ctor(props: CreateFeathersServiceProps): void
  _dtor(): void
}

export type IFeathersService = Vue & IData & IComputed & IMethods & IProps
