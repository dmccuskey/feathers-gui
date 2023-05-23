// Libs
import { GetterTree } from 'vuex'

// Constants / Interfaces
import { State } from './store.interfaces'
import { Server, ServerHash } from '@/models/server.interfaces'

export interface Getters {
  getServerConfigById: (id: string) => Server | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getters: GetterTree<State, any> = {
  // server

  currentServerId(state): string | null {
    return state.currentServerId
  },

  getServerConfigById(state) {
    const servers = state.servers as ServerHash
    return function (id: string): Server | null {
      return servers[id] || null
    }
  },

  // get list of configured Feathers servers
  getServersList(state): Server[] {
    const servers = state.servers as ServerHash
    return Object.values(servers).map((item) => item)
  },

  // services

  currentServiceId(state): string | null {
    return state.currentServiceId
  },
}

export default getters
