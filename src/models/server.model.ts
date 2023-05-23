/*
  Server Class

  wrapper for IFeathersServer
  creates IService instances
*/

// Libs
import Vue from 'vue'

// Constants & Interfaces
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { FeathersServerEvent } from '@/services/feathers-server.constants'
import {
  IComputed,
  IData,
  IMethods,
  IProps,
  IServer,
  LocalAuthStruct,
  Server,
  ServerProps,
} from './server.interfaces'
import { Mutations } from '@/store/mutations'
import { IService } from './service.interfaces'
import { LocalAuth } from '@/services/feathers-server.interfaces'

// Components
import {
  create as createServer,
  destroy as destroyServer,
} from '@/services/feathers-server.model'
import {
  create as createService,
  destroy as destroyService,
} from '@/models/service.model'

// Controllers & Services
import store from '@/store'

const createFeathersServerAuthRequest = function (
  struct: LocalAuthStruct
): LocalAuth {
  const { uKey, uValue, pKey, pValue } = struct

  const props: LocalAuth = {
    strategy: 'local',
    [uKey]: uValue,
    [pKey]: pValue,
  }
  return props
}

export const ObjectClass = Vue.extend<IData, IMethods, IComputed, IProps>({
  name: 'server-model',

  props: {
    id: {
      type: String,
      required: true,
    },
  },

  data() {
    return {
      fServer: null,
      url: '',
      name: '',
      authentication: null,
    }
  },

  computed: {
    serverConfig() {
      const { id } = this
      const { servers } = store.state

      const rec = Object.values(servers).find((item) => item.id === id)
      return rec || null
    },

    serviceConfigs() {
      const { id } = this
      const { services } = store.state
      return Object.values(services).filter((item) => item.serverId === id)
    },

    serviceInstances() {
      const { serviceInstances } = store.state
      return Object.values(serviceInstances)
    },
  },

  methods: {
    updateConfig(props: ServerProps) {
      const { name, url, authentication } = props

      this.name = name
      this.url = url
      this.authentication = authentication
    },

    // save Service properties to Store
    _saveServerChanges() {
      const { id, name, url, authentication } = this

      const props: Server = {
        id,
        name,
        url,
        authentication,
      }
      store.commit(Mutations.UPDATE_SERVER, props)
    },

    _createFeathersServer() {
      const { url, authentication } = this

      const auth = authentication
        ? createFeathersServerAuthRequest(authentication)
        : null
      const fServer = createServer({ url, authentication: auth })

      /*
      fServer.$on(FeathersServerEvent.IS_INITIALIZED, () => {
        console.log('IS_INITIALIZED')
      })
      fServer.$on(FeathersServerEvent.IS_CONNECTED, () => {
        console.log('IS_CONNECTED')
      })
      fServer.$on(FeathersServerEvent.IS_AUTHENTICATED, () => {
        console.log('IS_AUTHENTICATED')
      })
      fServer.$on(FeathersServerEvent.IS_READY, () => {
        console.log('IS_READY')
      })
      */
      this.fServer = fServer
    },

    _destroyFeathersServer() {
      const { fServer } = this
      if (!fServer) return
      destroyServer(fServer)
      this.fServer = null
    },

    // create and destroy IServices based on store state
    _updateFeathersServices() {
      const { fServer, serviceConfigs, serviceInstances } = this
      if (!fServer) return

      let ids: string[]

      // add services
      ids = serviceInstances.map((item) => item.id)
      serviceConfigs.forEach((config) => {
        const { id } = config
        if (ids.includes(id)) return

        const instance = createService(config, fServer)
        this._addServiceInstance(instance)
      })

      // remove remove services
      ids = serviceConfigs.map((item) => item.id)
      serviceInstances.forEach((item) => {
        const { id } = item
        if (ids.includes(id)) return

        this._removeServiceInstance(item)
        destroyService(item)
      })
    },

    _addServiceInstance(instance: IService) {
      store.commit(Mutations.ADD_SERVICE_INSTANCE, instance)
    },

    _removeServiceInstance(instance: IService) {
      store.commit(Mutations.REMOVE_SERVICE_INSTANCE, instance)
    },

    _ctor(props: Server) {
      const { url, name, authentication } = props

      this.url = url
      this.name = name
      this.authentication = authentication

      this._createFeathersServer()
      this._updateFeathersServices()
    },
  },

  watch: {
    serviceConfigs() {
      this._updateFeathersServices()
    },
    serverConfig(nV) {
      this.updateConfig(nV)
    },
  },
})

/*
  create Service based on structure
*/
export const create = function (props: Server): IServer {
  const { id } = props
  const obj = new ObjectClass({
    propsData: {
      id,
    },
  })
  obj._ctor(props)
  return obj
}

export const destroy = function (instance: IServer): void {
  instance.$destroy()
}
