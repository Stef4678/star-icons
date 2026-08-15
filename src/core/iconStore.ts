/**
 * Star Icons — the library store.
 *
 * Owns favorites, recents, collections, user tags, search, and — since the
 * on-demand refactor — the async loading of external icon packs from the
 * plugin's packs/ folder (only enabled packs are read, keeping startup cost
 * flat no matter how many packs are shipped).
 */

import { addIcon, App, PluginManifest, normalizePath } from "obsidian";
import {
  ALL_ICONS,
  buildPackFromRaw,
  EXTERNAL_PACKS,
  getIcon,
  ICONS_BY_PACK,
  isCorePack,
  isPackMounted,
  mountPack,
  PACK_VERSIONS,
  RawPack,
} from "../data/icons";
import { ALL_PACKS, Collection, IconDef, PackId, StarIconsSettings } from "../types";
import { searchIcons, uid } from "../utils";

interface PackManifestEntry {
  version: string;
  count: number;
}

interface PackManifest {
  packs: Partial<Record<PackId, PackManifestEntry>>;
}

export class IconStore {
  private listeners = new Set<() => void>();
  private manifest: PackManifest = { packs: {} };
  private pending = new Map<PackId, Promise<void>>();

  constructor(
    private app: App,
    private getPluginManifest: () => PluginManifest,
    private getSettingsFn: () => StarIconsSettings,
    private save: () => Promise<void>,
  ) {}

  /* --- lifecycle -------------------------------------------------------- */

