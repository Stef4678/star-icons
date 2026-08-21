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
  | { type: "icon"; iconId: string; color?: string }
  | { type: "random"; collectionId: string; color?: string }
  | { type: "randomDataview"; dataviewCollectionId: string; color?: string }
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

/**
 * A dynamic collection backed by a Dataview query. The query's rows are
 * expected to carry icon ids (either the row value itself, or a frontmatter
 * property on each page — see `iconProperty`). Results are cached by the
 * plugin and refreshed on vault/settings changes, so rules can pick
 * "random from dataview" icons deterministically per file.
 */
export interface DataviewCollection {
  id: string;
  name: string;
  /** Dataview DQL query (LIST or TABLE). */
  query: string;
  /** Frontmatter property holding the icon id (default "icon"). */
  iconProperty: string;
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
  /**
   * CSS color to tint the icon with ("#e93147", "var(--color-red)", …).
   * Absent/undefined = keep the theme default color. Only meaningful when
   * iconId is set; full-color packs (emoji) ignore it.
   */
  color?: string | null;
}

/**
 * Preset swatches for the color palette. Chosen to stay legible on both
 * Obsidian's light and dark themes (mid-brightness hues).
 */
export const ICON_COLOR_PALETTE: string[] = [
  "#e93147", // red
  "#ff7a45", // orange
  "#f5b301", // gold (brand)
  "#e5c07b", // sand
  "#98c379", // green
  "#0bbf7a", // emerald
  "#40c4ff", // cyan
  "#61dafb", // sky
  "#3b82f6", // blue
  "#7289da", // indigo
  "#a78bfa", // violet
  "#c678dd", // purple
  "#f472b6", // pink
  "#ff6b81", // rose
  "#d29922", // dark gold
  "#8b949e", // gray
];

/* --- Soundscapes -------------------------------------------------------- */

/**
 * The kinds of sounds the engine can play. Icon-specific kinds are derived
 * from an icon's name (star -> twinkle, trash -> crash, bell -> ding,
 * dog -> bark, cat -> meow, …); `click`/`select`/`transition` are the
 * interaction sounds (hover, pick, automatic icon change).
 */
export type SoundKind =
  | "click"
  | "select"
  | "transition"
  | "twinkle"
  | "crash"
  | "ding"
  | "pop"
  | "chime"
  | "bark"
  | "meow"
  | "roar"
  | "chatter"
  | "chirp"
  | "cluck"
  | "quack"
  | "hoot"
  | "moo"
  | "neigh"
  | "oink"
  | "baa"
  | "ribbit"
  | "squeak"
  | "buzz"
  | "trumpet"
  | "howl";

/** Built-in sound packs (synthesis presets). */
export type SoundPackId = "8bit" | "cinematic" | "minimal";

export const SOUND_PACKS: { id: SoundPackId; label: string; desc: string }[] = [
  { id: "8bit", label: "8-bit", desc: "Square-wave bleeps — retro arcade vibes." },
  { id: "cinematic", label: "Cinematic", desc: "Soft, spacious tones with a subtle echo." },
  { id: "minimal", label: "Minimal", desc: "Quiet sine blips — barely there." },
];

/** Display groups for the custom-sounds list in Settings. */
export const SOUND_KIND_GROUPS: { title: string; kinds: SoundKind[] }[] = [
  {
    title: "Interactions",
    kinds: ["click", "select", "transition"],
  },
  {
    title: "Themed",
    kinds: ["twinkle", "crash", "ding", "pop", "chime"],
  },
  {
    title: "Animals",
    kinds: [
      "bark",
      "meow",
      "roar",
      "howl",
      "chatter",
      "chirp",
      "cluck",
      "quack",
      "hoot",
      "moo",
      "neigh",
      "oink",
      "baa",
      "ribbit",
      "squeak",
      "buzz",
      "trumpet",
    ],
  },
];

/** Every interaction/icon sound kind, in display order. */
export const SOUND_KIND_ORDER: SoundKind[] = SOUND_KIND_GROUPS.flatMap((g) => g.kinds);

export const SOUND_KIND_LABELS: Record<SoundKind, string> = {
  click: "Hover",
  select: "Click / select",
  transition: "Icon change",
  twinkle: "Twinkle (stars)",
  crash: "Crash (trash)",
  ding: "Ding (bells)",
  pop: "Pop (add)",
  chime: "Chime (hearts)",
  bark: "Bark (dogs)",
  meow: "Meow (cats)",
  roar: "Roar (lions, tigers, bears)",
  howl: "Howl (wolves)",
  chatter: "Chatter (monkeys)",
  chirp: "Chirp (songbirds)",
  cluck: "Cluck (chickens)",
  quack: "Quack (ducks)",
  hoot: "Hoot (owls)",
  moo: "Moo (cows)",
  neigh: "Neigh (horses)",
  oink: "Oink (pigs)",
  baa: "Baa (sheep)",
  ribbit: "Ribbit (frogs)",
  squeak: "Squeak (mice, hamsters)",
  buzz: "Buzz (bees, flies)",
  trumpet: "Trumpet (elephants)",
};

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
  /** Vault-relative path -> CSS color tint for that override's icon. */
  overrideColors: Record<string, string>;
  /** Ordered rules; first enabled match wins. */
  rules: Rule[];
  /** Extension (no dot) -> icon id. "*" is the fallback default. */
  fileTypeDefaults: Record<string, string | null>;
  /** Extension (no dot) -> CSS color tint for that file type's icon. */
  fileTypeDefaultColors: Record<string, string>;
  defaultIcon: string | null;
  /** CSS color tint for the global default icon (null = theme default). */
  defaultIconColor: string | null;

  /* --- Library management --- */
  favoriteIconIds: string[];
  collections: Collection[];
  /** Dataview-backed dynamic collections (query -> icon id list). */
  dataviewCollections: DataviewCollection[];
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

  /* --- Soundscapes --- */
  /** Master toggle for interaction sounds. */
  soundscapesEnabled: boolean;
  /** Synthesis preset pack. */
  soundPack: SoundPackId;
  /** 0–100; 0 = muted. */
  soundIntensity: number;
  /** Play a subtle sound when hovering icon tiles. */
  soundHover: boolean;
  /** Play a pronounced sound when picking/clicking an icon. */
  soundClick: boolean;
  /** Play a transition sound when a file's icon changes automatically. */
  soundTransition: boolean;
  /** Custom audio files: kind -> vault-relative path (.mp3/.wav). */
  customSounds: Partial<Record<SoundKind, string>>;
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
  overrideColors: {},
  rules: [],
  fileTypeDefaults: {},
  fileTypeDefaultColors: {},
  defaultIcon: null,
  defaultIconColor: null,

  favoriteIconIds: [],
  collections: [],
  dataviewCollections: [],
  iconTags: {},
  recentIconIds: [],
  userIcons: [],

  lastPackFilter: "all",
  iconGridDensity: "comfortable",
  reportUrl: DEFAULT_REPORT_URL,

  soundscapesEnabled: false,
  soundPack: "minimal",
  soundIntensity: 40,
  soundHover: true,
  soundClick: true,
  soundTransition: true,
  customSounds: {},
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
