// One-off probe: what do real embers look like in rgb, vs the title strokes?
// Prints pixel patches and candidate blob colors for chosen frames.
import {frames, lumaOf} from './reader.mjs';

const targets = new Map([
  // frame → spots eyeballed on the extracted PNGs: [label, x, y]
  [90, [
    ['firefly-under-D', 500, 545],
    ['firefly-right-of-k', 745, 640],
    ['firefly-mid', 540, 880],
    ['title-stroke', 430, 380],
  ]],
  [210, [
    ['blue-spark-1', 385, 690],
    ['blue-spark-2', 512, 553],
    ['title-stroke', 430, 380],
  ]],
]);

for await (const {index, data} of frames({pixFmt: 'rgb24'})) {
  const spots = targets.get(index);
  if (!spots) {
    if (index > 210) break;
    continue;
  }
  console.log(`\n=== frame ${index} ===`);
  for (const [label, cx, cy] of spots) {
    // Find the brightest pixel within ±12 of the eyeballed spot, then print
    // its 3-value and the 5×5 luma around it.
    let best = 0;
    let bx = cx;
    let by = cy;
    for (let y = cy - 12; y <= cy + 12; y += 1) {
      for (let x = cx - 12; x <= cx + 12; x += 1) {
        const l = lumaOf(data, 3 * (y * 1080 + x));
        if (l > best) {
          best = l;
          bx = x;
          by = y;
        }
      }
    }
    const i = 3 * (by * 1080 + bx);
    const row = [];
    for (let x = bx - 3; x <= bx + 3; x += 1) {
      row.push(String(lumaOf(data, 3 * (by * 1080 + x))).padStart(3));
    }
    console.log(
      `${label.padEnd(18)} peak@(${bx},${by}) rgb=(${data[i]},${data[i + 1]},${data[i + 2]}) luma=${best} row: ${row.join(' ')}`,
    );
  }
}
