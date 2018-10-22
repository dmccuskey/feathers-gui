/*
  Data Processing Utilities
*/

// Constants / Interfaces
import {
  DataRecord,
  FeathersRecord,
  PropertyLookupHash,
  ServerStruct,
  ServiceFieldsStruct,
  ServiceStruct
} from '@/interfaces'

/*
*/
export const generateUniqueId = function() {
  return Math.round((Math.random() * 36 ** 12)).toString(36)
}

/*
*/
interface CreateServerStructProps {
  url: string
  isActive: boolean
  // authentication: null
}
export const createServerStruct = function(props: CreateServerStructProps) : ServerStruct {
  const { url, isActive } = props

  const id = generateUniqueId()
  return {
    id,
    url,
    isActive,
    authentication: null,
  }
}

/*
*/
interface CreateServiceStructProps {
  path: string
  serverId: string
}
export const createServiceStruct = function(props: CreateServiceStructProps) : ServiceStruct {
  const { path, serverId } = props

  const id = generateUniqueId()
  const fields = [ // defaults
    {
      property: '_id',
      type: 'string',
    },
  ]
  return {
    id,
    path,
    serverId,
    fields,
    filters: [],
  }
}

/*
  packPropertyTypeStruct
  get fields struct from Selected Service
  pack structure into key/value format for lookup
*/
export const packPropertyTypeStruct = function(fieldsList:ServiceFieldsStruct[]) : PropertyLookupHash {
  const clean:PropertyLookupHash = {}
  fieldsList.forEach(function(field) {
    const { property, type } = field
    clean[ property ] = type || ''
  })
  return clean
}

/*
  packPropertyTypeStruct
  get fields struct from Selected Service
  pack structure into key/value format for lookup
*/
export const unpackPropertyTypeStruct = function(record: PropertyLookupHash) : ServiceFieldsStruct[] {
  const arr: ServiceFieldsStruct[] = []
  Object.entries(record).forEach(function(item) {
    const [property, type] = item
    const str: ServiceFieldsStruct = {
      property,
      type,
    }
    arr.push(str)
  })
  return arr
}

/*
*/
export const createFindItemId = function(id:string) {
  return function(record:DataRecord) {
    return (record._id === id)
  }
}

export const createServiceEventKey = function(path:string, eName:string) {
  return `${path}:${eName}`
}

/*
  remove any Vuejs-related structures
*/
export function cleanVueData(vueReactiveStruct:DataRecord) : DataRecord {
  return cloneRecord(vueReactiveStruct)
}

export const cleanFeathersRecord = function(record:FeathersRecord) : DataRecord {
  const rec = cloneRecord(record)
  delete rec._id
  return rec
}

export const cloneFeathersRecord = function(record:FeathersRecord) : FeathersRecord {
  return cloneRecord(record) as FeathersRecord
}

export const cloneRecord = function(record:DataRecord) : DataRecord {
  try {
    return JSON.parse(JSON.stringify(record))
  } catch (e) {
    throw new Error('ERROR cloning record')
  }
}

export const validateJsonStr = function(jsonStr:string) : boolean {
  try {
    const j = JSON.parse(jsonStr)
    return true
  } catch (e) {
    return false
  }
}

export const getDefaultValueByType = function(type:string) : any {
  switch (type) {
    case 'number':
      return 0
    case 'array':
      return []
    case 'boolean':
      return false
    case 'object':
      return {}
    case 'date':
      return Date.now()
    case 'relation':
    case 'string':
    default:
      return ''
  }
}

export const createRepresentativeRecord = function(record:DataRecord, fieldsList: ServiceFieldsStruct[]) : any {
  const rec: DataRecord = {}
  const lookup = packPropertyTypeStruct(fieldsList)

  Object.keys(record).forEach(function(key) {
    const type = lookup[key]
    const value = getDefaultValueByType(type)
    rec[key] = value
  })
  return rec
}

export const sanitizeRecordFields = function(dataRecord: DataRecord) : DataRecord {
  const clean: DataRecord = {}
  for (let prop in dataRecord) {
    clean[ prop ] = ''
  }
  return clean
}

export const pJsonStr = function(record: DataRecord) {
  return JSON.stringify(record, null, '\t')
}

export const jsonStr = function(record: DataRecord) {
  return JSON.stringify(record)
}
