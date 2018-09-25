<template>
<div>
  <div class="section-title">Service Viewer</div>

  <div style="padding-top:10px"
    v-if="!_hasSelectedService"
  >
    No Service Selected
  </div>
  <div style="padding-top:10px"
    v-else
  >
    Viewing: <span class="selected-path">{{ selectedService.path }}</span>
    <service-actions
      :serviceConnection="selectedService"
    />
    <records-viewer
      :serviceConnection="selectedService"
    />
  </div>
</div>
</template>

<script lang="ts">
// Libs
import Vue from 'vue'

// Constants / Interfaces
import { IServiceConnection } from '@/interfaces'

// Components
import ServiceActions from './ServiceActions.vue'
import RecordsViewer from './RecordsViewer.vue'

export default Vue.extend({

  name: 'ServiceViewer',

  props: ['serverConnection'],

  components: {
    RecordsViewer,
    ServiceActions,
  },

  computed: {

    selectedService() : IServiceConnection | null {
      const { serverConnection } = this
      return (serverConnection) ? serverConnection.selectedService : null
    },

    _hasSelectedService() {
      return (this.selectedService !== null)
    },

  },
})
</script>
