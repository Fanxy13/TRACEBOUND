// Prints rows whose width differs from the first row (authoring aid).
import { LEVELS } from '../src/levels/index.js';
let bad = 0;
for (const l of LEVELS) {
  const w = l.map[0].length;
  l.map.forEach((row, y) => { if (row.length !== w) { bad++; console.log(`${l.id} row ${y}: ${row.length} (expected ${w})  ${row}`); } });
}
console.log(bad ? `${bad} bad rows` : 'all rows ok');
