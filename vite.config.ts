import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// package.json 의 version 을 앱 화면에 표시하기 위해 읽어 둔다
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// GitHub Pages 배포 시에는 BASE_PATH=/저장소이름/ 으로 빌드한다. (Vercel은 기본값 '/')
const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        id: base,
        name: '문제별 랩 타이머',
        short_name: '랩타이머',
        description: '시험 연습 중 문제별 소요 시간을 탭 한 번으로 기록하고, 끝난 뒤 복기하는 타이머',
        lang: 'ko',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ebe5d8',
        theme_color: '#ebe5d8',
        categories: ['education', 'productivity'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  test: {
    environment: 'node',
  },
})
