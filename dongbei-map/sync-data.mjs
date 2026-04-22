import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonPath = process.argv[2];

if (!jsonPath) {
  console.log('Usage: node sync-data.mjs <exported.json>');
  process.exit(1);
}

const data = JSON.parse(readFileSync(resolve(jsonPath), 'utf-8'));
const stamps = JSON.stringify(data.stamps || []);
const markers = JSON.stringify(data.customMarkers || []);
const vis = JSON.stringify(data.visualSettings || {});
const manualPos = JSON.stringify(data.manualPos || {});

const content = `// Auto-generated from exported JSON
export const DEFAULT_STAMPS = ${stamps};
export const DEFAULT_CUSTOM_MARKERS = ${markers};
export const DEFAULT_VISUAL_SETTINGS = ${vis};
export const DEFAULT_MANUAL_POS = ${manualPos};
`;

const outPath = resolve(__dirname, 'src/data/yanbian/userData.js');
writeFileSync(outPath, content, 'utf-8');
console.log(`Done! Updated userData.js`);
console.log(`  ${(data.stamps || []).length} stamps`);
console.log(`  ${(data.customMarkers || []).length} custom markers`);
console.log(`  manualPos keys: ${Object.keys(data.manualPos || {}).length}`);
