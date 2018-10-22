// Libs
import Vue from 'vue'
import { GetterTree } from 'vuex'

// Constants / Interfaces
import {
  DisplayDialog,
  RootState,
  ServerStruct, ServersHash,
  IServerConnection, IServerConnectionsHash,
  ServiceStruct, ServicesHash,
  IServiceConnection, IServiceConnectionsHash
} from '@/interfaces'

const getters: GetterTree<RootState, RootState> = {

  displayDialog(state) : DisplayDialog | null {
    return state.displayDialog
  },

  // server

  currentServerId(state) : string | null {
    return state.currentServerId
  },

  getServerByServerId(state) {
    const servers = state.servers as ServersHash
    return function(serverId: string) : ServerStruct | null {
      return servers[serverId] || null
    }
  },

  currentServerConnections(state) {
    return state.serverConnections as IServerConnectionsHash
  },

  getServersList(state) : ServerStruct[] {
    const servers = state.servers as ServersHash
    return Object.values(servers).map(item => item)
  },

  getServerConnectionByServerId(state) {
    const connections = state.serverConnections as IServerConnectionsHash
    return function(serverId: string) : IServerConnection | null {
      return connections[serverId] || null
    }
  },

  getServerConnectionsList(state) : IServerConnection[] {
    const srvrConns = state.serverConnections as IServerConnectionsHash
    return Object.values(srvrConns).map(item => item)
  },

  // services

  currentServiceId(state) : string | null {
    return state.currentServiceId
  },

  getServiceByServiceId(state) {
    const services = state.services as ServicesHash
    return function(serviceId: string) : ServiceStruct | null {
      return services[serviceId] || null
    }
  },

  getServicesListByServerId(state) {
    const services = state.services as ServicesHash
    return function(serverId: string) : ServiceStruct[] {
      const res = Object.values(services).filter(item => item.serverId === serverId)
      return res
    }
  },

  currentServiceConnections(state) {
    return state.serviceConnections as IServiceConnectionsHash
  },

  getServiceConnectionById(state) {
    const connections = state.serviceConnections as IServiceConnectionsHash
    return function(serviceId: string) : IServiceConnection | null {
      return connections[serviceId] || null
    }
  },

  getServiceConnectionsList(state) : IServiceConnection[] {
    const connections = state.serviceConnections as IServiceConnectionsHash
    return Object.values(connections).map(item => item)
  },

  currentRecordId(state) : string | null {
    return state.currentRecordId
  },

}

export default getters
