import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  base: './',
  // ルートディレクトリにあるファイルを静的アセットとして配信するように設定
  publicDir: './', 
  server: {
    port: 5173,
    open: true,
    host: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
