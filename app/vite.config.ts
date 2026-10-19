import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [vue()],
    server: {
        // The project's ports are 3040 to 3049: 3040 and 3041 are the dev servers', 3043 is `fgui-v4`'s
        port: Number(process.env.PORT ?? 3042),
        strictPort: true,
    },
})
