<template>
<el-row :span="24" :gutter="20">
  <el-col :span="6">
    <side-bar
      :serverConnection="currentServerConnection"
    />
  </el-col>
  <el-col :span="12">
    <service-viewer
      :serverConnection="currentServerConnection"
      :serviceId="currentServiceId"
    />
  </el-col>
  <el-col :span="6">
  <record-inspector
    :serverConnection="currentServerConnection"
    :serviceId="currentServiceId"
    :recordId="currentRecordId"
  />
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

// Components
import RecordInspector from './RecordInspector.vue'
import ServiceViewer from './ServiceViewer.vue'
import SideBar from './SideBar.vue'
import { IServerConnection } from '@/interfaces'

export default Vue.extend({

  name: 'AppMain',

  components: {
    RecordInspector,
    ServiceViewer,
    SideBar,
  },

  computed: {

    currentServerId() : string {
      return this.$store.getters['currentServerId']
    },

    currentServiceId() : string {
      return this.$store.getters['currentServiceId']
    },

    currentRecordId() : string {
      return this.$store.getters['currentRecordId']
    },

    currentServerConnection() : IServerConnection | null {
      const { currentServerId } = this
      const getSrvrConnByIdFunc = this.$store.getters['getServerConnectionByServerId']
      return getSrvrConnByIdFunc(currentServerId)
    },

  },
})
</script>
