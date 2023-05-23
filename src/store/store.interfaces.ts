/*
  Vuex Store Interfaces
*/

// Constants & Interfaces
import { IServer, ServerHash } from '@/models/server.interfaces'
import { IServiceHash, ServiceHash } from '@/models/service.interfaces'

/*
  Vuex stored properties
*/
export interface State {
  // server config records key'd by generated id (persisted)
  servers: ServerHash
  // service config records key'd by generated id (persisted)
  services: ServiceHash

  // the currently viewed Feathers server (persisted)
  currentServerId: string | null
  // the currently viewed Feathers service (persisted)
  currentServiceId: string | null
  // the currently viewed Feathers record (persisted)
  currentRecordId: string | null

  // currently active Server instance
  serverInstance: IServer | null
  /*
    currently active Service instances
    key'd on Service path, eg:

    '/messages': <Service>
  */
  serviceInstances: IServiceHash
}
