/*
  Data Processing Utilities
*/

// Constants & Interfaces
import { PropertyLookupHash, ServiceField } from '@/models/service.interfaces'
import {
  DataRecord,
  FeathersRecord,
} from '@/services/feathers-server.interfaces'

/*
  packPropertyTypeStruct
  get fields struct from Selected Service
  pack structure into key/value format for lookup
*/
export const packPropertyTypeStruct = function (
  fieldsList: ServiceField[]
): PropertyLookupHash {
  const clean: PropertyLookupHash = {}
  fieldsList.forEach(function (field) {
    const { property, type } = field
    clean[property] = type || ''
  })
  return clean
}

/*
  packPropertyTypeStruct
  get fields struct from Selected Service
  pack structure into key/value format for lookup
*/
export const unpackPropertyTypeStruct = function (
  record: PropertyLookupHash
): ServiceField[] {
  const arr: ServiceField[] = []
  Object.entries(record).forEach(function (item) {
    const [property, type] = item
    const str: ServiceField = {
      property,
      type,
      isActive: true,
    }
    arr.push(str)
  })
  return arr
}

/*
 */
export const createFindItemId = function (id: string) {
  return function (record: DataRecord): boolean {
    return record._id === id
  }
}

export const createServiceEventKey = function (
  path: string,
  eName: string
): string {
  return `${path}:${eName}`
}

/*
  remove any Vuejs-related structures
*/
export function cleanVueData(vueReactiveStruct: DataRecord): DataRecord {
  return cloneRecord(vueReactiveStruct)
}

export const cleanFeathersRecord = function (
  record: FeathersRecord
): DataRecord {
  const rec = cloneRecord<DataRecord>(record)
  delete rec._id
  return rec
}

export const cloneFeathersRecord = function (
  record: FeathersRecord
): FeathersRecord {
  return cloneRecord(record) as FeathersRecord
}

export const cloneRecord = function <T>(record: T): T {
  try {
    return JSON.parse(JSON.stringify(record))
  } catch (e) {
    throw new Error('ERROR cloning record')
  }
}

export const validateJsonStr = function (jsonStr: string): boolean {
  try {
    JSON.parse(jsonStr)
    return true
  } catch (e) {
    return false
  }
}

export const getDefaultValueByType = function (
  type: string
): Array<unknown> | boolean | number | Record<string, unknown> | string {
  switch (type) {
    case 'array':
      return []
    case 'boolean':
      return false
    case 'date':
      return Date.now()
    case 'number':
      return 0
    case 'object':
      return {}
    case 'relation':
    case 'string':
    default:
      return ''
  }
}

export const createRepresentativeRecord = function (
  record: DataRecord,
  fieldsList: ServiceField[]
): DataRecord {
  const rec: DataRecord = {}
  const lookup = packPropertyTypeStruct(fieldsList)

  Object.keys(record).forEach(function (key) {
    const type = lookup[key]
    const value = getDefaultValueByType(type)
    rec[key] = value
  })
  return rec
}

export const sanitizeRecordFields = function (
  dataRecord: DataRecord
): DataRecord {
  const clean: DataRecord = {}
  for (const prop in dataRecord) {
    clean[prop] = ''
  }
  return clean
}

export const pJsonStr = function (record: DataRecord): string {
  return JSON.stringify(record, null, '  ')
}

export const jsonStr = function (record: DataRecord): string {
  return JSON.stringify(record)
}
