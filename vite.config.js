import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const BASE = '/Niftytracker/'

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw-custom.js',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Nifty 50 Tracker',
        short_name: 'NiftyTracker',
        description: 'Real-time Nifty 50 trading signals and market tracker',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/Niftytracker/',
        scope: '/Niftytracker/',
        icons: [
          { src: '/Niftytracker/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/Niftytracker/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      }
    })
  ],
})
