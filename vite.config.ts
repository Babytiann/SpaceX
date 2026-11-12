import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(({ command, mode }) => {
  // A plain production build is always safe to deploy; HD must be requested explicitly.
  const lite = mode === 'lite' || (command === 'build' && mode !== 'hd');
  const publicDir = lite ? 'public-lite' : 'public';
  if (lite) {
    const manifestPath = resolve(publicDir, 'textures/manifest.json');
    if (!existsSync(manifestPath)) {
      throw new Error('Missing public-lite assets. Restore them from Git or run npm run assets:lite.');
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const images = JSON.stringify(manifest).match(/"[^"\n]+\.(?:jpg|png)"/g) ?? [];
    const required = ['textures/manifest.json', 'textures/CREDITS.md', 'music/soundtrack.mp3', 'music/CREDITS.md',
      ...readdirSync('public/scenic').filter((name) => name.endsWith('.jpg')).map((name) => `scenic/${name}`),
      ...new Set(images.map((name) => `textures/${JSON.parse(name)}`))];
    for (const file of required) {
      const path = resolve(publicDir, file);
      if (!existsSync(path) || !statSync(path).isFile() || statSync(path).size === 0) {
        throw new Error(`Missing lite asset: ${file}. Restore public-lite or run npm run assets:lite.`);
      }
    }
  }
  return {
    publicDir,
    define: { __LITE_BUILD__: JSON.stringify(lite) },
    build: { outDir: mode === 'hd' ? 'dist-hd' : 'dist' },
  };
});
