import path from 'path'
import type { PluginOption } from 'vite'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import importToCDN from 'vite-plugin-cdn-import'

function setupPlugins(env: ImportMetaEnv): PluginOption[] {
  return [
    vue(),
		importToCDN({
			modules: [
				{
					name:"katex",
					var:"katex",
					path:"https://lib.baomitu.com/KaTeX/0.16.4/katex.js",
					css:"https://lib.baomitu.com/KaTeX/0.16.4/katex.css"
				},
				{
					name:"html2canvas",
					var:"html2canvas",
					path:"https://github.elemecdn.com/html2canvas@1.4.1/dist/html2canvas.js",
				},
			]
		}),
    env.VITE_GLOB_APP_PWA === 'true' && VitePWA({
      injectRegister: 'auto',
      manifest: {
        name: 'JasonYuGPT',
        short_name: 'JasonGPT',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ]
}

export default defineConfig((env) => {
  const viteEnv = loadEnv(env.mode, process.cwd()) as unknown as ImportMetaEnv

  return {
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), 'src'),
      },
    },
    server: {
			webSocketServer: false,
      host: '0.0.0.0',
      port: 1002,
      open: false,
      proxy: {
        '/api': {
          target: viteEnv.VITE_APP_API_BASE_URL,
          changeOrigin: true, // 允许跨域
          rewrite: path => path.replace('/api/', '/'),
        },
      },
    },
    build: {
      reportCompressedSize: false,
      sourcemap: false,
      commonjsOptions: {
        ignoreTryCatch: false,
      },
    },
		plugins: setupPlugins(viteEnv),
  }
})
