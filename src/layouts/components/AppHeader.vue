<template>
  <el-header id="app-header">
    <div class="navigation">
      <router-link class="app-title" :to="{ name: 'home' }"
        >Feathers GUI</router-link
      >
      <router-link class="nav-item" :to="{ name: 'info' }">Info</router-link>
    </div>
    <a class="link" href="https://github.com/dmccuskey/feathers-gui">github</a>
  </el-header>
</template>

<script lang="ts">
// Libs
import Vue from 'vue'

export default Vue.extend({
  name: 'AppHeader',
})
</script>

<style lang="scss" scoped>
$item-margin: 20px;

#app-header {
  background-color: olivedrab;
  height: 30px;
  color: white;
  padding: 10px;
  margin-bottom: 20px;
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
  .link {
    text-decoration: none;
    color: yellow;
    font-size: 16px;
  }
}
</style>
