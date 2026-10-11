// The app's entry.
import { createApp } from 'vue'
import { APP_KEY, createGuiApp } from './app/app.ts'
import App from './components/App.vue'

createApp(App).provide(APP_KEY, createGuiApp()).mount('#app')
