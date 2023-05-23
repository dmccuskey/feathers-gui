/*
  Vuex Mutations
*/

// Libs
import Vue from 'vue'
import { MutationTree } from 'vuex'

// Constants & Interfaces
import { State } from './store.interfaces'
import { FeathersRecord } from '@/services/feathers-server.interfaces'
import { IServer, Server } from '@/models/server.interfaces'
import { IService, Service } from '@/models/service.interfaces'
// import { CRUDMutationPayload } from '@/controllers/app-ctrl.interfaces'

const LogPrefix = '[store.mutations]'

// keys used to identify mutations
export const Mutations = {
  // server mutations
  ADD_SERVER: 'addServer',
  UPDATE_SERVER: 'updateServer',
  REMOVE_SERVER: 'removeServer',
  // service mutations
  ADD_SERVICE: 'addService',
  REMOVE_SERVICE: 'removeService',
  UPDATE_SERVICE: 'updateService',
  // current server instance mutations
  SET_SERVER_ID: 'setCurrentServerId',
  SET_SERVICE_ID: 'setCurrentServiceId',
  SET_RECORD_ID: 'setCurrentRecordId',
  // current service instance mutations
  SET_SERVER_INSTANCE: 'setServerInstance',
  ADD_SERVICE_INSTANCE: 'addServiceInstance',
  REMOVE_SERVICE_INSTANCE: 'removeServiceInstance',
}

const mutations: MutationTree<State> = {
  /*
    Servers
  */

  addServer(state, payload: Server) {
    const { servers } = state
    const { id } = payload
    Vue.set(servers, id, payload)
  },

  updateServer(state, payload: Server) {
    const { servers } = state
    const { id } = payload

    if (servers[id]) {
      servers[id] = { ...payload }
    } else {
      console.error(`ERROR ${LogPrefix} Server not found '${id}'`)
    }
  },

  removeServer(state, payload: Server) {
    const { servers } = state
    const { id } = payload
    Vue.delete(servers, id)
  },

  setCurrentServerId(state, payload: string | null) {
    state.currentServerId = payload
  },

  setCurrentServiceId(state, payload: string | null) {
    state.currentServiceId = payload
  },

  setCurrentRecordId(state, payload: string | null) {
    state.currentRecordId = payload
  },

  setServerInstance(state, payload: IServer | null) {
    state.serverInstance = payload
  },

  /*
    Services
  */

  addService(state, payload: Service) {
    const { services } = state
    const { id } = payload
    Vue.set(services, id, payload)
  },

  updateService(state, payload: Service) {
    const { services } = state
    const { id } = payload

    if (services[id]) {
      services[id] = { ...payload }
    } else {
      console.error(`ERROR ${LogPrefix} Service not found '${id}'`)
    }
  },

  removeService(state, payload: string) {
    const { services } = state
    Vue.delete(services, payload)
  },

  addServiceInstance(state, payload: IService) {
    const { serviceInstances } = state
    const { id } = payload
    Vue.set(serviceInstances, id, payload)
  },

  removeServiceInstance(state, payload: IService) {
    const { serviceInstances } = state
    const { id } = payload
    Vue.delete(serviceInstances, id)
  },

  /*
    Records
  */

  setCurrentRecord(state, payload: FeathersRecord | null) {
    const value = payload ? payload._id : null
    state.currentRecordId = value
  },
}

export default mutations
