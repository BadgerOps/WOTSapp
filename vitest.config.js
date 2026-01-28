import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Unified test config for both frontend (src/) and Cloud Functions (functions/)
// Frontend tests use jsdom for React component testing
// Cloud Functions tests use dependency injection, so jsdom works fine
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    // Use forks pool with memory limits to prevent OOM crashes
    pool: 'forks',
    // Run tests sequentially to prevent memory accumulation
    fileParallelism: false,
    // Single worker to minimize memory usage
    minWorkers: 1,
    maxWorkers: 1,
    // Pass memory limit to worker process
    forks: {
      execArgv: ['--max-old-space-size=4096'],
    },
    // Increase test timeout for slower CI environments
    testTimeout: 10000,
    // Teardown timeout for cleanup
    teardownTimeout: 5000,
    // Exclude problematic test file that causes OOM on Node.js < 22.12
    // This test can be run manually with: npm test -- --run src/hooks/useCQSwapRequests.test.js
    // The OOM is likely due to jsdom + renderHook memory accumulation
    // Also exclude Playwright screenshot specs (run with npm run screenshots)
    exclude: ['**/node_modules/**', 'src/hooks/useCQSwapRequests.test.js', 'screenshots/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.test.{js,jsx}',
        '**/*.spec.{js,jsx}',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
