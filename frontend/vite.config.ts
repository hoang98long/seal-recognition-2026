import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'SEAL_'), ...process.env };
  return {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/node_modules/zod/')) return 'validation';
          },
        },
      },
    },
    server: {
      port: Number(env.SEAL_FRONTEND_PORT || 5173),
      strictPort: true,
      proxy: {
        '/api': { target: env.SEAL_API_TARGET || 'http://127.0.0.1:8000', changeOrigin: false },
      },
    },
  };
});
