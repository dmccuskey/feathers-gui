import { Server, ServerProps } from '@/models/server.interfaces'
import { IService } from '@/models/service.interfaces'
import { DataRecord } from '@/services/feathers-server.interfaces'

/*
  Add Service Dialog Support
*/

export interface AddServiceDialogProps {
  current: string | null // null if new, id if edit
  existing: string[]
}

export interface SelectServiceFieldsDialogProps {
  recordTmpl: DataRecord
  serviceInstance: IService
}

export interface AddEditServerDialogProps {
  server: Server | null
}

export interface AddEditServerDialogResultProps {
  id: string | null
  props: ServerProps
}

export interface AddServiceRecordDialogProps {
  recordTmpl: DataRecord
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ManageServersDialogProps {}
