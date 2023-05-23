<template>
  <div id="side-bar">
    <div>Services</div>

    <template v-if="!haveServer">
      <div>No Services</div>
    </template>
    <template v-else>
      <table class="service-table">
        <col width="*" />
        <col width="60" />
        <tr v-for="rec in serviceDisplayItems" :key="rec.path">
          <td>
            <el-tooltip
              effect="dark"
              :content="rec.isError"
              placement="right"
              v-if="rec.isError"
            >
              <el-button
                class="btn-srvc"
                type="warning"
                plain
                size="medium"
                icon="el-icon-warning"
              >
                {{ rec.path }}
              </el-button>
            </el-tooltip>
            <el-button
              class="btn-srvc"
              type="info"
              size="medium"
              @click="_handleSelectService(rec)"
              v-else
            >
              {{ rec.path }}
            </el-button>
          </td>
          <td>
            <el-button
              type="danger"
              plain
              size="small"
              icon="el-icon-delete"
              circle
              @click="_handleRemoveService(rec)"
            />
          </td>
        </tr>
      </table>

      <hr />

      <el-button
        type="success"
        plain
        size="small"
        icon="el-icon-plus"
        @click="_handleAddService"
      >
        Add Service Path
      </el-button>
    </template>
  </div>
</template>

<script lang="ts">
/*
  Side Bar component

  displays the current services, allows additions of new ones
*/
// Libs
import Vue from 'vue'

// Constants / Interfaces
import { IService } from '@/models/service.interfaces'
import { IServer } from '@/models/server.interfaces'
import { AddServiceDialogProps } from '@/controllers/dialog.interfaces'

// Components
import store from '@/store'

// Controllers & Services
import AppCtrl from '@/controllers/app-ctrl.model'

interface ServiceDisplay {
  id: string
  path: string
  isError: string | null
}

const serviceDisplaySort = function (a: ServiceDisplay, b: ServiceDisplay) {
  const aPath = a.path.toLowerCase()
  const bPath = b.path.toLowerCase()
  if (aPath < bPath) {
    return -1
  }
  if (aPath > bPath) {
    return 1
  }
  return 0
}

/*
  Vuejs Interfaces
*/
// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IProps {}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IData {}

interface IComputed {
  currentServerId: string | null
  currentServerInstance: IServer | null
  haveServer: boolean
  serviceDisplayItems: ServiceDisplay[]
  servicePaths: string[]
}

interface IMethods {
  _handleAddService(): void
  _handleRemoveService(service: ServiceDisplay): void
  _handleSelectService(service: ServiceDisplay): void
}

export default Vue.extend<IData, IMethods, IComputed, IProps>({
  name: 'SideBar',

  computed: {
    currentServerId() {
      return store.state.currentServerId
    },

    currentServerInstance() {
      return store.state.serverInstance
    },

    haveServer() {
      return this.currentServerInstance !== null
    },

    serviceDisplayItems() {
      const { serviceInstances } = store.state
      return Object.values(serviceInstances)
        .map((service: IService) => {
          const { isError, path, id } = service
          return {
            id,
            path,
            isError,
          }
        })
        .sort(serviceDisplaySort)
    },

    servicePaths() {
      const { serviceInstances } = store.state
      return Object.values(serviceInstances).map(
        (service: IService) => service.path
      )
    },
  },

  methods: {
    _handleAddService() {
      const { servicePaths } = this
      const props: AddServiceDialogProps = {
        current: null,
        existing: servicePaths,
      }
      void AppCtrl.showAddServiceDialog(props)
    },

    _handleRemoveService(service: ServiceDisplay) {
      AppCtrl.removeService(service.id)
    },

    _handleSelectService(service: ServiceDisplay) {
      AppCtrl.setCurrentServiceId(service.id)
    },
  },
})
</script>

<style lang="scss" scoped>
#side-bar {
  .btn-srvc {
    width: 100%;
    text-align: left;
    font-family: courier;
  }

  .service-table {
    width: 100%;
    padding-top: 10px;
  }
}
</style>
