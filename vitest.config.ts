import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Vitest Configuration
 * "Senior" Checklist: Automated Testing.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    exclude: ['**/node_modules/**', '**/tests/e2e/**', '**/dist/**'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
