// Libs
import Vue from 'vue'
import { ActionTree } from 'vuex'

// Constants / Interfaces
import { RootState } from '@/interfaces'

// Utils
import { cloneRecord } from '@/utils/data-utils'

const actions: ActionTree<RootState, RootState> = {

  updateServiceFields({ state, getters }, payload) {
    const { id, fields } = payload
    const { services } = state

    const srvcFunc = getters['getServiceByServiceId']
    const service = srvcFunc(id)
    const clone = cloneRecord(service)
    clone.fields = fields
    Vue.set(services, id, clone)
  },

  setCurrentServer({ state, dispatch, commit }, payload) {
    const id = (payload) ? payload.id : null
    const { currentServerId } = state
    commit('setCurrentServer', payload)

    if (id === null || currentServerId !== id) {
      // reset other selections
      dispatch('setCurrentService', null)
    }
  },

  setCurrentService({ state, commit }, payload) {
    const id = (payload) ? payload.id : null
    const { currentServiceId } = state
    commit('setCurrentService', payload)

    if (id === null || currentServiceId !== id) {
      // reset other selections
      commit('setCurrentRecord', null)
    }
  },

}

export default actions
