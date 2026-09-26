import { defineConfig } from 'vite';
export default defineConfig({ build: { emptyOutDir: false, lib: { entry: 'lib/index.ts', formats: ['es'], fileName: 'index' }, rollupOptions: { external: ['react'] } } });
