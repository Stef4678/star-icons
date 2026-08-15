/**
 * Star Icons — shared type definitions.
 */

export type PackId =
  | "lucide"
  | "material"
  | "star"
  | "tabler"
  | "unicons"
  | "remix"
  | "phosphor"
  | "bootstrap"
  | "animals"
  | "nature"
  | "science";

/** Every bundled pack, in display order (used by all dynamic UIs). */
export const ALL_PACKS: PackId[] = [
  "lucide",
  "material",
  "star",
  "tabler",
  "unicons",
  "remix",
  "phosphor",
  "bootstrap",
  "animals",
  "nature",
  "science",
];

export interface IconDef {
  /** Unique icon id used with setIcon/addIcon, e.g. "si-lucide-home". */
  id: string;
  /** Which pack this icon belongs to. */
  pack: PackId;
  /** Friendly icon name, e.g. "home". */
  name: string;
  /** Search keywords (derived from the name + pack). */
  tags: string[];
  /** Full svg markup string (used with addIcon and for previews). */
  svg: string;
}

export type ConditionType =
  | "filename"
  | "path"
  | "extension"
  | "folder"
  | "tag"
  | "property"
  | "heading"
  | "time";

export type CompareOp =
  | "equals"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "matches"
  | "isIn"
  | "isNotIn"
  | "exists"
  | "notExists";

export interface RuleCondition {
  id: string;
  type: ConditionType;
  op: CompareOp;
  /** Primary value (filename, path, extension, tag, heading…). */
  value?: string;
  /** Property condition: the property key. */
  key?: string;
  /** Time condition: allowed days of week, 0 (Sunday) – 6 (Saturday). */
  days?: number[];
  /** Time condition: start of the window, "HH:mm" (24h). */
  from?: string;
  /** Time condition: end of the window, "HH:mm" (24h). */
  to?: string;
}

export type RuleAction =
  | { type: "icon"; iconId: string }
  | { type: "random"; collectionId: string }
  | { type: "clear" };

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  /** Whether ALL conditions must match ("all") or ANY ("any"). */
  match: "all" | "any";
  conditions: RuleCondition[];
  action: RuleAction;
  createdAt: number;
}

export interface Collection {
  id: string;
  name: string;
  /** Icon ids (si-…), in display order. */
  iconIds: string[];
  createdAt: number;
}

export type ResolutionSource =
  | "override"
  | "rule"
  | "filetype"
  | "default"
  | "none";

export interface Resolution {
  iconId: string | null;
  source: ResolutionSource;
  /** Human-readable description of why this icon was chosen. */
  detail: string;
  /** Matched rule id, when source === "rule". */
  ruleId?: string;
}

export interface StarIconsSettings {
  /* --- General --- */
  fileExplorerIcons: boolean;
  tabIcons: boolean;
  inlineTitleIcons: boolean;
  inlineTitleEditMode: boolean;
  showSourceTooltips: boolean;
  statusBarIndicator: boolean;

  /* --- Packs --- */
  enabledPacks: Record<PackId, boolean>;

  /* --- Icon application --- */
  /** Vault-relative path -> icon id (manual overrides). */
  overrides: Record<string, string>;
  /** Ordered rules; first enabled match wins. */
  rules: Rule[];
  /** Extension (no dot) -> icon id. "*" is the fallback default. */
  fileTypeDefaults: Record<string, string | null>;
  defaultIcon: string | null;

  /* --- Library management --- */
  favoriteIconIds: string[];
  collections: Collection[];
  /** Icon id -> user-added tags. */
  iconTags: Record<string, string[]>;
  recentIconIds: string[];

  /* --- UI preferences --- */
  lastPackFilter: PackId | "all";
  iconGridDensity: "comfortable" | "compact";
}

export const DEFAULT_SETTINGS: StarIconsSettings = {
  fileExplorerIcons: true,
  tabIcons: true,
  inlineTitleIcons: false,
  inlineTitleEditMode: false,
  showSourceTooltips: true,
  statusBarIndicator: true,

  enabledPacks: {
    lucide: true,
    material: true,
    star: true,
    tabler: true,
    unicons: true,
    remix: true,
    phosphor: true,
    bootstrap: true,
    animals: true,
    nature: true,
    science: true,
  },

  overrides: {},
  rules: [],
  fileTypeDefaults: {},
  defaultIcon: null,

  favoriteIconIds: [],
  collections: [],
  iconTags: {},
  recentIconIds: [],

  lastPackFilter: "all",
  iconGridDensity: "comfortable",
};

export const PACK_LABELS: Record<PackId, string> = {
  lucide: "Lucide",
  material: "Material Symbols",
  star: "Star Icons",
  tabler: "Tabler",
  unicons: "Unicons",
  remix: "Remix Icon",
  phosphor: "Phosphor",
  bootstrap: "Bootstrap Icons",
  animals: "Animals",
  nature: "Nature & Flowers",
  science: "Science",
};

export const CONDITION_LABELS: Record<ConditionType, string> = {
  filename: "File name",
  path: "File path",
  extension: "Extension",
  folder: "Folder",
  tag: "Tag",
  property: "Property",
  heading: "Heading",
  time: "Time",
};

export const OP_LABELS: Record<CompareOp, string> = {
  equals: "is equal to",
  contains: "contains",
  startsWith: "starts with",
  endsWith: "ends with",
  matches: "matches regex",
  isIn: "is in",
  isNotIn: "is not in",
  exists: "exists",
  notExists: "does not exist",
};
