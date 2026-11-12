import { copyFile, writeFile } from 'node:fs/promises';

const output = new URL('../dist-pages/', import.meta.url);

await copyFile(new URL('../worker.mjs', import.meta.url), new URL('_worker.js', output));
await writeFile(new URL('_routes.json', output), `${JSON.stringify({
  version: 1,
  include: ['/music/soundtrack.mp3'],
  exclude: [],
}, null, 2)}\n`);
await writeFile(new URL('404.html', output), '<!doctype html><html lang="en"><meta charset="utf-8"><title>Not found</title><body>Not found</body></html>\n');
