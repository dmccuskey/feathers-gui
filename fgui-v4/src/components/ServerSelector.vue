<template>
  <div id="server-selector">
    <div class="title">Servers</div>
    <div class="selector-row">
      <el-select
        size="large"
        :placeholder="selectorPlaceholderString"
        no-data-text="No Servers to Display"
        @change="_handleSelectServer"
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
        @click="_handleClickServerManagement"
      />
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
import { Server } from '@/models/server.interfaces'

// Controllers & Services
import AppCtrl from '@/controllers/app-ctrl.model'

interface SelectOption {
  value: string
  label: string
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
  currentServerId: string | null
  serversList: Server[]
  selectOptions: SelectOption[]
  selectorPlaceholderString: string
}

interface IMethods {
  _handleSelectServer(serverId: string): void
  _handleClickServerManagement(): void
}

export default Vue.extend<IData, IMethods, IComputed, IProps>({
  name: 'ServerSelector',

  data() {
    return {
      selectedServerId: '',
    }
  },

  computed: {
    currentServerId() {
      return AppCtrl.currentServerId
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

    selectorPlaceholderString() {
      const { serversList } = this
      return serversList.length == 0 ? 'No Servers' : 'Select Server'
    },
  },

  methods: {
    _handleSelectServer(serverId: string) {
      AppCtrl.activateServerById(serverId)
    },

    _handleClickServerManagement() {
      void AppCtrl.showManageServersDialog()
    },
  },

  watch: {
    currentServerId(nV) {
      this.selectedServerId = nV || ''
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

#server-selector {
  .title {
    font-weight: bold;
    padding-bottom: 10px;
  }
  .selector-row {
    display: flex;
    flex-direction: row;
    justify-content: left;
    align-items: center;
    width: 100%;

    .el-select {
      min-width: $item-min-width;
      max-width: $item-max-width;
      width: 100%;
    }

    .select-btn {
      margin-left: $item-margin;
    }
  }
}
</style>

<style lang="scss">
.el-input__inner {
  border-width: 2px;
}
.el-select-dropdown__item {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
}
</style>
