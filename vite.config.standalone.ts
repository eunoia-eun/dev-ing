import { defineConfig, mergeConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import baseConfig from './vite.config';

// 인터넷/배포 환경 없이 index.html 파일 하나만으로 실행하기 위한 빌드.
// 유해인자별 건강장해(동적 import 청크)까지 전부 한 파일에 인라인한다.
export default defineConfig(
  mergeConfig(baseConfig, {
    plugins: [viteSingleFile()],
    build: {
      outDir: 'dist-standalone',
      cssCodeSplit: false,
      assetsInlineLimit: 100 * 1024 * 1024,
      chunkSizeWarningLimit: 2000,
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  }),
);
