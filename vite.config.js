import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function bundleAnalysisPlugin(enabled = false) {
  return {
    name: 'local-bundle-analysis',
    apply: 'build',
    generateBundle(_options, bundle) {
      if (!enabled) return;

      const files = Object.entries(bundle).map(([fileName, chunk]) => {
        const size = chunk.type === 'asset'
          ? Buffer.byteLength(chunk.source || '', 'utf8')
          : Buffer.byteLength(chunk.code || '', 'utf8');

        return {
          fileName,
          type: chunk.type,
          isEntry: chunk.type === 'chunk' ? Boolean(chunk.isEntry) : false,
          size
        };
      }).sort((left, right) => right.size - left.size);

      const summary = {
        generatedAt: new Date().toISOString(),
        totalBytes: files.reduce((sum, file) => sum + file.size, 0),
        entryBytes: files.filter((file) => file.isEntry).reduce((sum, file) => sum + file.size, 0),
        jsBytes: files.filter((file) => file.fileName.endsWith('.js')).reduce((sum, file) => sum + file.size, 0),
        cssBytes: files.filter((file) => file.fileName.endsWith('.css')).reduce((sum, file) => sum + file.size, 0),
        files
      };

      this.emitFile({
        type: 'asset',
        fileName: 'bundle-report.json',
        source: JSON.stringify(summary, null, 2)
      });
    }
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    bundleAnalysisPlugin(mode === 'analyze')
  ],
  build: {
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1000,
    modulePreload: {
      polyfill: true,
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react')) {
              return 'vendor-react';
            }
            if (id.includes('axios') || id.includes('socket.io-client') || id.includes('xss') || id.includes('fast-xml-parser')) {
              return 'vendor-utils';
            }
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
            return 'vendor';
          }
        }
      }
    },
    rolldownOptions: {
      external: []
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./testSetup.js'],
    environmentOptions: {
      jsdom: {
        resources: 'usable'
      }
    }
  }
}))
