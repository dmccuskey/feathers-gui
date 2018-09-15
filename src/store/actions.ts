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

}

export default actions
