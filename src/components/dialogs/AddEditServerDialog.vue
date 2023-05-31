<template>
  <el-dialog id="add-edit-server-dialog" :title="dialogTitle" :visible="true">
    <el-form v-model="serverForm">
      <el-form-item label="Server Name:">
        <el-input placeholder="my awesome server" v-model="serverForm.name" />
      </el-form-item>
      <div class="notice" v-if="usingFeathersGui">
        You are using Feathers GUI online, so your Feathersjs server must be
        configured to use secure HTTPS.<br />
        <a href="https://feathersgui.dev">See the online docs</a> for help.
      </div>
      <el-form-item label="Server Url:">
        <el-input
          :placeholder="serverUrlPlaceholder"
          v-model="serverForm.url"
        />
      </el-form-item>

      <el-form-item label="Authentication:">
        <el-select size="small" v-model="serverForm.selectedAuth">
          <el-option label="none" value="none" />
          <el-option label="password" value="local" />
        </el-select>

        <template v-if="serverForm.selectedAuth === 'local'">
          <el-input placeholder="user key" v-model="serverForm.uKey" />
          <el-input placeholder="user value" v-model="serverForm.uValue" />
          <el-input placeholder="password key" v-model="serverForm.pKey" />
          <el-input placeholder="password value" v-model="serverForm.pValue" />
        </template>
      </el-form-item>
    </el-form>
    <span slot="footer" class="dialog-footer">
      <el-button @click="_handleCancelDialog"> Cancel </el-button>
      <el-button
        type="primary"
        @click="_handleConfirmDialog"
        :disabled="!canConfirmDialog"
      >
        {{ confirmButtonText }}
      </el-button>
    </span>
  </el-dialog>
</template>

<script lang="ts">
// Libs
import Vue from 'vue'
import { Deferred } from 'ts-deferred'

// Constants & Interfaces
import { ShowDialogProps } from '@/controllers/app-ctrl.interfaces'
import {
  AddEditServerDialogProps,
  AddEditServerDialogResultProps,
} from '@/controllers/dialog.interfaces'
import { LocalAuthStruct, Server } from '@/models/server.interfaces'
import { Events } from '@/controllers/dialog.constants'

// Controllers & Services
import AppCtrl from '@/controllers/app-ctrl.model'

/*
  Vuejs Interfaces
*/
export interface IProps {
  data: ShowDialogProps
}

export interface IData {
  serverForm: {
    id: string | null
    name: string
    url: string
    selectedAuth: string
    uKey: string
    uValue: string
    pKey: string
    pValue: string
  }
}

export interface IComputed {
  props: AddEditServerDialogProps
  deferred: Deferred<AddEditServerDialogResultProps>
  serverRecord: Server | null
  serverId: string | null
  haveServerId: boolean

  isEditAction: boolean
  confirmButtonText: string
  canConfirmDialog: boolean
  serverUrlPlaceholder: string
  usingFeathersGui: boolean
  dialogTitle: string
}

export interface IMethods {
  _handleCancelDialog(): void
  _handleConfirmDialog(): void
}

export default Vue.extend<IData, IMethods, IComputed, IProps>({
  name: 'add-edit-server-dialog',

  props: {
    data: {
      type: Object as () => ShowDialogProps,
      required: true,
    },
  },

  data() {
    return {
      serverForm: {
        id: null,
        name: '',
        url: '',
        selectedAuth: 'none',
        uKey: '',
        uValue: '',
        pKey: '',
        pValue: '',
      },
    }
  },

  computed: {
    usingFeathersGui() {
      return AppCtrl.usingFeathersGui
    },

    serverUrlPlaceholder() {
      const { usingFeathersGui } = this
      return usingFeathersGui
        ? 'https://localhost:3030'
        : 'http://localhost:3030'
    },

    props() {
      const { data } = this
      return data.props as AddEditServerDialogProps
    },

    deferred() {
      const { data } = this
      return data.deferred
    },

    serverRecord() {
      const { props } = this
      return props.server
    },

    serverId(): string | null {
      const { serverRecord } = this
      return serverRecord ? serverRecord.id : null
    },

    haveServerId(): boolean {
      const { serverId } = this
      return serverId != null
    },

    canConfirmDialog() {
      return this.serverForm.url !== ''
    },

    isEditAction(): boolean {
      return this.haveServerId
    },

    confirmButtonText(): string {
      const { isEditAction } = this
      return isEditAction ? 'Update' : 'Create'
    },

    dialogTitle(): string {
      const { isEditAction } = this
      return isEditAction ? 'Update Server' : 'Add Server'
    },
  },

  methods: {
    _handleCancelDialog() {
      this.deferred.reject(Events.CANCELLED)
    },

    _handleConfirmDialog() {
      const { deferred, serverForm } = this
      const { id, url, selectedAuth, name } = serverForm

      let authentication: LocalAuthStruct | null = null
      if (selectedAuth === 'local') {
        const { pKey, pValue, uKey, uValue } = serverForm
        authentication = {
          strategy: 'local',
          pKey,
          pValue,
          uKey,
          uValue,
        }
      }

      const result: AddEditServerDialogResultProps = {
        id,
        props: {
          url,
          name,
          authentication,
        },
      }
      deferred.resolve(result)
    },
  },

  created() {
    const { serverRecord, serverForm } = this

    if (!serverRecord) return

    // save servdr values
    const { url, id, name, authentication } = serverRecord
    serverForm.url = url
    serverForm.id = id
    serverForm.name = name

    if (authentication == null) return

    // save authentication values
    const { uKey, uValue, pKey, pValue } = authentication
    serverForm.selectedAuth = 'local'
    serverForm.uKey = uKey
    serverForm.uValue = uValue
    serverForm.pKey = pKey
    serverForm.pValue = pValue
  },
})
</script>
