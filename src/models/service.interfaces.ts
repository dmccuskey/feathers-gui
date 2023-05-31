// Constants & Interfaces
import {
  DataRecord,
  FeathersRecord,
  FeathersRecordHash,
  IFeathersServer,
} from '@/services/feathers-server.interfaces'
import { IFeathersService } from '@/services/feathers-service.interfaces'

export interface PropertyLookupHash {
  [key: string]: string
}

// type values 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array'
export interface ServiceField {
  property: string
  type: string
  isActive: boolean
}

export interface ServiceProps {
  serverId: string
  path: string
  fields: ServiceField[]
}
export interface Service extends ServiceProps {
  id: string
}

export interface IServiceHash {
  [key: string]: IService
}

export interface ServiceHash {
  [key: string]: Service
}

/*
  Vuejs interfaces
*/

export interface IProps {
  id: string
  serverId: string
  fServer: IFeathersServer
}

export interface IData {
  debug: debug.IDebugger | null
  fService: IFeathersService | null
  data: FeathersRecordHash
  fields: ServiceField[]
  path: string
  recordTemplate: FeathersRecord
  selectedRecords: FeathersRecord[]
  isInitialized: boolean
}

export interface IComputed {
  isError: string | null
  records: FeathersRecord[]
}

export interface GetRecordTemplateProps {
  count?: number
  cleanId?: boolean
}

export interface IMethods {
  // CRUD methods
  createRecord<T = DataRecord, R = FeathersRecord>(
    record: Partial<T>
  ): Promise<R | R[]>
  updateRecord(id: string, record: DataRecord): Promise<FeathersRecord>
  removeSelectedRecords(): void //Promise<(R | R[])[]>

  getRecordTemplate(props: GetRecordTemplateProps): DataRecord | FeathersRecord
  getRecordById(id: string): FeathersRecord | null
  updateFields(packedfields: PropertyLookupHash): void
  // fservice CRUD event handlers
  _handleLoadedEvent(records: FeathersRecord[]): void
  _handleCreatedEvent(record: FeathersRecord): void
  _handleRemovedEvent(record: FeathersRecord): void
  _handleUpdatedPatchedEvent(record: FeathersRecord): void

  _createFeathersService(): void
  _destroyFeathersService(): void

  _updateRecordTemplate(record: FeathersRecord): void
  _saveServiceChanges(): void
  _ctor(props: Service): void
  _dtor(): void
}

export type IService = Vue & IData & IMethods & IComputed & IProps
