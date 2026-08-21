import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages のようにサブパス配下（https://user.github.io/repo/）で
  // 公開される環境でも、生成されるHTML/JSの参照が壊れないよう相対パスにする。
  base: './',
  server: {
    port: 5173
  },
  build: {
    outDir: 'release',
    assetsInlineLimit: 0
  }
});
