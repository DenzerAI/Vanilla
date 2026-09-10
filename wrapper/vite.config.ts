import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFile } from 'node:fs/promises';

export default defineConfig({
  root: new URL('./ui', import.meta.url).pathname,
  resolve: { alias: { '@': new URL('./ui', import.meta.url).pathname } },
  plugins: [
    { name: 'local-raw-assets', enforce: 'pre', async load(id) {
      if (/\/assets\/avatars\/(?:faces\/)?[a-z]+\.svg$/.test(id) || /-LICENSE\.txt$/.test(id))
        return 'export default ' + JSON.stringify(await readFile(id, 'utf8'));
    } },
    react(), tailwindcss(),
  ],
  define: { __UI_VERSION__: JSON.stringify(process.env.AGENT_UI_VERSION || 'development') },
  build: {
    outDir: new URL('./dist', import.meta.url).pathname,
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: false,
    rollupOptions: { input: {app:new URL('./ui/index.html',import.meta.url).pathname, blueprint:new URL('./ui/blueprint.html',import.meta.url).pathname}, output: {
      entryFileNames: '[name].js',
      chunkFileNames: 'assets/[name]-[hash].js',
      manualChunks(id) {
        if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'react';
        if (id.includes('/node_modules/motion') || id.includes('/node_modules/framer-motion/')) return 'motion';
      },
      assetFileNames: asset => asset.names?.some(n => n.endsWith('.css')) ? 'app.css' : 'assets/[name]-[hash][extname]',
    } },
  },
  server: {
    host: '127.0.0.1',
    proxy: { '/api': {target: 'http://127.0.0.1:' + (process.env.UWE_PORT || '1989'), changeOrigin:true,
      configure(proxy) {proxy.on('proxyReq',req=>req.removeHeader('origin'));},
    } },
  },
});
