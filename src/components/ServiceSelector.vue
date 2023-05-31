<template>
  <div id="service-selector">
    <div class="title">Services</div>
    <template v-if="!haveServices">
      <p class="centered notice">
        You have no Services configured for this server.
      </p>
      <p class="centered">Add your first Service.</p>
    </template>
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

    <div class="centered">
      <el-button
        type="success"
        plain
        class="centered"
        size="small"
        icon="el-icon-plus"
        @click="_handleAddService"
      >
        Add Service
      </el-button>
    </div>
  </div>
</template>

<script lang="ts">
/*
  Server Selection component
  displays configured servers, allows selection of current server
*/

// Libs
import Vue from 'vue'

// Constants & Interfaces
import { IService } from '@/models/service.interfaces'
import { AddServiceDialogProps } from '@/controllers/dialog.interfaces'

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
  serviceInstanceList: IService[]
  haveServices: boolean
  serviceDisplayItems: ServiceDisplay[]
  servicePaths: string[]
}

interface IMethods {
  _handleAddService(): void
  _handleRemoveService(service: ServiceDisplay): void
  _handleSelectService(service: ServiceDisplay): void
}

export default Vue.extend<IData, IMethods, IComputed, IProps>({
  name: 'ServerSelector',

  computed: {
    serviceInstanceList() {
      return AppCtrl.serviceInstanceList
    },

    haveServices() {
      const { serviceInstanceList } = this
      return serviceInstanceList.length > 0
    },

    serviceDisplayItems() {
      const { serviceInstanceList } = this

      return serviceInstanceList
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
      const { serviceInstanceList } = this
      return serviceInstanceList.map((service: IService) => service.path)
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
$item-xy: 20px;
$item-lr: 10px;
$item-margin: 10px;
$item-max-width: 300px;
$item-min-width: 200px;

#service-selector {
  .title {
    font-weight: bold;
    padding: 30px 0 5px 0;
  }

  .centered {
    text-align: center;
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
