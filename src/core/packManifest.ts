/**
 * Star Icons — pack inventory metadata (versions + icon counts).
 *
 * Two copies of this inventory exist at runtime:
 *
 *   • the **bundled** one, imported from the generated manifest.json and baked
 *     into main.js at build time, and
 *   • the **runtime** one, read from `packs/manifest.json` (shipped next to the
 *     plugin for manual installs, fetched once from the CDN for community ones).
 *
 * The bundled copy is the baseline so the settings list, the pack filter and the
 * icon-manager sidebar show real versions and counts immediately — and still do
 * when `packs/manifest.json` cannot be read at all (first run after a community
 * install while offline, a vault whose packs/ folder was cleared, a failed CDN
 * request). Those cases previously rendered every external pack as "v?" with
 * "0 icons", which reads as "this pack is empty" rather than "metadata
 * unavailable".
 */

export interface PackManifestEntry {
  version: string;
  count: number;
}

export interface PackManifest {
  packs: Record<string, PackManifestEntry>;
}

/**
 * Merge the runtime inventory over the bundled one. The runtime copy wins per
 * pack (it can be newer than main.js, e.g. a pack re-synced upstream), while
 * packs it does not mention keep their bundled entry.
 */
export function mergePackManifests(
  bundled: PackManifest | undefined,
  runtime: PackManifest | undefined,
): PackManifest {
  const packs: Record<string, PackManifestEntry> = { ...(bundled?.packs ?? {}) };
  for (const [id, entry] of Object.entries(runtime?.packs ?? {})) {
    if (entry && typeof entry.count === "number" && typeof entry.version === "string") {
      packs[id] = entry;
    }
  }
  return { packs };
}
