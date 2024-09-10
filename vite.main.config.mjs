import { defineConfig, mergeConfig } from 'vite';
import {
  getBuildConfig,
  getBuildDefine,
  external,
  pluginHotRestart,
} from './vite.base.config.mjs';

// *.解决资源打包问题
import copy from 'rollup-plugin-copy';

// https://vitejs.dev/config
export default defineConfig((env) => {
  /** @type {import('vite').ConfigEnv<'build'>} */
  const forgeEnv = env;
  const { forgeConfigSelf } = forgeEnv;
  const define = getBuildDefine(forgeEnv);
  const config = {
    build: {
      lib: {
        entry: forgeConfigSelf.entry,
        fileName: () => '[name].js',
        formats: ['cjs'],
      },
      rollupOptions: {
        external,
      },
    },
    plugins: [pluginHotRestart('restart'),
    /**
     * 项目打包时 src/assets 内的资源不会同步至 .vite/build 目录，
     * 然而项目本身依赖 src/assets 内的资源（如果异常）。
     * 
     * 可选使用与 src 目录同级的 public 公共目录存储资源，这样资源
     * 会自动被打包，不过会出现被打包双份的奇怪情况。
     * 
     * 这里推荐使用 rollup-plugin-copy 插件，它主要的功能是可以
     * 将指定目录复制到 .vite/build 目录下。
     */
    copy({
      targets: [
        {
          src: "src/assets",
          dest: ".vite/build"
        },
      ]
    }),
    ],
    define,
    resolve: {
      // Load the Node.js entry.
      mainFields: ['module', 'jsnext:main', 'jsnext'],
    },
  };

  return mergeConfig(getBuildConfig(forgeEnv), config);
});
