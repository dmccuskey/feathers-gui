// Constants & Interfaces
import { Server, ServerProps } from '@/models/server.interfaces'
import {
  Service,
  ServiceField,
  ServiceProps,
} from '@/models/service.interfaces'

/*
  create unique ids for Server and Service structs
 */
export const generateUniqueId = function (): string {
  return Math.round(Math.random() * 36 ** 12).toString(36)
}

/*
 */
export const createServerStruct = function (props: ServerProps): Server {
  const { url, name, authentication } = props

  const id = generateUniqueId()
  return {
    id,
    name,
    url,
    authentication,
  }
}

export const createServiceStruct = function (props: ServiceProps): Service {
  const { serverId, path, fields } = props

  const id = generateUniqueId()
  const defaultField: ServiceField = {
    property: '_id',
    type: 'string',
    isActive: true,
  }
  fields.push(defaultField)
  return {
    id,
    serverId,
    path,
    fields,
  }
}
