export const Events = {
  CANCELLED: '--cancelled--',
}

/*
  Dialog Types
  keys used to request system dialogs
*/
export const DialogType = {
  ADD_EDIT_SERVER: '--add-edit-server-dialog--',
  ADD_SERVICE: '--add-service-dialog--',
  ADD_SERVICE_RECORD: '--add-service-record-dialog--',
  MANAGE_SERVERS: '--manage-servers-dialog--',
  SELECT_SERVICE_FIELDS: '--select-service-fields-dialog--',
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
