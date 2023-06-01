<template>
  <el-row :span="24" :gutter="20">
    <el-col :span="6">
      <side-bar />
    </el-col>
    <el-col :span="12">
      <template v-if="!isReady">
        <empty-config :noServers="!haveServers" :noServices="!haveServices" />
      </template>
      <template v-else>
        <template v-if="!haveCurrentService">
          <div style="padding-top: 10px">No Service Selected</div>
        </template>
        <template v-else>
          <service-viewer :serviceInstance="currentServiceInstance" />
        </template>
      </template>
    </el-col>
    <el-col :span="6">
      <template v-if="haveCurrentService && haveCurrentRecordId">
        <record-inspector
          :serviceInstance="currentServiceInstance"
          :recordId="currentRecordId"
        />
      </template>
    </el-col>
  </el-row>
</template>

<script lang="ts">
/*
  HTML Main component

  creates the structure for the application Body
*/
// Libs
import Vue from 'vue'

// Constants & Interfaces
import { IService } from '@/models/service.interfaces'

// Components
import RecordInspector from './RecordInspector.vue'
import ServiceViewer from './ServiceViewer.vue'
import SideBar from './SideBar.vue'
import EmptyConfig from './EmptyConfig.vue'

// Controllers & Services
import AppCtrl from '@/controllers/app-ctrl.model'

/*
  Vuejs Interfaces
*/
interface IProps {
  service: IService | null
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IData {}

interface IComputed {
  currentServiceId: string | null
  currentRecordId: string | null
  currentServiceInstance: IService | null
  haveCurrentService: boolean
  haveCurrentRecordId: boolean
  haveServers: boolean
  haveServices: boolean
  isReady: boolean
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IMethods {}

export default Vue.extend<IData, IMethods, IComputed, IProps>({
  name: 'AppMain',

  components: {
    RecordInspector,
    ServiceViewer,
    SideBar,
    EmptyConfig,
  },

  computed: {
    isReady() {
      const { haveServers, haveServices } = this
      return haveServers && haveServices
    },

    currentServiceId() {
      return AppCtrl.currentServiceId
    },

    currentRecordId() {
      return AppCtrl.currentRecordId
    },

    currentServiceInstance(): IService | null {
      const { serviceInstanceList } = AppCtrl
      const { currentServiceId } = this

      const instance = serviceInstanceList.find(
        (item) => item.id === currentServiceId
      )

      return instance || null
    },

    haveCurrentService() {
      const { currentServiceInstance } = this
      return currentServiceInstance !== null
    },

    haveCurrentRecordId() {
      const { currentRecordId } = this
      return currentRecordId !== null
    },

    haveServices() {
      return AppCtrl.serviceInstanceList.length > 0
    },

    haveServers() {
      return AppCtrl.serversList.length > 0
    },
  },
})
</script>
