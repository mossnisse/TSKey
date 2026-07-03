import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/TSKey/', // deployed at https://mossnisse.github.io/TSKey/
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),            // Main app
        demo: resolve(__dirname, 'src/editor/index.html'), // Editor demo
      },
    },
  },
});
