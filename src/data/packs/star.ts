/**
 * Star Icons — the custom "star" pack.
 *
 * Hand-authored, original 24×24 stroke-based icons (Lucide style) that are
 * bundled into the plugin and registered with Obsidian's addIcon().
 * Each entry stores the INNER svg markup; the stroke shell (fill="none",
 * stroke="currentColor", stroke-width 2, round caps) is applied in icons.ts.
 */

export interface StarIconDef {
  name: string;
  svg: string;
  viewBox: string;
  tags: string[];
}

export const STAR_ICONS: StarIconDef[] = [
  {
    name: "star-sparkle",
    tags: ["star", "sparkle", "brand", "logo"],
    viewBox: "0 0 24 24",
    svg: `
    <path d="M12 2.8l2.1 4.6 5 .7-3.6 3.5.9 5-4.4-2.3-4.4 2.3.9-5-3.6-3.5 5-.7L12 2.8z"/>
    <path d="M18.5 3.5l.4.9.9.4-.9.4-.4.9-.4-.9-.9-.4.9-.4.4-.9z" fill="currentColor" stroke="none"/>
    <path d="M6 16l.5 1.1 1.1.5-1.1.5L6 19.2l-.5-1.1-1.1-.5 1.1-.5L6 16z" fill="currentColor" stroke="none"/>`.trim(),
  },
  {
    name: "star-filled",
    tags: ["star", "filled", "solid", "rating"],
    viewBox: "0 0 24 24",
    svg: `
    <path d="M12 2.6l2.9 5.9 6.5 1-4.7 4.6 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-1L12 2.6z" fill="currentColor" stroke="none"/>`.trim(),
  },
  {
    name: "star-badge",
    tags: ["star", "badge", "medal", "award"],
    viewBox: "0 0 24 24",
    svg: `
    <circle cx="12" cy="12" r="8.5"/>
    <path d="M12 6.8l1.7 3.4 3.8.5-2.7 2.7.6 3.8L12 15.7l-3.4 1.5.6-3.8-2.7-2.7 3.8-.5L12 6.8z"/>`.trim(),
  },
  {
    name: "star-cross",
    tags: ["star", "cross", "compass", "rose", "navigation"],
    viewBox: "0 0 24 24",
    svg: `
    <path d="M12 2.5v19M2.5 12h19M5.3 5.3l13.4 13.4M18.7 5.3L5.3 18.7"/>
    <path d="M12 2.5L13.5 10.5 21.5 12 13.5 13.5 12 21.5 10.5 13.5 2.5 12 10.5 10.5 12 2.5z"/>`.trim(),
  },
  {
    name: "comet",
    tags: ["comet", "space", "star", "tail"],
    viewBox: "0 0 24 24",
    svg: `
    <circle cx="16.5" cy="7.5" r="4.2"/>
    <path d="M2.5 21.5c4.5-6.5 9-10.5 13-12.5"/>
    <path d="M2.5 21.5c5-.5 9.5-2 12.5-4.5"/>
    <path d="M2.5 21.5c4-3 7-4.5 10-5.5"/>`.trim(),
  },
  {
    name: "constellation",
    tags: ["constellation", "stars", "space", "connect"],
    viewBox: "0 0 24 24",
    svg: `
    <path d="M5 5l4 3-2 5 4 2"/>
    <path d="M11 15l6-9"/>
    <path d="M19 12l-8 3"/>
    <circle cx="5" cy="5" r="1.7"/>
    <circle cx="9" cy="8" r="1.7"/>
    <circle cx="7" cy="13" r="1.7"/>
    <circle cx="11" cy="15" r="1.7"/>
    <circle cx="17" cy="6" r="1.7"/>
    <circle cx="19" cy="12" r="1.7"/>`.trim(),
  },
  {
    name: "galaxy",
    tags: ["galaxy", "space", "spiral", "cosmos"],
    viewBox: "0 0 24 24",
    svg: `
    <path d="M12 3a9 9 0 0 1 9 9 6.5 6.5 0 0 1-6.5 6.5A4.5 4.5 0 0 1 10 14a3 3 0 0 1 3-3"/>
    <path d="M3 12a9 9 0 0 0 9 9 6 6 0 0 0 6-6"/>
    <circle cx="7.5" cy="6.5" r="0.7" fill="currentColor" stroke="none"/>
    <circle cx="17" cy="17.5" r="0.7" fill="currentColor" stroke="none"/>
    <circle cx="5" cy="15.5" r="0.7" fill="currentColor" stroke="none"/>`.trim(),
  },
  {
    name: "orbit",
    tags: ["orbit", "satellite", "space", "orbit"],
    viewBox: "0 0 24 24",
    svg: `
    <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(-24 12 12)"/>
    <circle cx="12" cy="12" r="2.2"/>
    <circle cx="19.8" cy="9.6" r="1.5"/>
    <path d="M4.5 14.5c-.8 2.5-.3 4.8 1.5 6" opacity="0.5"/>`.trim(),
  },
  {
    name: "shooting-star",
    tags: ["shooting", "star", "falling", "wish"],
    viewBox: "0 0 24 24",
    svg: `
    <path d="M19 5.5L6.5 18"/>
    <path d="M19 5.5l-5.6.8 4.8 4.8.8-5.6z"/>
    <path d="M14 14.5c-2.5 2.5-5.5 4-9 4.5"/>
    <path d="M3.5 19c.7-1.5 1.7-2.7 3-3.5"/>`.trim(),
  },
  {
    name: "nova",
    tags: ["nova", "star", "burst", "explosion", "flash"],
    viewBox: "0 0 24 24",
    svg: `
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>
    <path d="M12 7.2l1.4 2.9 3.2.5-2.3 2.3.6 3.2L12 14.6l-2.9 1.5.6-3.2-2.3-2.3 3.2-.5L12 7.2z"/>`.trim(),
  },
  {
    name: "satellite",
    tags: ["satellite", "space", "antenna", "signal"],
    viewBox: "0 0 24 24",
    svg: `
    <rect x="7.5" y="7.5" width="9" height="9" rx="1.5"/>
    <path d="M10.5 4.5h3M12 4.5V3"/>
    <path d="M4.5 10.5h-1.5M4.5 13.5h-1.5M19.5 10.5h1.5M19.5 13.5h1.5"/>
    <path d="M9 13.5l3 3 3-3"/>`.trim(),
  },
  {
    name: "meteor",
    tags: ["meteor", "space", "fire", "falling"],
    viewBox: "0 0 24 24",
    svg: `
    <circle cx="15" cy="9" r="4.5"/>
    <path d="M15 4.5V3"/>
    <path d="M12.2 6.2L10.5 4.5"/>
    <path d="M17.8 6.2L19.5 4.5"/>
    <path d="M10 12.5c-3.5 2.5-6 5-7 8"/>
    <path d="M10.5 13.5c-2.8 2-4.5 4-5 6.5"/>`.trim(),
  },
  {
    name: "star-wand",
    tags: ["wand", "magic", "star", "sparkle"],
    viewBox: "0 0 24 24",
    svg: `
    <path d="M15 4l5 5-3.5 3.5-5-5L15 4z"/>
    <path d="M13.5 5.5L5 14v5h5l8.5-8.5"/>
    <path d="M8 5.5l.6 1.4 1.4.6-1.4.6L8 9.5l-.6-1.4L6 7.5l1.4-.6L8 5.5z" fill="currentColor" stroke="none"/>`.trim(),
  },
  {
    name: "supernova",
    tags: ["supernova", "star", "rings", "explosion"],
    viewBox: "0 0 24 24",
    svg: `
    <circle cx="12" cy="12" r="2.2"/>
    <path d="M12 2.5l1.3 2.7 3 .4-2.2 2.1.5 3-2.6-1.4-2.6 1.4.5-3-2.2-2.1 3-.4L12 2.5z"/>
    <circle cx="12" cy="12" r="6" opacity="0.6"/>
    <circle cx="12" cy="12" r="9.5" opacity="0.35"/>`.trim(),
  },
];
