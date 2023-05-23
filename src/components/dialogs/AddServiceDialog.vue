<template>
  <el-dialog id="add-service-dialog" title="Add a New Service" :visible="true">
    <el-form v-model="addServiceForm">
      <el-form-item label="Enter Service Path:">
        <el-input v-model="addServiceForm.path" />
      </el-form-item>
    </el-form>
    <div v-if="!isPathValid" class="text-error">
      That service path already exists !
    </div>
    <span slot="footer" class="dialog-footer">
      <el-button @click="_handleCancelDialog"> Cancel </el-button>
      <el-button
        type="primary"
        :disabled="!isPathValid"
        @click="_handleConfirmDialog"
      >
        Save
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
import { AddServiceDialogProps } from '@/controllers/dialog.interfaces'
import { Events } from '@/controllers/dialog.constants'

/*
  Vuejs Interfaces
*/
export interface IProps {
  data: ShowDialogProps
}

export interface IData {
  addServiceForm: { path: string }
}
export interface IComputed {
  props: AddServiceDialogProps
  deferred: Deferred<string>
  isPathValid: boolean
  path: string
}

export interface IMethods {
  _handleCancelDialog(): void
  _handleConfirmDialog(): void
}

export default Vue.extend<IData, IMethods, IComputed, IProps>({
  props: {
    data: {
      type: Object as () => ShowDialogProps,
      required: true,
    },
  },

  data() {
    return {
      addServiceForm: {
        path: '',
      },
    }
  },

  computed: {
    props() {
      const { data } = this
      return data.props as AddServiceDialogProps
    },

    deferred() {
      const { data } = this
      return data.deferred
    },

    isPathValid(): boolean {
      const { props, addServiceForm } = this
      const { existing } = props

      const idx = existing.findIndex((path) => path === addServiceForm.path)

      return idx === -1
    },

    path(): string {
      const { addServiceForm } = this
      return addServiceForm.path
    },
  },

  methods: {
    _handleCancelDialog() {
      this.deferred.reject(Events.CANCELLED)
    },

    _handleConfirmDialog() {
      const { deferred, addServiceForm } = this
      deferred.resolve(addServiceForm.path)
    },
  },
})
</script>

<style lang="scss" scoped>
#add-service-dialog {
  .text-error {
    color: red;
    margin: 10px 0 5px;
  }
}
</style>
