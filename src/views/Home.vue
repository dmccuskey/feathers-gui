<template>
<div id="home-view">
  <img alt="Vue logo" src="../assets/logo.png">
  <router-link :to="{ name: 'browser' }">Browser</router-link>
  <router-link :to="{ name: 'about' }">About</router-link>
</div>
</template>
