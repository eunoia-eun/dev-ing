/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// 경로 별칭(@domain 등)을 vite와 vitest가 동일하게 해석하도록 한곳에서 정의.
const alias = {
  '@domain': fileURLToPath(new URL('./src/domain', import.meta.url)),
  '@application': fileURLToPath(new URL('./src/application', import.meta.url)),
  '@infrastructure': fileURLToPath(new URL('./src/infrastructure', import.meta.url)),
  '@composition': fileURLToPath(new URL('./src/composition', import.meta.url)),
  '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
  '@test': fileURLToPath(new URL('./test', import.meta.url)),
};

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  // 유해인자별 건강장해 데이터(hazardHealthDetails.json)는 동적 import로
  // 별도 청크가 되어 카탈로그 상세를 열 때만 로딩된다 → 경고 한도만 상향.
  build: { chunkSizeWarningLimit: 900 },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/harness/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
