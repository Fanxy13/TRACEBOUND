// Copies the Phaser runtime from node_modules into lib/ (served locally,
// never from a CDN). Run after updating the phaser devDependency.

import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = path.join(root, 'node_modules/phaser/dist/phaser-arcade-physics.min.js');
if (!fs.existsSync(src)) {
  console.error('phaser not installed - run npm install first');
  process.exit(1);
}
fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
fs.copyFileSync(src, path.join(root, 'lib/phaser.min.js'));
fs.copyFileSync(path.join(root, 'node_modules/phaser/LICENSE.md'), path.join(root, 'lib/PHASER-LICENSE.md'));
const version = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/phaser/package.json'), 'utf8')).version;
console.log(`lib/phaser.min.js <- phaser ${version}`);
