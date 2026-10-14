'use strict';

const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const folder = path.join(__dirname, 'vendor');
fs.mkdirSync(folder, {recursive: true});
esbuild.buildSync({
  entryPoints: ['@supabase/supabase-js'],
  bundle: true,
  platform: 'browser',
  format: 'iife',
  globalName: 'supabase',
  target: 'es2020',
  minify: true,
  outfile: path.join(folder, 'supabase.min.js'),
  logLevel: 'warning'
});
const output = path.join(folder, 'supabase.min.js');
if (!fs.existsSync(output) || fs.statSync(output).size < 10000) {
  throw new Error('Supabase browser SDK bundling failed.');
}
console.log('Bundled offline Supabase browser SDK (' + Math.round(fs.statSync(output).size / 1024) + ' KB).');
