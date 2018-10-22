<template>
<el-header id="app-header">

  <div class="navigation">
    <router-link class="app-title" :to="{ name: 'home' }">Feathers GUI</router-link>
    <router-link class="nav-item" :to="{ name: 'browser' }">Browser</router-link>
    <router-link class="nav-item" :to="{ name: 'about' }">About</router-link>
  </div>

  <div class="server-select">
    <div class="title">Servers:</div>
    <el-select size="large"
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
        :disabled="item.disabled"
      />
    </el-select>
    <el-button class="select-btn" icon="el-icon-setting" circle
      @click="_handleShowSettings"
    />
  </div>

</el-header>
</template>

<script lang="ts">
// Libs
import Vue from 'vue'

// Constants / Interfaces
import { IServerConnection } from '@/interfaces'

// Components
import FGuiCtrl from '@/controllers/feathers-gui-ctrl'

interface SelectOption {
  value: string
  label: string
  disabled: boolean
}

export default Vue.extend({

  data() {
    return {
      selectedServerId: '',
    }
  },

  computed: {

    currentServerId() : string {
      return this.$store.getters['currentServerId']
    },

    serverConnectionsList() : IServerConnection[] {
      return this.$store.getters['getServerConnectionsList']
    },

    selectOptions() : SelectOption[] {
      const { currentServerId, serverConnectionsList } = this
      return serverConnectionsList.map(function(item, idx) {
        return {
          value: item.id,
          label: item.url,
          disabled: (item.isConnected === false),
        }
      })
    },

  },

  methods: {

    _handleServerSelect(serverId:string) {
      const getSrvrConnFunc = this.$store.getters['getServerConnectionByServerId']
      const srvrConn : IServerConnection | null = getSrvrConnFunc(serverId)
      FGuiCtrl.selectServer(srvrConn)
    },

    _handleShowSettings() {
      FGuiCtrl.showManageServersDialog()
    },

  },

  mounted() {
    const { currentServerId } = this
    this.selectedServerId = currentServerId
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
