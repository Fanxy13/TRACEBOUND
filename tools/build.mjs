// Release build for Poki: one HTML file + one JS file (Phaser + game),
// fonts inlined. Runs from file:// as well as from any static host.
//
//   npm run build   ->   dist/

import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'licenses'), { recursive: true });

const result = await esbuild.build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  write: false,
  legalComments: 'none',
  logLevel: 'warning',
  plugins: [{
    // Development hooks (debug inspector, scripted bot driver) are compiled out
    name: 'strip-dev',
    setup(b) {
      b.onLoad({ filter: /[\\/]src[\\/].*\.js$/ }, async (args) => {
        const src = await fs.promises.readFile(args.path, 'utf8');
        const out = src.replace(/const __DEV__ = [^;]+;/g, '').replace(/\b__DEV__\b/g, 'false');
        return { contents: out, loader: 'js' };
      });
    },
  }],
});
const gameJs = result.outputFiles[0].text;
if (/tbdebug|TBX/.test(gameJs)) throw new Error('debug hook leaked into the release bundle');

const phaser = fs.readFileSync(path.join(root, 'lib/phaser.min.js'), 'utf8');
fs.writeFileSync(path.join(dist, 'game.js'), phaser + '\n;\n' + gameJs);

// CSS with the font embedded (works offline and from file://)
const font = fs.readFileSync(path.join(root, 'assets/fonts/fredoka-600.woff2')).toString('base64');
let css = fs.readFileSync(path.join(root, 'styles/main.css'), 'utf8');
css = css.replace("url('../assets/fonts/fredoka-600.woff2')", `url(data:font/woff2;base64,${font})`);
css = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\n\s*\n/g, '\n');

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace('<link rel="stylesheet" href="styles/main.css">', `<style>${css}</style>`);
html = html.replace('<script src="lib/phaser.min.js"></script>\n  <script type="module" src="src/main.js"></script>', '<script src="game.js"></script>');
if (html.includes('src/main.js')) throw new Error('index.html script tags not replaced');
fs.writeFileSync(path.join(dist, 'index.html'), html);

fs.copyFileSync(path.join(root, 'lib/PHASER-LICENSE.md'), path.join(dist, 'licenses/phaser-MIT.txt'));
fs.copyFileSync(path.join(root, 'assets/fonts/OFL-Fredoka.txt'), path.join(dist, 'licenses/fredoka-OFL.txt'));

const kb = (f) => (fs.statSync(path.join(dist, f)).size / 1024).toFixed(0) + ' KB';
console.log(`dist/index.html ${kb('index.html')}`);
console.log(`dist/game.js    ${kb('game.js')} (Phaser ${(phaser.length / 1024).toFixed(0)} KB + game ${(gameJs.length / 1024).toFixed(0)} KB)`);
