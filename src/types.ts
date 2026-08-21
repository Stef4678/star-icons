/**
 * Star Icons — shared type definitions.
 */

/**
 * Every bundled pack id (including the special "user" pack for imported
 * icons). ALL_PACKS is the canonical, display-ordered list; PackId is derived
 * from it so "PackId | 'all'" stays a meaningful union instead of collapsing
 * to plain `string`.
 */
export type PackId = (typeof ALL_PACKS)[number] | "user";

/** Every bundled pack, in display order (used by all dynamic UIs). */
export const ALL_PACKS = [
  "lucide",
  "material",
  "material-outlined",
  "material-sharp",
  "star",
  "tabler",
  "tabler-filled",
  "unicons",
  "unicons-solid",
  "unicons-monochrome",
  "unicons-thinline",
  "remix",
  "phosphor",
  "phosphor-bold",
  "phosphor-fill",
  "phosphor-light",
  "phosphor-thin",
  "phosphor-duotone",
  "bootstrap",
  "boxicons",
  "boxicons-solid",
  "boxicons-logos",
  "heroicons",
  "heroicons-solid",
  "fontawesome",
  "simple-icons",
  "ionicons",
  "antd",
  "line-awesome",
  "eva",
  "octicons",
  "openmoji",
  "openmoji-black",
  "twemoji",
  "fluent",
  "animals",
  "nature",
  "science",
] as const;

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

/** A user-imported icon (the "My Icons" pack). */
export interface UserIcon {
  /** Unique slug used in the icon id ("si-user-<name>"). */
  name: string;
  /** Full svg markup string. */
  svg: string;
  tags?: string[];
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
  /** Missing key = enabled (see DEFAULT_SETTINGS for the on-by-default set). */
  enabledPacks: Partial<Record<PackId, boolean>>;

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
  /** User-imported icons (the "My Icons" pack). */
  userIcons: UserIcon[];

  /* --- UI preferences --- */
  lastPackFilter: PackId | "all";
  iconGridDensity: "comfortable" | "compact";
  /** Optional URL for the "Report a bug" dialog's issue link. */
  reportUrl: string;
}

/** Default bug-report target (override in Settings → Data). */
export const DEFAULT_REPORT_URL = "https://github.com/Stef4678/star-icons/issues";

export const DEFAULT_SETTINGS: StarIconsSettings = {
  fileExplorerIcons: true,
  tabIcons: true,
  inlineTitleIcons: false,
  inlineTitleEditMode: false,
  showSourceTooltips: true,
  statusBarIndicator: true,

  enabledPacks: {
    // Core library — on by default.
    lucide: true,
    material: true,
    star: true,
    tabler: true,
    "tabler-filled": true,
    unicons: true,
    remix: true,
    phosphor: true,
    bootstrap: true,
    boxicons: true,
    heroicons: true,
    openmoji: true,
    animals: true,
    nature: true,
    science: true,
    // Extended packs — opt-in so startup stays fast.
    "material-outlined": false,
    "material-sharp": false,
    "phosphor-bold": false,
    "phosphor-fill": false,
    "phosphor-light": false,
    "phosphor-thin": false,
    "phosphor-duotone": false,
    "unicons-solid": false,
    "unicons-monochrome": false,
    "unicons-thinline": false,
    "boxicons-solid": false,
    "boxicons-logos": false,
    "heroicons-solid": false,
    "openmoji-black": false,
    fontawesome: false,
    "simple-icons": false,
    ionicons: false,
    antd: false,
    "line-awesome": false,
    eva: false,
    octicons: false,
    twemoji: false,
    fluent: false,
  },

  overrides: {},
  rules: [],
  fileTypeDefaults: {},
  defaultIcon: null,

  favoriteIconIds: [],
  collections: [],
  iconTags: {},
  recentIconIds: [],
  userIcons: [],

  lastPackFilter: "all",
  iconGridDensity: "comfortable",
  reportUrl: DEFAULT_REPORT_URL,
};

