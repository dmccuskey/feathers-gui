/*
 */
import { IServer, ServerHash } from '@/models/server.interfaces'
import { Server, ServerProps } from '@/models/server.interfaces'
import { FeathersRecord } from '@/services/feathers-server.interfaces'
import { Deferred } from 'ts-deferred'
import {
  AddEditServerDialogProps,
  AddEditServerDialogResultProps,
  AddServiceDialogProps,
  AddServiceRecordDialogProps,
  ManageServersDialogProps,
  SelectServiceFieldsDialogProps,
} from './dialog.interfaces'
import {
  IService,
  IServiceHash,
  PropertyLookupHash,
  Service,
  ServiceProps,
} from '@/models/service.interfaces'

export interface CRUDMutationPayload {
  servicePath: string
  record: FeathersRecord
}

export type DialogPropTypes =
  | AddServiceDialogProps
  | AddServiceRecordDialogProps
  | SelectServiceFieldsDialogProps
  | AddEditServerDialogProps
  | AddEditServerDialogResultProps
  | ManageServersDialogProps

export interface ShowDialogProps {
  type: string // dialog type , DialogTypes
  // TODO: remove any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deferred: Deferred<any>
  props: DialogPropTypes // dialog data
}

export interface DialogEvent {
  target: IAppCtrl
  data: ShowDialogProps
}

export type DialogEventListener = (event: DialogEvent) => void

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IProps {}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IData {
  // filtersValue: DataRecord[]
  // pathValue: string
}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IComputed {
  // fields: ServiceFields[]
  // serverId: string
  serversList: Server[]
  serverConfigs: ServerHash
  currentServerId: string | null
  currentServerConfig: Server | null
  currentServiceId: string | null
  serverInstance: IServer | null
  serviceInstances: IServiceHash
  serviceInstanceList: IService[]
  hostname: string
  usingFeathersGui: boolean
}

export interface IMethods {
  addServer(props: ServerProps): void
  removeServer(server: Server): void
  updateServer(server: Server): void

  activateServer(server: Server): void
  activateServerById(serverId: string): void
  addService(props: ServiceProps): void
  removeService(id: string): void
  _getServicesByServerId(id: string): Service[]
  _requestDialog(event: DialogEvent): void

  // dialogs
  showAddServiceDialog(props: AddServiceDialogProps): Promise<string>
  showAddServiceRecordDialog(
    props: AddServiceRecordDialogProps
  ): Promise<string>
  showSelectServiceFieldsDialog(
    props: SelectServiceFieldsDialogProps
  ): Promise<PropertyLookupHash>
  showAddEditServerDialog(
    record?: Server
  ): Promise<AddEditServerDialogResultProps>
  showManageServersDialog(): void

  // Store methods
  setCurrentServiceId(id: string | null): void
  setCurrentRecordId(id: string | null): void

  addDialogEventListener(callback: DialogEventListener): void
  removeDialogEventListener(callback: DialogEventListener): void
  _setCurrentServerId(id: string | null): void
  _setCurrentServer(instance: IServer | null): void

  _destroyCurrentIServer(): void
  _initializeServer(): void
  _ctor(): void
}

export type IAppCtrl = Vue & IData & IMethods & IComputed & IProps
