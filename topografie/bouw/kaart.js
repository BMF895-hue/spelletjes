// Bouwt de continentenkaart: landen (Natural Earth 1:110m) samenvoegen tot 7 werelddelen,
// projecteren en als SVG-paden wegschrijven naar continenten.json.
const fs = require('fs');
const topo = require('topojson-client');
const d3 = require('d3-geo');
const pc = require('polygon-clipping');
const { countries } = require('countries-list');
const wc = require('world-countries');

const world = require('world-atlas/countries-110m.json');
const landen = topo.feature(world, world.objects.countries).features;
const numNaarIso = Object.fromEntries(wc.map(c => [c.ccn3, c.cca2]));
const opNaam = { 'N. Cyprus': 'AS', Somaliland: 'AF', Kosovo: 'EU' };

// Gangbare indeling in Nederlandse schoolatlassen: Rusland en Turkije gesplitst
// (Oeral ~60°O, Bosporus ~29°O); Frans-Guyana hoort bij Zuid-Amerika.
const doos = (x0, x1, y0 = -89, y1 = 89) => [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]];
const splitsen = {
  RU: { EU: doos(0, 60, 40, 89) },
  TR: { EU: doos(0, 29.1, 40, 43) },
  FR: { SA: doos(-60, -40, 0, 10) },
};

const delen = { EU: [], AS: [], AF: [], NA: [], SA: [], OC: [], AN: [] };
// Ringen die over de datumgrens lopen (Rusland, Fiji) 'uitvouwen' naar >180° zodat
// het vlakke samenvoegen geen strepen over de kaart trekt; d3-geo rekent daar gewoon mee.
const uitvouwen = poly => {
  const lons = poly.flat().map(p => p[0]);
  if (Math.max(...lons) - Math.min(...lons) < 180) return poly;
  return poly.map(r => r.map(([x, y]) => [x < 0 ? x + 360 : x, y]));
};
const polys = g => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).map(uitvouwen);

for (const f of landen) {
  if (f.id === '260') continue; // Franse Zuidelijke Gebieden: zou als 'Antarctica' midden in de oceaan liggen
  const iso = numNaarIso[f.id];
  const cont = opNaam[f.properties.name] || (iso && countries[iso] && countries[iso].continent);
  if (!cont) { console.warn('onbekend:', f.id, f.properties.name); continue; }
  const geo = cont === 'AN' ? (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates) : polys(f.geometry);
  const s = splitsen[iso];
  if (s) {
    let rest = geo;
    for (const [c, box] of Object.entries(s)) {
      delen[c].push(...pc.intersection(rest, box));
      rest = pc.difference(rest, box);
    }
    delen[cont].push(...rest);
  } else {
    delen[cont].push(...geo);
  }
}

// d3-geo wil buitenringen met de klok mee (sferisch); draai om als het oppervlak > halve bol is.
function goedeWinding(poly) {
  const g = { type: 'Polygon', coordinates: poly };
  if (d3.geoArea(g) > 2 * Math.PI) return poly.map(r => r.slice().reverse());
  return poly;
}

const W = 1000;
const proj = d3.geoNaturalEarth1().rotate([-11, 0]);
proj.fitWidth(W, { type: 'Sphere' });
const pad = d3.geoPath(proj).digits(1);
const [[, y0], [, y1]] = pad.bounds({ type: 'Sphere' });

// Vaste labelpunten (lengte, breedte) zodat namen op een rustige plek staan.
const labels = { EU: [18, 53], AS: [92, 47], AF: [20, 6], NA: [-102, 47], SA: [-60, -12], OC: [134, -25], AN: [30, -80] };
const uit = {}, geo = {};
for (const [c, ps] of Object.entries(delen)) {
  let samen = ps;
  if (c !== 'AN') {
    try { samen = pc.union(...ps.map(p => [p])); } catch (e) { console.warn('union faalt', c, e.message); }
  }
  const mp = { type: 'MultiPolygon', coordinates: samen.map(goedeWinding) };
  // Labelpunt: zwaartepunt van het grootste deel.
  const grootste = samen.map(goedeWinding).sort((a, b) =>
    d3.geoArea({ type: 'Polygon', coordinates: b }) - d3.geoArea({ type: 'Polygon', coordinates: a }))[0];
  const [lx, ly] = proj(labels[c] || d3.geoCentroid({ type: 'Polygon', coordinates: grootste }));
  geo[c] = mp;
  uit[c] = { d: pad(mp), label: [Math.round(lx), Math.round(ly)], bbox: pad.bounds(mp).flat().map(Math.round) };
}
uit.bol = pad({ type: 'Sphere' });
uit.raster = pad(d3.geoGraticule().step([30, 30])());
uit.hoogte = Math.ceil(y1 - y0);
fs.writeFileSync('continenten.json', JSON.stringify(uit));
fs.writeFileSync('continenten-geo.json', JSON.stringify(geo));
console.log('hoogte', uit.hoogte, Object.fromEntries(Object.entries(uit).map(([k, v]) => [k, v.d ? v.d.length : v.length || v])));
