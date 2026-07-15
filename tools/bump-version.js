/* 發佈前執行：node tools/bump-version.js
   同步遞增 version.json / js/version.js / index.html 的 ?v= 快取參數 */
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const vj = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8'));
const v = vj.v + 1;

fs.writeFileSync(path.join(root, 'version.json'), JSON.stringify({ v }) + '\n');
fs.writeFileSync(path.join(root, 'js/version.js'), `'use strict';\nconst GAME_VERSION = ${v};\n`);

const htmlPath = path.join(root, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace(/\?v=\d+/g, '?v=' + v);
fs.writeFileSync(htmlPath, html);

console.log('版本已遞增到 v' + v);
