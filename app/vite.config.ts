import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [vue()],
    server: {
        // 9092 is `fgui-v4`'s, which runs beside this app while it is the reference
        port: Number(process.env.PORT ?? 9093),
        strictPort: true,
    },
})
