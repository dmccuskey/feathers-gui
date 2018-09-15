// Libs
import Vue from 'vue'
import { MutationTree } from 'vuex'

// Constants / Interfaces
import {
  DisplayDialog,
  RootState,
  ServerStruct,
  IServerConnection,
  IServiceConnection,
  ServiceStruct,
  FeathersRecord
} from '@/interfaces'

const mutations: MutationTree<RootState> = {

  /*
    Servers
  */

  addServer(state, payload: ServerStruct) {
    const { servers } = state
    const { id } = payload
    Vue.set(servers, id, payload)
  },

  updateServer(state, payload: ServerStruct) {
    const { servers } = state
    const { id } = payload
    Vue.set(servers, id, payload)
  },

  removeServerById(state, payload) {
    const { servers } = state
    const { id } = payload
    Vue.delete(servers, id)
  },

  setCurrentServer(state, payload:IServerConnection | null) {
    const id = (payload) ? payload.id : null
    state.currentServerId = id
  },

  addServerConnection(state, payload:IServerConnection) {
    const { serverConnections } = state
    const { id } = payload
    Vue.set(serverConnections, id, payload)
  },

  removeServerConnectionById(state, payload) {
    const { serverConnections } = state
    const { id } = payload
    Vue.delete(serverConnections, id)
  },

  /*
    Services
  */

  addService(state, payload) {
    const { services } = state
    const { id } = payload
    Vue.set(services, id, payload)
  },

  updateService(state, payload: ServiceStruct) {
    const { services } = state
    const { id } = payload
    Vue.set(services, id, payload)
  },

  removeServiceById(state, payload) {
    const { services } = state
    const { id } = payload
    Vue.delete(services, id)
  },

  setCurrentService(state, payload:IServiceConnection | null) {
    const id = (payload) ? payload.id : null
    state.currentServiceId = id
  },

  addServiceConnection(state, payload:IServiceConnection) {
    const { serviceConnections } = state
    const { id } = payload
    Vue.set(serviceConnections, id, payload)
  },

  removeServiceConnectionById(state, payload) {
    const { serviceConnections } = state
    const { id } = payload
    Vue.delete(serviceConnections, id)
  },

  /*
    Records
  */

  setCurrentRecord(state, payload: FeathersRecord | null) {
    const id = (payload) ? payload._id : null
    state.currentRecordId = id
  },

  /*
    Dialogs
  */

  showDialog(state, payload:DisplayDialog) {
    state.displayDialog = payload
  },

  removeCurrentDialog(state) {
    state.displayDialog = null
  },

}

export default mutations
