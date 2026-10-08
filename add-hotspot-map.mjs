import fs from 'fs';

const file = 'components/HotspotList.js';
let s = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

if (s.includes('HotspotMap')) { console.log('The map is already added.'); process.exit(0); }

const edits = [
  [
    'import { computeHotspots, reporterOf } from "@/lib/hotspots";',
    'import { computeHotspots, reporterOf } from "@/lib/hotspots";\nimport HotspotMap from "./HotspotMap";',
  ],
  [
    '{hotspots.map((h) => (',
    '{state === "ready" && hotspots.length > 0 && <HotspotMap hotspots={hotspots} />}\n\n      {hotspots.map((h) => (',
  ],
];

for (const [from, to] of edits) {
  if (!s.includes(from)) { console.log('Could not find: ' + from + ' - tell Claude'); process.exit(1); }
  s = s.replace(from, to);
}
fs.writeFileSync(file, s);
console.log('Added the map to ' + file);
