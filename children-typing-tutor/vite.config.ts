import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'production-content-security-policy',
      apply: 'build',
      transformIndexHtml: {
        order: 'post',
        handler: () => [
          {
            tag: 'meta',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content:
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'",
            },
            injectTo: 'head-prepend',
          },
        ],
      },
    },
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: [],
      includeManifestIcons: false,
      manifest: {
        name: '打字小岛 Typing Island',
        short_name: '打字小岛',
        lang: 'zh-CN',
        theme_color: '#238578',
        background_color: '#f7fbfa',
        display: 'standalone',
        icons: [{ src: 'assets/bunny.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,webmanifest}'],
        dontCacheBustURLsMatching: /-[\w-]{8}\./,
        navigateFallback: 'index.html',
      },
    }),
  ],
});
