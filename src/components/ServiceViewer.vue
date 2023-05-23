<template>
  <div>
    <div class="section-title">Service Viewer</div>

    <div style="padding-top: 10px">
      Viewing: <span class="selected-path"> {{ serviceInstance.path }} </span>
      <service-actions :serviceInstance="serviceInstance" />
      <records-viewer :serviceInstance="serviceInstance" />
    </div>
  </div>
</template>

<script lang="ts">
// Libs
import Vue from 'vue'

// Components
import ServiceActions from './ServiceActions.vue'
import RecordsViewer from './RecordsViewer.vue'
import { IService } from '@/models/service.interfaces'

/*
  Vuejs Interfaces
*/
interface IProps {
  serviceInstance: IService
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IData {}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IComputed {}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface IMethods {}

export default Vue.extend<IData, IMethods, IComputed, IProps>({
  name: 'ServiceViewer',

  props: {
    serviceInstance: {
      type: Object as () => IService,
      default: null,
    },
  },

  components: {
    RecordsViewer,
    ServiceActions,
  },
})
</script>
