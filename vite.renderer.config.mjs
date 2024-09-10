import { defineConfig } from 'vite';
import { pluginExposeRenderer } from './vite.base.config.mjs';

// *.Electron 整合 Vue3 框架
import vue from '@vitejs/plugin-vue';

// https://vitejs.dev/config
export default defineConfig((env) => {
  /** @type {import('vite').ConfigEnv<'renderer'>} */
  const forgeEnv = env;
  const { root, mode, forgeConfigSelf } = forgeEnv;
  const name = forgeConfigSelf.name ?? '';

  /** @type {import('vite').UserConfig} */
  return {
    root,
    mode,
    base: './',
    build: {
      outDir: `.vite/renderer/${name}`,

      // *.如果存在多个窗体对象对应多个首页，那么只需要配置 rollupOptions 指定资源位置
      // *.不对窗体对象的首页资源进行映射，Electron-Forge 就只会打包 index.html 所相关的资源
      rollupOptions: {
        input: {
          // *.main.js => mainWindow
          main_window: "./index.html",
          // *.main.js => miniWindow
          mini_window: "./mini.html",
        },
      }
    },
    plugins: [
      pluginExposeRenderer(name),

      // *.添加 vue() 插件以整合 Vue3 框架
      vue()
    ],
    resolve: {
      preserveSymlinks: true,
    },
    clearScreen: false,
  };
});

// import { defineConfig } from 'vite';
// import vue from '@vitejs/plugin-vue';

// // https://vitejs.dev/config
// export default defineConfig({
//   plugins: [vue()]
// });