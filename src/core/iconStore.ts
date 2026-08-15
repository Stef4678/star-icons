/**
 * Star Icons — the library store.
 *
 * Owns favorites, recents, collections, user tags and search over the bundled
 * packs. Every mutation persists through the plugin and notifies subscribers
 * so open pickers/views can re-render live.
 */

import { addIcon } from "obsidian";
import { ALL_ICONS, getIcon } from "../data/icons";
import { Collection, IconDef, PackId, StarIconsSettings } from "../types";
import { searchIcons, uid } from "../utils";

export class IconStore {
  private listeners = new Set<() => void>();

  constructor(
    private getSettingsFn: () => StarIconsSettings,
    private save: () => Promise<void>,
  ) {}

  /* --- lifecycle --- */

  /** Register every bundled icon with Obsidian's global icon registry. */
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
    fn(this.getSettings());
    await this.save();
    this.notify();
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

  countPerPack(): Record<PackId, number> {
    const s = this.getSettingsFn();
    const out: Record<PackId, number> = { lucide: 0, material: 0, star: 0 };
    for (const i of ALL_ICONS) if (s.enabledPacks[i.pack] !== false) out[i.pack]++;
    return out;
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
