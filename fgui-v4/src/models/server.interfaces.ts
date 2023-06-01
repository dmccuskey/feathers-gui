// Constants & Interfaces
import { IFeathersServer } from '@/services/feathers-server.interfaces'
import { IService, Service } from './service.interfaces'

export interface LocalAuthStruct {
  strategy: 'local'
  uKey: string // 'email'
  uValue: string // <user value>
  pKey: string // 'password'
  pValue: string // <password value>
}

export interface ServerProps {
  name: string
  url: string
  authentication: LocalAuthStruct | null
}

export interface Server extends ServerProps {
  id: string
}

export interface ServerHash {
  [key: string]: Server
}

/*
  Vuejs Component Interfaces
*/

export interface IProps {
  id: string
}

export interface IData {
  debug: debug.IDebugger | null
  fServer: IFeathersServer | null
  url: string
  name: string
  authentication: LocalAuthStruct | null
}

export interface IComputed {
  serverConfig: Server | null
  serviceConfigs: Service[]
  serviceInstances: IService[]
}

export interface IMethods {
  updateConfig(props: ServerProps): void

  _addServiceInstance(instance: IService): void
  _removeServiceInstance(instance: IService): void

  _createFeathersServer(): void
  _destroyFeathersServer(): void
  _updateFeathersServices(): void

  _saveServerChanges(): void

  _ctor(props: Server): void
  _dtor(): void
}

export type IServer = Vue & IData & IMethods & IComputed & IProps
