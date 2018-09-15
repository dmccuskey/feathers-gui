<template>
<el-header id="header">
  <div>Feathers GUI</div>
  <el-button icon="el-icon-setting" circle
    @click="_handleShowSettings"
  />
</el-header>
</template>

<script lang="ts">
// Libs
import Vue from 'vue'

// Components
import FGuiCtrl from '@/controllers/feathers-gui-ctrl'

export default Vue.extend({
  methods: {

    _handleShowSettings() {
      FGuiCtrl.showManageServersDialog()
    },

  },
})
</script>

<style lang="scss" scoped>
#header {
  background-color: olivedrab;
  height: 30px;
  color: white;
  padding: 10px;
  font-size: 1.5rem;

  display: flex;
  flex-direction: row;
  justify-content: space-between;
}
</style>
