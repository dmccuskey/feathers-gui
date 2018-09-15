// Libs
import Vue from 'vue'
import Vuex, { StoreOptions, Plugin } from 'vuex'
import createPersistedState from 'vuex-persistedstate'

import actions from './actions'
import getters from './getters'
import mutations from './mutations'

// Constants / Interfaces
import { RootState } from '@/interfaces'

Vue.use(Vuex)

const state: RootState = {

  /*
    structure for displayed dialog
    not persisted in localstorage
  */
  displayDialog: null,

  /*
    the currently viewed server for which services are being viewed
  */
  currentServerId: null,

  /*
    the currently viewed service for which records are being displayed
  */
  currentServiceId: null,

  /*
    the currently viewed record
  */
  currentRecordId: null,

  /*
    stored servers
  */
  servers: {},

  /*
    active server connections
    not persisted in localstorage
  */
  serverConnections: {},

  /*
    stored services
  */
  services: {},

  /*
    active service connections
    not persisted in localstorage
  */
  serviceConnections: {},

}

const plugins: Array<Plugin<RootState>> = [
  createPersistedState({
    paths: [
      'currentRecordId',
      'currentServerId',
      'currentServiceId',
      'servers',
      'services',
    ],
  }),
]

const store: StoreOptions<RootState> = {
  actions,
  getters,
  mutations,
  plugins,
  state,
}

export default new Vuex.Store<RootState>(store)