  /** Register every currently mounted icon with Obsidian's global registry. */
  registerIcons(): void {
    for (const icon of ALL_ICONS) {
      try {
        addIcon(icon.id, icon.svg);
      } catch {
        // Ignore duplicate/invalid registrations.
      }
    }
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  private async mutate(fn: (s: StarIconsSettings) => void): Promise<void> {
    fn(this.getSettingsFn());
    await this.save();
    this.notify();
  }

  /* --- pack loading ------------------------------------------------------ */

  private packDataPath(file: string): string {
    return normalizePath(
      `${this.app.vault.configDir}/plugins/${this.getPluginManifest().id}/packs/${file}`,
    );
  }

  private async readPackFile(file: string): Promise<unknown> {
    const text = await this.app.vault.adapter.read(this.packDataPath(file));
    return JSON.parse(text);
  }

  /** Load packs/manifest.json (versions + counts, no icon data). */
  async loadManifest(): Promise<void> {
    try {
      this.manifest = (await this.readPackFile("manifest.json")) as PackManifest;
    } catch (err) {
      console.warn("[Star Icons] could not read packs/manifest.json", err);
      this.manifest = { packs: {} };
    }
    this.notify();
  }

  /** Load and register one external pack (idempotent, awaitable). */
  loadPack(pack: PackId): Promise<void> {
    if (isCorePack(pack) || isPackMounted(pack)) return Promise.resolve();
    const inFlight = this.pending.get(pack);
    if (inFlight) return inFlight;

    const promise = (async () => {
      try {
        const raw = (await this.readPackFile(`${pack}.json`)) as RawPack;
        const defs = buildPackFromRaw(pack, raw);
        for (const d of defs) {
          try {
            addIcon(d.id, d.svg);
          } catch {
            /* duplicate or invalid — skip */
          }
        }
        mountPack(pack, defs);
      } catch (err) {
        console.warn(`[Star Icons] failed to load pack "${pack}"`, err);
      } finally {
        this.pending.delete(pack);
        this.notify();
      }
    })();
    this.pending.set(pack, promise);
    return promise;
  }

  /** Load every enabled external pack (fired at startup, non-blocking). */
  loadEnabledPacks(): Promise<void> {
    const s = this.getSettingsFn();
    const enabled = EXTERNAL_PACKS.filter((p) => s.enabledPacks[p] !== false);
    return Promise.allSettled(enabled.map((p) => this.loadPack(p))).then(() => undefined);
  }

  /* --- pack info ---------------------------------------------------------- */

  getPackInfo(pack: PackId): PackManifestEntry {
    return this.manifest.packs[pack] ?? { version: "?", count: 0 };
  }

  getPackCount(pack: PackId): number {
    if (isCorePack(pack)) return ICONS_BY_PACK[pack]?.length ?? 0;
    return this.manifest.packs[pack]?.count ?? ICONS_BY_PACK[pack]?.length ?? 0;
  }

  getPackVersion(pack: PackId): string {
    if (isCorePack(pack)) return PACK_VERSIONS[pack] ?? "1.0.0";
    return this.manifest.packs[pack]?.version ?? "?";
  }

  /** Total icons across enabled packs (from the manifest; no pack loading). */
  totalCount(): number {
    const s = this.getSettingsFn();
    return ALL_PACKS.reduce(
      (sum, p) => sum + (s.enabledPacks[p] !== false ? this.getPackCount(p) : 0),
      0,
    );
  }

  isPackLoaded(pack: PackId): boolean {
    return isPackMounted(pack);
  }

  isPackLoading(pack: PackId): boolean {
    return this.pending.has(pack);
  }

  /* --- query --- */

  /** Live settings access (read-only use; mutations go through mutate()). */
  getSettings(): StarIconsSettings {
    return this.getSettingsFn();
  }

  packEnabled(pack: PackId): boolean {
    return this.getSettingsFn().enabledPacks[pack] !== false;
  }

  availableIcons(): IconDef[] {
    const s = this.getSettingsFn();
    return ALL_ICONS.filter((i) => s.enabledPacks[i.pack] !== false);
  }

  search(query: string, packFilter: PackId | "all" = "all", limit = 300): IconDef[] {
    let icons = this.availableIcons();
    if (packFilter !== "all") icons = icons.filter((i) => i.pack === packFilter);
    return searchIcons(icons, query, limit);
  }

  /* --- favorites --- */

  isFavorite(id: string): boolean {
    return this.getSettingsFn().favoriteIconIds.includes(id);
  }

  async toggleFavorite(id: string): Promise<void> {
    await this.mutate((s) => {
      const i = s.favoriteIconIds.indexOf(id);
      if (i >= 0) s.favoriteIconIds.splice(i, 1);
      else s.favoriteIconIds.unshift(id);
    });
  }

  favoriteIcons(): IconDef[] {
    return this.getSettings()
      .favoriteIconIds.map(getIcon)
      .filter((i): i is IconDef => !!i);
  }

  /* --- recents --- */

  async pushRecent(id: string): Promise<void> {
    await this.mutate((s) => {
      s.recentIconIds = [id, ...s.recentIconIds.filter((x) => x !== id)].slice(0, 48);
    });
  }

  recentIcons(): IconDef[] {
    return this.getSettings()
      .recentIconIds.map(getIcon)
      .filter((i): i is IconDef => !!i);
  }

  /* --- collections --- */

  createCollection(name: string): Promise<Collection> {
    const col: Collection = {
      id: uid("col"),
      name,
      iconIds: [],
      createdAt: Date.now(),
    };
    return this.mutate((s) => s.collections.push(col)).then(() => col);
  }

  async renameCollection(id: string, name: string): Promise<void> {
    await this.mutate((s) => {
      const c = s.collections.find((x) => x.id === id);
      if (c) c.name = name;
    });
  }

  async deleteCollection(id: string): Promise<void> {
    await this.mutate((s) => {
      s.collections = s.collections.filter((c) => c.id !== id);
      for (const rule of s.rules) {
        if (rule.action.type === "random" && rule.action.collectionId === id) {
          rule.action = { type: "clear" };
        }
      }
    });
  }

  async addToCollection(collectionId: string, iconId: string): Promise<void> {
    await this.mutate((s) => {
      const c = s.collections.find((x) => x.id === collectionId);
      if (c && !c.iconIds.includes(iconId)) c.iconIds.push(iconId);
    });
  }

  async removeFromCollection(collectionId: string, iconId: string): Promise<void> {
    await this.mutate((s) => {
      const c = s.collections.find((x) => x.id === collectionId);
      if (c) c.iconIds = c.iconIds.filter((i) => i !== iconId);
    });
  }

  async moveInCollection(collectionId: string, from: number, to: number): Promise<void> {
    await this.mutate((s) => {
      const c = s.collections.find((x) => x.id === collectionId);
      if (!c || from < 0 || from >= c.iconIds.length) return;
      const [item] = c.iconIds.splice(from, 1);
      const clamped = Math.max(0, Math.min(to, c.iconIds.length));
      c.iconIds.splice(clamped, 0, item);
    });
  }

  collectionsContaining(iconId: string): Collection[] {
    return this.getSettings().collections.filter((c) => c.iconIds.includes(iconId));
  }

  /* --- tags --- */

  userTagsFor(iconId: string): string[] {
    return this.getSettings().iconTags[iconId] ?? [];
  }

  allUserTags(): string[] {
    const set = new Set<string>();
    for (const tags of Object.values(this.getSettings().iconTags)) {
      for (const t of tags) set.add(t);
    }
    return Array.from(set).sort();
  }

  async addUserTag(iconId: string, tag: string): Promise<void> {
    const t = tag.trim().toLowerCase().replace(/\s+/g, "-");
    if (!t) return;
    await this.mutate((s) => {
      s.iconTags[iconId] = s.iconTags[iconId] ?? [];
      if (!s.iconTags[iconId].includes(t)) s.iconTags[iconId].push(t);
    });
  }

  async removeUserTag(iconId: string, tag: string): Promise<void> {
    await this.mutate((s) => {
      s.iconTags[iconId] = (s.iconTags[iconId] ?? []).filter((t) => t !== tag);
    });
  }

  async renameUserTag(oldTag: string, newTag: string): Promise<void> {
    const t = newTag.trim().toLowerCase().replace(/\s+/g, "-");
    if (!t || t === oldTag) return;
    await this.mutate((s) => {
      for (const key of Object.keys(s.iconTags)) {
        s.iconTags[key] = s.iconTags[key].map((x) => (x === oldTag ? t : x));
      }
    });
  }
}
