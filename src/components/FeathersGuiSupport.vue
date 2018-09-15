<template>
<div>
  <add-edit-server-dialog
    v-if="showAddEditServerDialog"
    :data="displayDialogData"
    :success="displayDialogSuccess"
    :cancel="displayDialogCancel"
  />
  <add-service-dialog
    v-if="showAddServiceDialog"
    :success="displayDialogSuccess"
    :cancel="displayDialogCancel"
  />
  <add-service-record-dialog
    v-if="showAddServiceRecordDialog"
    :data="displayDialogData"
    :success="displayDialogSuccess"
    :cancel="displayDialogCancel"
  />
  <manage-servers-dialog
    v-if="showManageServersDialog"
    :success="displayDialogSuccess"
    :cancel="displayDialogCancel"
  />
  <select-service-fields-dialog
    v-if="showSelectServiceFieldsDialog"
    :data="displayDialogData"
    :success="displayDialogSuccess"
    :cancel="displayDialogCancel"
  />
</div>
</template>

<script lang="ts">
// Libs
import Vue from 'vue'

// Constants / Interfaces
import { DialogTypes } from '@/app-constants'
import { DisplayDialog } from '@/interfaces'

// Components
import FGuiCtrl from '@/controllers/feathers-gui-ctrl'
import AddEditServerDialog from './dialogs/AddEditServerDialog.vue'
import AddServiceDialog from './dialogs/AddServiceDialog.vue'
import AddServiceRecordDialog from './dialogs/AddServiceRecordDialog.vue'
import ManageServersDialog from './dialogs/ManageServersDialog.vue'
import SelectServiceFieldsDialog from './dialogs/SelectServiceFieldsDialog.vue'

export default Vue.extend({

  components: {
    AddEditServerDialog,
    AddServiceDialog,
    AddServiceRecordDialog,
    ManageServersDialog,
    SelectServiceFieldsDialog,
  },

  computed: {

    displayDialog() : DisplayDialog | null {
      const rec = this.$store.getters['displayDialog']
      return rec
    },

    displayDialogType() : string {
      const { displayDialog } = this
      return (displayDialog) ? displayDialog.type : ''
    },

    displayDialogData() : any {
      const { displayDialog } = this
      return displayDialog && displayDialog.data
    },

    displayDialogSuccess() : Function | null {
      const { displayDialog } = this
      return (displayDialog && displayDialog.success) ? displayDialog.success : null
    },

    displayDialogCancel() : Function | null {
      const { displayDialog } = this
      return (displayDialog && displayDialog.cancel) ? displayDialog.cancel : null
    },

    showAddEditServerDialog() : boolean {
      const { displayDialogType } = this
      return (displayDialogType === DialogTypes.ADD_EDIT_SERVER)
    },

    showAddServiceDialog() : boolean {
      const { displayDialogType } = this
      return (displayDialogType === DialogTypes.ADD_SERVICE)
    },

    showAddServiceRecordDialog() : boolean {
      const { displayDialogType } = this
      return (displayDialogType === DialogTypes.ADD_SERVICE_RECORD)
    },

    showManageServersDialog() : boolean {
      const { displayDialogType } = this
      return (displayDialogType === DialogTypes.MANAGE_SERVERS)
    },

    showSelectServiceFieldsDialog() : boolean {
      const { displayDialogType } = this
      return (displayDialogType === DialogTypes.SELECT_SERVICE_FIELDS)
    },

  },

})
</script>
