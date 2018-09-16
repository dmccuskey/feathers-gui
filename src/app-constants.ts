/*
  Application Constants
*/

/*
  Dialog Types
  keys used to request system dialogs
*/
export const DialogTypes = {
  ADD_EDIT_SERVER: '--add-edit-server-dialog--',
  ADD_SERVICE: '--add-service-dialog--',
  ADD_SERVICE_RECORD: '--add-service-record-dialog--',
  MANAGE_SERVERS: '--manage-servers-dialog--',
  SELECT_SERVICE_FIELDS: '--select-service-fields-dialog--',
}

/*
  Feathers Events
  names of Feathers record modification events
*/
export const FeathersEvents = {
  CREATED: 'created',
  PATCHED: 'patched',
  REMOVED: 'removed',
  UPDATED: 'updated',
}

/*
  Property Types
  property types which can be displayed in UI
*/
export const PropertyTypes = [
  { label: 'String', value: 'string' },
  { label: 'Number', value: 'number' },
  { label: 'Boolean', value: 'boolean' },
  { label: 'Date', value: 'date' },
  { label: 'Array', value: 'array' },
  { label: 'Object', value: 'object' },
  { label: 'Relation', value: 'relation' },
]

export const ServerConnectionEvents = {
  IS_CONNECTED: '--is-connected-event--',
  IS_INITIALIZED: '--is-initialized-event--',
}
