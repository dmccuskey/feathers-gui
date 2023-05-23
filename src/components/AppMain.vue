<template>
  <el-row :span="24" :gutter="20">
    <el-col :span="6">
      <side-bar />
    </el-col>
    <el-col :span="12">
      <template v-if="haveCurrentService">
        <service-viewer :serviceInstance="currentServiceInstance" />
      </template>
      <template v-else>
        <div style="padding-top: 10px">No Service Selected</div>
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
import store from '@/store'

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
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IMethods {}

export default Vue.extend<IData, IMethods, IComputed, IProps>({
  name: 'AppMain',

  components: {
    RecordInspector,
    ServiceViewer,
    SideBar,
  },

  computed: {
    currentServiceId() {
      return store.state.currentServiceId
    },

    currentRecordId() {
      return store.state.currentRecordId
    },

    currentServiceInstance(): IService | null {
      const { serviceInstances } = store.state
      const { currentServiceId } = this

      const instance = Object.values(serviceInstances).find(
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
  },
})
</script>
