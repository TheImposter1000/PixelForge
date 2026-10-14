'use strict';

const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve(__dirname, '..', 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.min.js');
const folder = path.join(__dirname, 'vendor');
if (!fs.existsSync(source)) {
  throw new Error('Supabase browser SDK is missing. Run npm install before building.');
}
fs.mkdirSync(folder, {recursive:true});
fs.copyFileSync(source, path.join(folder, 'supabase.min.js'));
console.log('Bundled the browser Supabase SDK for offline desktop startup.');
