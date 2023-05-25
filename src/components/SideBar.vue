<template>
  <div id="side-bar">
    <div class="server-select-row">
      <el-select
        size="large"
        placeholder="Select Server"
        no-data-text="No Servers to Display"
        @change="_handleServerSelect"
        v-model="selectedServerId"
      >
        <el-option
          v-for="item in selectOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <el-button
        class="select-btn"
        icon="el-icon-setting"
        circle
        @click="_handleShowSettings"
      />
    </div>

    <div>Services</div>

    <template v-if="!haveServer">
      <div>No Services</div>
    </template>
    <template v-else>
      <template v-for="rec in serviceDisplayItems">
        <div class="service-row" :key="rec.path">
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
          <el-button
            type="danger"
            plain
            size="small"
            icon="el-icon-delete"
            circle
            @click="_handleRemoveService(rec)"
          />
        </div>
      </template>

      <hr />

      <el-button
        type="success"
        plain
        size="small"
        icon="el-icon-plus"
        @click="_handleAddService"
      >
        Add Service
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
import { IServer, Server, ServerHash } from '@/models/server.interfaces'
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

interface SelectOption {
  value: string
  label: string
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

interface IData {
  selectedServerId: string
}

interface IComputed {
  serverConfigs: ServerHash
  currentServerId: string | null
  currentServerInstance: IServer | null
  haveServer: boolean
  serviceDisplayItems: ServiceDisplay[]
  servicePaths: string[]
  selectOptions: SelectOption[]
  serversList: Server[]
}

interface IMethods {
  // servers
  _handleServerSelect(serverId: string): void
  // services
  _handleAddService(): void
  _handleRemoveService(service: ServiceDisplay): void
  _handleSelectService(service: ServiceDisplay): void
  _handleShowSettings(): void
}

export default Vue.extend<IData, IMethods, IComputed, IProps>({
  name: 'SideBar',

  data() {
    return {
      selectedServerId: '',
    }
  },

  computed: {
    serverConfigs() {
      return AppCtrl.serverConfigs
    },

    serversList() {
      return AppCtrl.serversList
    },

    selectOptions() {
      const { serversList } = this

      return serversList.map(function (item) {
        const { id, url, name } = item
        const label = name !== '' ? `${name} (${url})` : url
        return {
          value: id,
          label,
        }
      })
    },

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
    // servers
    _handleServerSelect(serverId: string) {
      const { serverConfigs } = this

      const serverConfig = serverConfigs[serverId]
      AppCtrl.activateServer(serverConfig)
    },

    _handleShowSettings() {
      void AppCtrl.showManageServersDialog()
    },

    // services
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

  mounted() {
    const { currentServerId } = this
    this.selectedServerId = currentServerId || ''
  },
})
</script>

<style lang="scss" scoped>
$item-xy: 20px;
$item-lr: 10px;
$item-margin: 10px;
$item-max-width: 300px;
$item-min-width: 200px;

#side-bar {
  padding: $item-xy $item-lr;

  .server-select-row {
    display: flex;
    flex-direction: row;
    justify-content: left;
    align-items: center;

    .title {
      margin-right: $item-margin;
    }

    .el-select {
      min-width: $item-min-width;
      max-width: $item-max-width;
      width: 100%;
    }

    .select-btn {
      margin-left: $item-margin;
    }
  }

  .service-row {
    display: flex;
    flex-direction: row;
    justify-content: left;
    align-items: center;
    padding: 5px 0 2px 0;
    .btn-srvc {
      min-width: $item-min-width;
      max-width: $item-max-width;
      width: 100%;
      text-align: left;
      font-family: courier;
    }
  }
}
</style>
