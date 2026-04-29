import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'ES2020',
    minify: 'terser',
    rollupOptions: {
      output: {
        entryFileNames: '[name].js'
      }
    }
  },
  server: {
    open: false
  }
})
