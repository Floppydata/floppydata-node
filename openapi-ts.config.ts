import { defineConfig } from '@hey-api/openapi-ts';

// Regenerate with `pnpm sync-spec && pnpm generate`. Everything under
// src/gen is generated: change this config or the API spec, never the output.
export default defineConfig({
  input: './openapi/v2.json',
  output: {
    path: './src/gen',
    // Node ESM needs explicit extensions in relative imports.
    importFileExtension: '.js',
  },
  plugins: [
    // Methods throw by default, so `data` is never undefined on success.
    { name: '@hey-api/client-fetch', throwOnError: true },
    '@hey-api/typescript',
    {
      name: '@hey-api/sdk',
      // One class with a method per operationId; FloppyData extends it.
      operations: { strategy: 'single', containerName: 'FloppyDataApi' },
      // fd.fetchWebData({ url }) instead of { body: { url } }.
      paramsStructure: 'flat',
    },
  ],
});
