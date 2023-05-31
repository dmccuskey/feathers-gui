// Libs
import Vue from 'vue'
import Vuex, { StoreOptions, Plugin } from 'vuex'
import createPersistedState from 'vuex-persistedstate'

import actions from './actions'
import getters from './getters'
import mutations from './mutations'

// Constants / Interfaces
import { State } from './store.interfaces'

Vue.use(Vuex)

const state: State = {
  // persisted data
  servers: {},
  services: {},
  currentServerId: null,
  currentServiceId: null,
  currentRecordId: null,

  // active objects
  serverInstance: null, // AppCtrl
  serviceInstances: {}, // Server
}

const plugins: Array<Plugin<State>> = [
  createPersistedState({
    key: 'feathers-gui',
    paths: [
      'currentRecordId',
      'currentServerId',
      'currentServiceId',
      'servers',
      'services',
    ],
  }),
]

const store: StoreOptions<State> = {
  actions,
  getters,
  mutations,
  plugins,
  state,
}

export default new Vuex.Store<State>(store)
