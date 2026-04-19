/**
 * Copyright IBM Corp. 2025, 2026
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import i18nextLoader from 'vite-plugin-i18next-loader';

// https://vite.dev/config/
export default defineConfig(({ isSsrBuild }) => {
  const shouldAnalyze = process.env.ANALYZE === 'true' && !isSsrBuild;

  return {
    plugins: [
      react(),
      tailwindcss(),
      /**
       * Loads i18n translation JSON files from src/locales at build time.
       * Files are resolved by basename (e.g., de.json becomes the 'de' namespace),
       * making translations available to i18next without runtime file fetching.
       */
      i18nextLoader({
        paths: ['./src/locales'],
        namespaceResolution: 'basename',
      }),
      shouldAnalyze
        ? visualizer({
            filename: 'dist/client-bundle-stats.html',
            gzipSize: true,
            brotliSize: true,
            open: false,
            template: 'treemap',
          })
        : null,
    ].filter(Boolean),
    build: {
      // Keep the default threshold explicit so the warning remains a signal.
      // We treat size warnings as prompts to inspect chunk composition, not as
      // something to suppress by raising the limit.
      chunkSizeWarningLimit: 500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) {
              return undefined;
            }

            // Keep manual chunks narrow and stable. Avoid arbitrary splitting
            // that can hurt lazy loading or create ordering issues.
            if (
              id.includes('/@carbon/ibm-products/') ||
              id.includes('/@carbon-products/') ||
              id.includes('/@carbon/ai-chat/')
            ) {
              return 'carbon-products';
            }

            if (
              id.includes('/@carbon/react/') ||
              id.includes('/@carbon/styles/') ||
              id.includes('/@carbon/layout/') ||
              id.includes('/@carbon/utilities/') ||
              id.includes('/@carbon-labs/react-theme-settings/')
            ) {
              return 'carbon-react';
            }

            if (
              id.includes('/react-router/') ||
              id.includes('/react-router-dom/')
            ) {
              return 'router';
            }

            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/scheduler/')
            ) {
              return 'react-core';
            }

            if (
              id.includes('/i18next') ||
              id.includes('/i18next-browser-languagedetector/') ||
              id.includes('/react-i18next/')
            ) {
              return 'i18n';
            }

            return undefined;
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
      },
    },
  };
});
