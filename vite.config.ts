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
		/*360cdn: https://cdn.baomitu.com/*/
		importToCDN({
			modules: [
				{
					name:"vue",
					var:"Vue",
					path:"https://lib.baomitu.com/vue/3.2.47/vue.global.prod.min.js",
				},
				{
					name: "vue-demi",
					var: "VueDemi",
					path: "https://lib.baomitu.com/vue-demi/0.13.11/index.iife.min.js",
				},
				/*{
					name:"naive-ui",
					var:"naive-ui",
					path:"https://cdn.staticfile.org/naive-ui/2.34.3/index.prod.min.js",
				},*/
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
				{
					name:"highlight.js",
					var:"hljs",
					path:["https://lib.baomitu.com/highlight.js/11.7.0/highlight.min.js",
						"https://lib.baomitu.com/highlight.js/11.7.0/languages/mathematica.min.js",
					],
				},
				{
					name:"vue-router",
					var:"VueRouter",
					path:"https://lib.baomitu.com/vue-router/4.1.6/vue-router.global.min.js",
				},
				{
					name:"vue-i18n",
					var:"VueI18n",
					path:"https://lib.baomitu.com/vue-i18n/9.2.2/vue-i18n.global.prod.min.js",
				},
				{
					name:"axios",
					var:"axios",
					path:"https://lib.baomitu.com/axios/1.3.4/axios.min.js",
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
			rollupOptions: {
				output: {
					// 最小化拆分包
					manualChunks(id) {
						if (id.includes("node_modules")) {
							// 通过拆分包的方式将所有来自node_modules的模块打包到单独的chunk中
							return id
								.toString()
								.split("node_modules/")[1]
								.split("/")[0]
								.toString();
						}
					},
					// 设置chunk的文件名格式
					chunkFileNames: (chunkInfo) => {
						const facadeModuleId = chunkInfo.facadeModuleId
							? chunkInfo.facadeModuleId.split("/")
							: [];
						const fileName1 =
							facadeModuleId[facadeModuleId.length - 2] || "[name]";
						// 根据chunk的facadeModuleId（入口模块的相对路径）生成chunk的文件名
						return `js/${fileName1}/[name].[hash].js`;
					},
					// 设置入口文件的文件名格式
					entryFileNames: "js/[name].[hash].js",
					// 设置静态资源文件的文件名格式
					assetFileNames: "[ext]/[name].[hash:4].[ext]",
				},
			},
    },
		plugins: setupPlugins(viteEnv),
  }
})
