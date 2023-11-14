import path from 'path'
import type { PluginOption } from 'vite'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import importToCDN from 'vite-plugin-cdn-import'

// 插件-用于查看打包后的体积信息
//import { visualizer } from 'rollup-plugin-visualizer';

function setupPlugins(env: ImportMetaEnv): PluginOption[] {
  return [
    vue(),
		//visualizer({ open: true }),
		/*https://cdn.baomitu.com/*/
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
					path:"https://lib.baomitu.com/html2canvas/1.4.1/html2canvas.js",
				},
				/*{
					name:"highlight.js",
					var:"highlight.js",
					path:"https://lib.baomitu.com/highlight.js/11.9.0/es/core.min.js",
				},*/
				/*{
					name:"vue-router",
					var:"vue-router",
					path:"https://lib.baomitu.com/vue-router/4.1.6/vue-router.cjs.min.js",
				},*/
				/*{
					name:"vue",
					var:"vue",
					path:"https://lib.baomitu.com/vue/3.2.47/vue.cjs.min.js",
				},*/
				/*{
					name:"vue-i18n",
					var:"vue-i18n",
					path:"https://lib.baomitu.com/vue-i18n/9.2.2/vue-i18n.esm-bundler.min.js",
				},*/
				/*{
					name:"naive-ui",
					var:"naive-ui",
					path:"https://lib.baomitu.com/naive-ui/2.34.4/index.min.js",
				},*/
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