export const PACK_LABELS: Record<PackId, string> = {
  lucide: "Lucide",
  material: "Material Symbols",
  "material-outlined": "Material Outlined",
  "material-sharp": "Material Sharp",
  star: "Star Icons",
  tabler: "Tabler",
  "tabler-filled": "Tabler Filled",
  unicons: "Unicons",
  "unicons-solid": "Unicons Solid",
  "unicons-monochrome": "Unicons Mono",
  "unicons-thinline": "Unicons Thinline",
  remix: "Remix Icon",
  phosphor: "Phosphor",
  "phosphor-bold": "Phosphor Bold",
  "phosphor-fill": "Phosphor Fill",
  "phosphor-light": "Phosphor Light",
  "phosphor-thin": "Phosphor Thin",
  "phosphor-duotone": "Phosphor Duotone",
  bootstrap: "Bootstrap Icons",
  boxicons: "Boxicons",
  "boxicons-solid": "Boxicons Solid",
  "boxicons-logos": "Boxicons Logos",
  heroicons: "Heroicons",
  "heroicons-solid": "Heroicons Solid",
  fontawesome: "Font Awesome",
  "simple-icons": "Simple Icons",
  ionicons: "Ionicons",
  antd: "Ant Design",
  "line-awesome": "Line Awesome",
  eva: "Eva Icons",
  octicons: "Octicons",
  openmoji: "OpenMoji Color",
  "openmoji-black": "OpenMoji Mono",
  twemoji: "Twemoji",
  fluent: "Fluent Emoji",
  animals: "Animals",
  nature: "Nature & Flowers",
  science: "Science",
  user: "My Icons",
};

/** One sample icon name per pack (used for previews; missing ones are skipped). */
export const PACK_SAMPLE_ICON: Record<string, string> = {
  star: "star-sparkle",
  lucide: "sparkles",
  material: "home",
  "material-outlined": "home",
  "material-sharp": "home",
  tabler: "layout-grid",
  "tabler-filled": "home",
  unicons: "apps",
  "unicons-solid": "home",
  "unicons-monochrome": "home",
  "unicons-thinline": "home",
  remix: "home-line",
  phosphor: "house",
  "phosphor-bold": "house-bold",
  "phosphor-fill": "house-fill",
  "phosphor-light": "house-light",
  "phosphor-thin": "house-thin",
  "phosphor-duotone": "house-duotone",
  bootstrap: "house",
  boxicons: "home",
  "boxicons-solid": "home",
  "boxicons-logos": "github",
  heroicons: "home",
  "heroicons-solid": "home",
  fontawesome: "house",
  "simple-icons": "github",
  ionicons: "home",
  antd: "home-outlined",
  "line-awesome": "home",
  eva: "home-outline",
  octicons: "home-16",
  openmoji: "grinning-face",
  "openmoji-black": "grinning-face",
  twemoji: "grinning-face",
  fluent: "smiling-face",
  animals: "dog",
  nature: "rose",
  science: "microscope",
};

export interface PackGroup {
  title: string;
  packs: PackId[];
  /** Start expanded in Settings (default: collapsed). */
  open?: boolean;
}

/** Logical groupings used by the pack dropdown and the settings list. */
export const PACK_GROUPS: PackGroup[] = [
  {
    title: "Essentials · on by default",
    open: true,
    packs: [
      "lucide",
      "material",
      "star",
      "tabler",
      "tabler-filled",
      "unicons",
      "remix",
      "phosphor",
      "bootstrap",
      "boxicons",
      "heroicons",
      "openmoji",
      "animals",
      "nature",
      "science",
    ],
  },
  {
    title: "More icon sets",
    open: true,
    packs: [
      "fontawesome",
      "simple-icons",
      "ionicons",
      "antd",
      "line-awesome",
      "eva",
      "octicons",
      "twemoji",
      "fluent",
    ],
  },
  {
    title: "Weights & variants",
    open: false,
    packs: [
      "material-outlined",
      "material-sharp",
      "phosphor-bold",
      "phosphor-fill",
      "phosphor-light",
      "phosphor-thin",
      "phosphor-duotone",
      "unicons-solid",
      "unicons-monochrome",
      "unicons-thinline",
      "boxicons-solid",
      "boxicons-logos",
      "heroicons-solid",
      "openmoji-black",
    ],
  },
];

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
