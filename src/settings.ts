/**
 * Star Icons — settings model: merge persisted data.json with defaults
 * (forward/backward compatible, never crashes on missing keys).
 */

import { DEFAULT_SETTINGS, StarIconsSettings } from "./types";

export function mergeSettings(raw: unknown): StarIconsSettings {
  const base: StarIconsSettings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;

  for (const key of Object.keys(base) as (keyof StarIconsSettings)[]) {
    const v = r[key];
    if (v === undefined || v === null) continue;
    const target = base[key];
    if (target && typeof target === "object" && !Array.isArray(target)) {
      // shallow-merge nested records (enabledPacks, overrides, fileTypeDefaults, iconTags)
      (base as unknown as Record<string, unknown>)[key] = { ...target, ...(v as object) };
    } else if (Array.isArray(target)) {
      const arr = Array.isArray(v) ? v : [];
      (base as unknown as Record<string, unknown>)[key] = arr.filter(
        (item) => item && typeof item === "object",
      );
    } else {
      (base as unknown as Record<string, unknown>)[key] = v;
    }
  }
  return base;
}
