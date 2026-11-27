// Headless selftest stand-in; the actual terminal wrapping is supplied by OMP.
import { displayWidth, truncateToWidth } from "../../src/research/research-format.ts";

export function wrap(text: string, width: number): string[] {
  if (width <= 0) return [];
  const rows: string[] = [];
  for (const line of text.split("\n")) {
    if (displayWidth(line) <= width) {
      rows.push(line);
      continue;
    }
    let row = "";
    for (const word of line.split(" ")) {
      const next = row ? `${row} ${word}` : word;
      if (row && displayWidth(next) > width) {
        rows.push(truncateToWidth(row, width));
        row = word;
      } else {
        row = next;
      }
    }
    rows.push(truncateToWidth(row, width));
  }
  return rows;
}

