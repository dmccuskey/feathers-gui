// Libs
import Vue from 'vue'
import VueRouter, { RouteConfig } from 'vue-router'

// Components & Views
import About from '@/views/About.vue'
import Browser from '@/views/Browser.vue'
import Home from '@/views/Home.vue'

Vue.use(VueRouter)

export const routes: Array<RouteConfig> = [
  {
    path: '/',
    name: 'home',
    component: Home,
  },
  {
    path: '/about',
    name: 'about',
    component: About,
  },
  {
    path: '/browser',
    name: 'browser',
    component: Browser,
  },
]

export const router = new VueRouter({
  routes,
  mode: 'hash',
})
