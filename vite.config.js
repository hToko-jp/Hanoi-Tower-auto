import { defineConfig } from 'vite'

export default defineConfig({
    base: './', // GitHub Pagesなどのサブディレクトリでも動作するように
    build: {
        outDir: 'dist',
    }
})
