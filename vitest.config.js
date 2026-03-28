import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/index.js', 'src/preview/**', 'src/generators/scene-builder.js', 'src/generators/textures.js', 'src/generators/generate-textures.js', 'src/export/obj-exporter.js'],
    },
  },
});
