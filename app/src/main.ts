// The app's entry.
import { createApp } from 'vue'
import { APP_KEY, createGuiApp } from './app/app.ts'
import App from './components/App.vue'
import { THEMING_KEY, Theming } from './widgets/index.ts'
import './widgets/base.css'

/** The key in `localStorage` of the theme chosen, shared by every window. */
const THEME_KEY = 'feathers-gui.theme'

// The theme is on before anything is drawn.
const theming = new Theming({ storageKey: THEME_KEY })

createApp(App).provide(APP_KEY, createGuiApp()).provide(THEMING_KEY, theming).mount('#app')
