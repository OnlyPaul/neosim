// Source: https://vitest.dev/config/ (official) + React 19 plugin-react docs

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    passWithNoTests: true,
    // No setupFiles at P0 — merge test doesn't need them.
  },
  resolve: {
    alias: { '@': new URL('./', import.meta.url).pathname },
  },
});
