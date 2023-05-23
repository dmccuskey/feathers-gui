/*
  Feathers Service Class

  there is a single instance per service path, eg '/messages'

  the model handles loading data and event handling from Feathers service
  as well as manipulating data for display in the UI

  writes changes to Service config back to Vuex store
*/

// Libs
import Vue from 'vue'

// Constants & Interfaces
import {
  GetRecordTemplateProps,
  IComputed,
  IData,
  IMethods,
  IProps,
  IService,
  PropertyLookupHash,
  Service,
} from './service.interfaces'
import {
  DataRecord,
  FeathersRecord,
  IFeathersServer,
} from '@/services/feathers-server.interfaces'
import { Mutations } from '@/store/mutations'

// Components
import store from '@/store'

// Controllers & Services
import {
  create as createService,
  destroy as destroyService,
} from '@/services/feathers-service.model'

// Utils
import {
  cleanFeathersRecord,
  cloneRecord,
  createRepresentativeRecord,
  unpackPropertyTypeStruct,
} from '@/utils/data-utils'

export const ObjectClass = Vue.extend<IData, IMethods, IComputed, IProps>({
  name: 'service-model',

  props: {
    id: {
      type: String,
      required: true,
    },
    serverId: {
      type: String,
      required: true,
    },
    fServer: {
      type: Object as () => IFeathersServer,
      required: true,
    },
  },

  data() {
    return {
      fService: null,
      data: {}, // Feathers records
      path: '',
      fields: [],
      recordTemplate: { _id: '' },
      selectedRecords: [],
      isInitialized: false,
    }
  },

  computed: {
    isError() {
      return null
    },

    records() {
      const { data } = this
      return Object.values(data)
    },
  },

  methods: {
    createRecord(record: DataRecord) {
      const { fService } = this

      if (!fService) return Promise.reject('no fService')
      return fService.createRecord(record)
    },

    updateRecord(id: string, record: DataRecord) {
      const { fService } = this

      if (!fService) return Promise.reject('no fService')
      return fService.updateRecord(id, record)
    },

    removeSelectedRecords() {
      const { fService, selectedRecords } = this
      const promises: Promise<FeathersRecord | FeathersRecord[]>[] = []

      if (!fService) return Promise.reject('no fService')

      selectedRecords.forEach((record) => {
        const { _id } = record
        const p = fService.removeRecord(_id)
        promises.push(p)
      })

      void Promise.all(promises).then((result) => {
        this.selectedRecords = []
        return result
      })
    },

    getRecordTemplate(props: GetRecordTemplateProps) {
      const { recordTemplate, fields } = this
      let { cleanId } = props
      cleanId = cleanId === undefined ? true : cleanId

      let dRec: DataRecord
      if (cleanId) {
        dRec = cleanFeathersRecord(recordTemplate)
      } else {
        dRec = cloneRecord(recordTemplate)
      }
      return createRepresentativeRecord(dRec, fields)
    },

    updateFields(packedfields: PropertyLookupHash) {
      this.fields = unpackPropertyTypeStruct(packedfields)
    },

    getRecordById(id: string) {
      const { data } = this
      return data[id] || null
    },

    _createFeathersService() {
      const { fServer, path } = this

      const fService = createService(fServer, path)

      fService.addLoadedEventListener(this._handleLoadedEvent)
      fService.addCreatedEventListener(this._handleCreatedEvent)
      fService.addRemovedEventListener(this._handleRemovedEvent)
      fService.addUpdatedEventListener(this._handleUpdatedPatchedEvent)
      fService.addPatchedEventListener(this._handleUpdatedPatchedEvent)

      this.fService = fService
    },

    _destroyFeathersService() {
      const { fService } = this
      if (!fService) return

      fService.removeLoadedEventListener(this._handleLoadedEvent)
      fService.removeCreatedEventListener(this._handleCreatedEvent)
      fService.removeRemovedEventListener(this._handleRemovedEvent)
      fService.removeUpdatedEventListener(this._handleUpdatedPatchedEvent)
      fService.removePatchedEventListener(this._handleUpdatedPatchedEvent)

      destroyService(fService)

      this.fService = null
    },

    /*
      fService event handlers
    */
    _handleLoadedEvent(records: FeathersRecord[]) {
      const { data } = this

      records.forEach((record) => {
        const { _id } = record
        this.$set(data, _id, record)
        this._updateRecordTemplate(record)
      })
    },

    _handleCreatedEvent(record: FeathersRecord) {
      const { data } = this
      const { _id } = record

      this.$set(data, _id, record)
      this._updateRecordTemplate(record)
    },

    _handleUpdatedPatchedEvent(record: FeathersRecord) {
      const { data } = this
      const { _id } = record

      this.$set(data, _id, record)
      this._updateRecordTemplate(record)
    },

    _handleRemovedEvent(record: FeathersRecord) {
      const { data } = this
      const { _id } = record

      this.$delete(data, _id)
    },

    _updateRecordTemplate(record: FeathersRecord) {
      const { recordTemplate } = this
      this.recordTemplate = Object.assign({}, recordTemplate, record)
    },

    // save Service properties to Store
    _saveServiceChanges() {
      const { id, isInitialized, path, fields, serverId } = this

      if (!isInitialized) return

      const service: Service = {
        id,
        serverId,
        path,
        fields,
      }
      store.commit(Mutations.UPDATE_SERVICE, service)
    },

    _ctor(props: Service) {
      const { path, fields } = props

      this.path = path
      this.fields = fields

      this._createFeathersService()
      this.isInitialized = true
    },
  },

  watch: {
    fields() {
      this._saveServiceChanges()
    },
  },
})

/*
  create Service based on structure
*/
export const create = function (
  props: Service,
  fServer: IFeathersServer
): IService {
  const { id, serverId } = props
  const obj = new ObjectClass({
    propsData: {
      id,
      serverId,
      fServer,
    },
  })
  obj._ctor(props)
  return obj
}

export const destroy = function (instance: IService): void {
  instance.$destroy()
}
