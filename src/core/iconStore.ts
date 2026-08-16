/**
 * Star Icons — the library store.
 *
 * Owns favorites, recents, collections, user tags, search, and — since the
 * on-demand refactor — the async loading of external icon packs from the
 * plugin's packs/ folder (only enabled packs are read, keeping startup cost
 * flat no matter how many packs are shipped).
 */

import { addIcon, App, normalizePath, PluginManifest, requestUrl } from "obsidian";
import {
  ALL_ICONS,
  buildPackFromRaw,
  buildUserIconDefs,
  EXTERNAL_PACKS,
  getIcon,
  ICONS_BY_PACK,
  isCorePack,
  isPackMounted,
  mountPack,
  mountUserPack,
  PACK_VERSIONS,
  RawPack,
} from "../data/icons";
import { ALL_PACKS, Collection, IconDef, PackId, StarIconsSettings, UserIcon } from "../types";
import { ensureSvg, searchIcons, slugifyName, uid } from "../utils";

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

  /** Re-render open views (called after settings/library changes). */
  notify(): void {
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

  /**
   * Read a pack data file. The `packs/` folder ships with the repo and with
   * manual installs, but Obsidian's community installer only downloads
   * main.js, styles.css and manifest.json — so when the local file is missing
   * the pack is fetched from the CDN (which serves the committed
   * src/data/generated/*.json at the plugin's release tag) and cached into
   * `packs/` for offline reuse on later loads.
   */
  private async readPackFile(file: string): Promise<unknown> {
    try {
      const text = await this.app.vault.adapter.read(this.packDataPath(file));
      return JSON.parse(text);
    } catch (localErr) {
      try {
        const text = await this.fetchPackFromCdn(file);
        await this.cachePackFile(file, text);
        return JSON.parse(text);
      } catch (cdnErr) {
        console.warn(`[Star Icons] pack data unavailable for "${file}"`, localErr, cdnErr);
        throw new Error(`pack data unavailable: ${file}`);
      }
    }
  }

  /** jsDelivr URL for a pack data file at the plugin's release tag. */
  private packCdnUrl(file: string): string {
    const version = encodeURIComponent(this.getPluginManifest().version);
    return `https://cdn.jsdelivr.net/gh/Stef4678/star-icons@${version}/src/data/generated/${encodeURIComponent(file)}`;
  }

  private async fetchPackFromCdn(file: string): Promise<string> {
    const url = this.packCdnUrl(file);
    const res = await requestUrl({ url, method: "GET" });
    if (res.status === 200) return res.text;
    // Release tags should match manifest.json's version, but a "v"-prefixed
    // tag or an untagged dev build would 404 — fall back to the default
    // branch so packs still load.
    if (res.status === 404) {
      const fallback = await requestUrl({
        url: `https://cdn.jsdelivr.net/gh/Stef4678/star-icons@main/src/data/generated/${encodeURIComponent(file)}`,
        method: "GET",
      });
      if (fallback.status === 200) return fallback.text;
      throw new Error(`CDN returned HTTP ${fallback.status} for ${file}`);
    }
    throw new Error(`CDN returned HTTP ${res.status} for ${file}`);
  }

  /** Persist a downloaded pack into the plugin's packs/ folder. */
  private async cachePackFile(file: string, content: string): Promise<void> {
    const adapter = this.app.vault.adapter;
    const dir = normalizePath(
      `${this.app.vault.configDir}/plugins/${this.getPluginManifest().id}/packs`,
    );
    try {
      await adapter.mkdir(dir);
    } catch {
      // packs/ already exists
    }
    await adapter.write(normalizePath(`${dir}/${file}`), content);
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

  /** Enable a pack in settings and load it immediately (used by the UI). */
  async enablePack(pack: PackId): Promise<void> {
    const s = this.getSettingsFn();
    if (s.enabledPacks[pack] === true && isPackMounted(pack)) return;
    s.enabledPacks[pack] = true;
    await this.save();
    await this.loadPack(pack);
    this.notify();
  }

  /** Disable a pack (icons stay cached, so re-enabling is instant). */
  async disablePack(pack: PackId): Promise<void> {
    const s = this.getSettingsFn();
    if (s.enabledPacks[pack] === false) return;
    s.enabledPacks[pack] = false;
    await this.save();
    this.notify();
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
    const sum = ALL_PACKS.reduce(
      (acc, p) => acc + (s.enabledPacks[p] !== false ? this.getPackCount(p) : 0),
      0,
    );
    return sum + s.userIcons.length;
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

  /* --- user icons ("My Icons" pack) --------------------------------------- */

  userIcons(): UserIcon[] {
    return this.getSettingsFn().userIcons;
  }

  /** Register + mount the user icons from settings (called at startup). */
  mountUserIcons(): void {
    const defs = buildUserIconDefs(this.userIcons());
    for (const d of defs) {
      try {
        addIcon(d.id, d.svg);
      } catch {
        /* skip duplicates */
      }
    }
    mountUserPack(defs);
  }

  /** Import one or more user SVGs; returns how many were added. */
  async addUserIcons(entries: { name: string; svg: string }[]): Promise<number> {
    if (!entries.length) return 0;
    let added = 0;
    await this.mutate((s) => {
      const existing = new Set(s.userIcons.map((u) => u.name));
      for (const e of entries) {
        let name = slugifyName(e.name);
        if (!name) name = "icon";
        let candidate = name;
        let n = 2;
        while (existing.has(candidate)) candidate = `${name}-${n++}`;
        existing.add(candidate);
        s.userIcons.push({ name: candidate, svg: ensureSvg(e.svg) });
        added++;
      }
    });
    this.mountUserIcons();
    return added;
  }

  /** Delete one user icon by its icon id ("si-user-<name>"). */
  async removeUserIcon(id: string): Promise<void> {
    const name = id.replace(/^si-user-/, "");
    await this.mutate((s) => {
      s.userIcons = s.userIcons.filter((u) => u.name !== name);
    });
    this.mountUserIcons();
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

  /** Delete a user tag from every icon that has it. */
  async deleteUserTag(tag: string): Promise<void> {
    await this.mutate((s) => {
      for (const key of Object.keys(s.iconTags)) {
        s.iconTags[key] = s.iconTags[key].filter((t) => t !== tag);
      }
    });
  }

  /** Remove every user tag from every icon. */
  async clearAllUserTags(): Promise<void> {
    await this.mutate((s) => {
      s.iconTags = {};
    });
  }
}
