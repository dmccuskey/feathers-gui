<template>
  <div>
    <add-edit-server-dialog
      v-if="showAddEditServerDialog"
      :data="displayDialogData"
    />
    <add-service-dialog v-if="showAddServiceDialog" :data="displayDialogData" />
    <add-service-record-dialog
      v-if="showAddServiceRecordDialog"
      :data="displayDialogData"
    />
    <manage-servers-dialog
      v-if="showManageServersDialog"
      :data="displayDialogData"
    />
    <select-service-fields-dialog
      v-if="showSelectServiceFieldsDialog"
      :data="displayDialogData"
    />
  </div>
</template>

<script lang="ts">
// Libs
import Vue from 'vue'

// Constants / Interfaces
import { DialogEvent, ShowDialogProps } from '@/controllers/app-ctrl.interfaces'
import { DialogType } from '@/controllers/dialog.constants'

// Components
import AddEditServerDialog from './dialogs/AddEditServerDialog.vue'
import AddServiceDialog from './dialogs/AddServiceDialog.vue'
import AddServiceRecordDialog from './dialogs/AddServiceRecordDialog.vue'
import ManageServersDialog from './dialogs/ManageServersDialog.vue'
import SelectServiceFieldsDialog from './dialogs/SelectServiceFieldsDialog.vue'

// Controllers & Services
import AppCtrl from '@/controllers/app-ctrl.model'

interface DialogQueueItem {
  id: number
  data: ShowDialogProps
}

interface DialogQueueHash {
  [key: string]: DialogQueueItem
}

/*
  Vuejs Interfaces
*/
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IProps {}

interface IData {
  dialogRequests: DialogQueueHash
}

interface IComputed {
  dialogQueue: DialogQueueItem[]
  nextDialogItem: DialogQueueItem | null

  displayDialogType: string
  displayDialogData: ShowDialogProps | null

  showAddEditServerDialog: boolean
  showAddServiceDialog: boolean
  showAddServiceRecordDialog: boolean
  showManageServersDialog: boolean
  showSelectServiceFieldsDialog: boolean
}

interface IMethods {
  _handleShowDialogEvent(evt: DialogEvent): void
}

export default Vue.extend<IData, IMethods, IComputed, IProps>({
  components: {
    AddEditServerDialog,
    AddServiceDialog,
    AddServiceRecordDialog,
    ManageServersDialog,
    SelectServiceFieldsDialog,
  },

  data() {
    return {
      dialogRequests: {},
    }
  },

  computed: {
    /*
      queue and data for dialogs
    */

    dialogQueue() {
      const { dialogRequests } = this
      return Object.values(dialogRequests).sort((a, b) => b.id - a.id)
    },

    nextDialogItem(): DialogQueueItem | null {
      const { dialogQueue } = this
      return dialogQueue.length ? dialogQueue[0] : null
    },

    displayDialogType(): string {
      const { nextDialogItem } = this

      if (!nextDialogItem) return ''
      const { data } = nextDialogItem
      return data.type
    },

    displayDialogData(): ShowDialogProps | null {
      const { nextDialogItem } = this
      if (!nextDialogItem) return null
      return nextDialogItem.data
    },

    /*
      props to control the display of individual dialogs
    */

    showAddEditServerDialog(): boolean {
      const { displayDialogType } = this
      return displayDialogType === DialogType.ADD_EDIT_SERVER
    },

    showAddServiceDialog(): boolean {
      const { displayDialogType } = this
      return displayDialogType === DialogType.ADD_SERVICE
    },

    showAddServiceRecordDialog(): boolean {
      const { displayDialogType } = this
      return displayDialogType === DialogType.ADD_SERVICE_RECORD
    },

    showManageServersDialog(): boolean {
      const { displayDialogType } = this
      return displayDialogType === DialogType.MANAGE_SERVERS
    },

    showSelectServiceFieldsDialog(): boolean {
      const { displayDialogType } = this
      return displayDialogType === DialogType.SELECT_SERVICE_FIELDS
    },
  },

  methods: {
    _handleShowDialogEvent(evt: DialogEvent) {
      const { dialogRequests } = this
      const { data } = evt
      const { promise } = data.deferred

      // add to queue
      const id = Date.now()
      const qI: DialogQueueItem = {
        id,
        data,
      }
      this.$set(dialogRequests, id, qI)

      const handleCatch = () => {
        // pass
      }

      // setup dialog return handling
      promise.catch(handleCatch).finally(() => {
        this.$delete(dialogRequests, id)
      })
    },
  },

  created() {
    AppCtrl.addDialogEventListener(this._handleShowDialogEvent)
  },
})
</script>
