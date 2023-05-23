<template>
  <el-header id="app-header">
    <div class="navigation">
      <router-link class="app-title" :to="{ name: 'home' }"
        >Feathers GUI</router-link
      >
      <router-link class="nav-item" :to="{ name: 'browser' }"
        >Browser</router-link
      >
      <router-link class="nav-item" :to="{ name: 'about' }">About</router-link>
    </div>

    <div class="server-select">
      <div class="title">Servers:</div>
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
  </el-header>
</template>

<script lang="ts">
// Libs
import Vue from 'vue'

// Constants & Interfaces
import { Server, ServerHash } from '@/models/server.interfaces'

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
  serverConfigs: ServerHash
  serversList: Server[]
  selectOptions: SelectOption[]
}

interface IMethods {
  _handleServerSelect(serverId: string): void
  _handleShowSettings(): void
}

export default Vue.extend<IData, IMethods, IComputed, IProps>({
  data() {
    return {
      selectedServerId: '',
    }
  },

  computed: {
    currentServerId() {
      return AppCtrl.currentServerId
    },

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
  },

  methods: {
    _handleServerSelect(serverId: string) {
      const { serverConfigs } = this

      const serverConfig = serverConfigs[serverId]
      AppCtrl.activateServer(serverConfig)
    },

    _handleShowSettings() {
      void AppCtrl.showManageServersDialog()
    },
  },

  mounted() {
    const { currentServerId } = this
    this.selectedServerId = currentServerId || ''
  },
})
</script>

<style lang="scss" scoped>
$item-margin: 20px;

#app-header {
  background-color: olivedrab;
  height: 30px;
  color: white;
  padding: 10px;
  font-size: 1.5rem;

  display: flex;
  flex-direction: row;
  justify-content: space-between;

  .navigation {
    display: flex;
    flex-direction: row;
    align-items: center;

    a {
      margin: 0 14px;
    }

    .app-title {
      text-decoration: none;
      color: white;
    }

    .nav-item {
      text-decoration: none;
      color: yellow;
      font-size: 16px;
    }
  }

  .server-select {
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
    align-items: center;

    width: 440px;

    .title {
      margin-right: $item-margin;
    }

    .el-select {
      width: 260px;
    }

    .select-btn {
      margin-left: $item-margin;
    }
  }
}
</style>
