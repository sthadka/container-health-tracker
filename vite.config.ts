import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/main.ts',
      formats: ['iife'],
      name: 'AppScriptExports',
      fileName: () => 'Code.js'
    },
    rollupOptions: {
      output: {
        entryFileNames: 'Code.js',
        extend: false,
        // Expose functions as actual function declarations for Apps Script
        footer: `
// Apps Script requires top-level function declarations
function runMonitoring() {
  return AppScriptExports.runMonitoring();
}

function testMonitoring() {
  return AppScriptExports.testMonitoring();
}

function setupProperties(spreadsheetId) {
  return AppScriptExports.setupProperties(spreadsheetId);
}
`
      }
    },
    target: 'es2020',
    minify: false  // Apps Script needs readable code for debugging
  }
});
