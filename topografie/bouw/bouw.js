// Zet de app in elkaar: kaartdata in het sjabloon, icoon (globe) en lettertypen.
// Gebruik: npm install && node kaart.js && node bouw.js <doelmap>
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const d3 = require('d3-geo');
const doel = process.argv[2] || 'uit';
fs.mkdirSync(path.join(doel, 'fonts'), { recursive: true });

const k = JSON.parse(fs.readFileSync('continenten.json', 'utf8'));
const html = fs.readFileSync('sjabloon.html', 'utf8').replace('__KAART__', JSON.stringify(k));
fs.writeFileSync(path.join(doel, 'index.html'), html);

for (const w of [500, 600, 700]) {
  const f = `fredoka-latin-${w}-normal.woff2`;
  fs.copyFileSync(require.resolve(`@fontsource/fredoka/files/${f}`), path.join(doel, 'fonts', f));
}

// Icoon: wereldbol (orthografisch, Europa en Afrika in beeld) in dezelfde kleuren als de app.
const kleur = { NA: '#7cc160', SA: '#3fae94', EU: '#f4c84a', AF: '#d39b55', AS: '#ec7357', OC: '#c77dba', AN: '#f1f6fa' };
const r = 190, proj = d3.geoOrthographic().rotate([-15, -25]).translate([256, 256]).scale(r);
const geo = JSON.parse(fs.readFileSync('continenten-geo.json', 'utf8'));
const pad = d3.geoPath(proj);
let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#2b7bb9"/>
<circle cx="256" cy="256" r="${r + 12}" fill="#1f5f92"/><circle cx="256" cy="256" r="${r}" fill="#a8d8f2"/>`;
for (const [c, g] of Object.entries(geo)) { const d = pad(g); if (d) svg += `<path d="${d}" fill="${kleur[c]}"/>`; }
svg += `<circle cx="256" cy="256" r="${r}" fill="none" stroke="#16324a" stroke-width="6"/></svg>`;
fs.writeFileSync('icoon.svg', svg);
for (const [n, w] of [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180]])
  execFileSync('rsvg-convert', ['-w', String(w), '-h', String(w), 'icoon.svg', '-o', path.join(doel, n)]);
console.log('klaar:', doel, (html.length / 1024).toFixed(0) + ' kB');
