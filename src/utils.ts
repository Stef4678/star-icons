/**
 * Star Icons — small, dependency-free helpers.
 */

import { IconDef } from "./types";

let uidCounter = 0;

/** Generate a reasonably unique id. */
export function uid(prefix = "id"): string {
  uidCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${uidCounter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

/** djb2 string hash (stable across runs — used for deterministic "random"). */
export function hashString(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i);
  }
  return h >>> 0;
}

/** Deterministic index into a list of size n for a given key. */
export function stableIndex(key: string, n: number): number {
  if (n <= 0) return 0;
  return hashString(key) % n;
}

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): (...args: A) => void {
  let t: number | null = null;
  return (...args: A) => {
    if (t !== null) window.clearTimeout(t);
    t = window.setTimeout(() => {
      t = null;
      fn(...args);
    }, ms);
  };
}

/**
 * Fuzzy score of `query` inside `text` (subsequence matching).
 * Returns a non-negative score; 0 means no match. Higher is better.
 */
export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 1;
  if (t.includes(q)) return 100 + (t.length - q.length) * -1;
  let qi = 0;
  let score = 0;
  let streak = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      streak++;
      score += 2 + streak;
    } else {
      streak = 0;
      score -= 1;
    }
  }
  return qi === q.length ? Math.max(1, score) : 0;
}

/** Search icons by query across name + tags; returns scored, sorted results. */
export function searchIcons(
  icons: IconDef[],
  query: string,
  limit = 200,
): IconDef[] {
  const q = query.trim();
  if (!q) return icons.slice(0, limit);
  const scored: { icon: IconDef; score: number }[] = [];
  for (const icon of icons) {
    const nameScore = fuzzyScore(q, icon.name.replace(/[-_]/g, " "));
    let score: number;
    if (nameScore > 0) {
      // Name matches always outrank tag-only matches.
      score = nameScore + 10000;
    } else {
      score = 0;
      for (const tag of icon.tags) {
        const s = fuzzyScore(q, tag);
        if (s > score) score = s;
      }
    }
    if (score > 0) scored.push({ icon, score });
  }
  scored.sort((a, b) => b.score - a.score || a.icon.name.localeCompare(b.icon.name));
  return scored.slice(0, limit).map((s) => s.icon);
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Trigger a browser download of a JSON payload (export feature). */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Parse "HH:mm" into minutes since midnight; null when invalid. */
export function parseMinutes(value: string | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function toMinutes(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** Simple regex validity check (avoids throwing inside the rule engine). */
export function isValidRegex(value: string): boolean {
  try {
    new RegExp(value);
    return true;
  } catch {
    return false;
  }
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Normalize a file extension to lowercase without the dot. */
export function normalizeExt(ext: string): string {
  return ext.trim().toLowerCase().replace(/^\./, "");
}

/** Slugify a user-provided icon name ("My Icon!" -> "my-icon"). */
export function slugifyName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Ensure user-provided SVG text is a full <svg> element. */
export function ensureSvg(text: string): string {
  const t = text.trim();
  if (/<svg[\s>]/i.test(t)) return t;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${t}</svg>`;
}

/**
 * Version of an SVG meant for pasting into notes/clipboard: adds an explicit
 * width/height so it doesn't blow up to the container width when rendered
 * inline in markdown. (Obsidian sizes its own icon slots via CSS, so the
 * attributes don't affect file-explorer/ribbon rendering.)
 */
export function svgForClipboard(svg: string, size = 24): string {
  if (/\swidth=|\sheight=/i.test(svg)) return svg;
  return svg.replace(/^<svg/i, `<svg width="${size}" height="${size}"`);
}
