// Libs
import Vue from 'vue'
import VueRouter, { RouteConfig } from 'vue-router'

// Components & Views

Vue.use(VueRouter)

export const routes: Array<RouteConfig> = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/Home.vue'),
  },
  {
    path: '/info',
    name: 'info',
    component: () => import('@/views/Info.vue'),
  },
]

export const router = new VueRouter({
  routes,
  mode: 'hash',
})
