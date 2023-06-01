// Libs
import Vue from 'vue'
import Element from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'

// Components
import App from './App.vue'
import { router } from './router'
import store from '@/store'

// Controllers & Services
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import appCtrl from '@/controllers/app-ctrl.model'

Vue.config.productionTip = false

Vue.use(Element)

new Vue({
  router,
  store,
  render: (h) => h(App),
}).$mount('#app')
