/**
 * Star Icons — Icon Galaxy (3D view).
 *
 * Every icon becomes a glowing star in an interactive 3D galaxy:
 *   • packs are planets on spiral arms, their icons orbit as stars
 *   • orbit with drag, zoom with scroll/pinch, click a star to select it
 *   • search "flies" the camera to the found icon
 *
 * Built on Three.js (bundled) + OrbitControls. Fully disposed on close.
 */

import { App, Modal, Notice } from "obsidian";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { auroraColors, buildGalaxyData, GalaxyData } from "../core/galaxy";
import { IconStore } from "../core/iconStore";
import { getIcon } from "../data/icons";
import { IconDef, PACK_LABELS } from "../types";
import { debounce, svgForClipboard } from "../utils";
import { renderIcon } from "./components";

export interface GalaxyViewOptions {
  /** Called when a star is selected (Icon Manager selection sync). */
  onSelect?: (iconId: string) => void;
}

function webglAvailable(): boolean {
  try {
    // createEl appends to the document body by default — detach the probe.
    const canvas = createEl("canvas");
    canvas.remove();
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") || canvas.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

function easeInOutCubic(k: number): number {
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
}

export class GalaxyViewModal extends Modal {
  private data!: GalaxyData;
  private renderer!: THREE.WebGLRenderer;
  private composer!: EffectComposer;
  private bloomPass!: UnrealBloomPass;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private galaxyPoints!: THREE.Points;
  private highlight!: THREE.Sprite;
  private glowTex!: THREE.Texture;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private hovered: number | null = null;
  private selected: number | null = null;
  private downX = 0;
  private downY = 0;
  private rafId = 0;
  private lastRaycast = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;
  private objectUrls: string[] = [];
  /** Timestamp to re-enable cinematic auto-orbit after the user touches it. */
  private autoOrbitResumeAt = 0;
  private fly: {
    camFrom: THREE.Vector3;
    camTo: THREE.Vector3;
    tFrom: THREE.Vector3;
    tTo: THREE.Vector3;
    start: number;
    dur: number;
    targetIndex: number;
  } | null = null;

  private tooltipEl!: HTMLElement;
  private panelEl!: HTMLElement;
  private panelHintEl!: HTMLElement;
  private searchEl!: HTMLInputElement;

  constructor(
    app: App,
    private store: IconStore,
    private opts: GalaxyViewOptions = {},
  ) {
    super(app);
  }

  onOpen(): void {
    const icons = this.store.availableIcons();
    if (icons.length === 0) {
      new Notice("No icons available — enable a pack first.");
      this.close();
      return;
    }
    if (!webglAvailable()) {
      new Notice("WebGL is not available in this environment.");
      this.close();
      return;
    }

    this.data = buildGalaxyData(icons);
    this.modalEl.addClass("si-galaxy-modal");
    this.contentEl.addClass("si-galaxy");
    this.buildDom();
    this.initScene();
    this.rafId = window.requestAnimationFrame(this.animate);
  }

  onClose(): void {
    this.disposed = true;
    window.cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.controls?.dispose();
    this.scene?.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = (obj as { material?: THREE.Material | THREE.Material[] }).material;
      if (Array.isArray(mat)) mat.forEach((m) => disposeMaterial(m));
      else if (mat) disposeMaterial(mat);
    });
    this.renderer?.dispose();
    this.composer?.dispose();
    for (const url of this.objectUrls) URL.revokeObjectURL(url);
    this.objectUrls = [];
    this.contentEl.empty();
  }

  /* --- neon extras (constellations + nebula) ----------------------------- */

  /**
   * Draw glowing lines linking icons that share a collection or a user tag,
   * so curated sets appear as constellations in the galaxy. Icons in the
   * galaxy only (disabled packs are skipped); each group fans from its first
   * member so the lines read cleanly rather than criss-crossing.
   */
  private buildConstellations(): THREE.LineSegments | null {
    const data = this.data;
    if (data.indexById.size === 0) return null;
    const has = (id: string): boolean => data.indexById.has(id);

    const groups: string[][] = [];
    for (const col of this.store.getSettings().collections) groups.push(col.iconIds);
    const tagGroups = new Map<string, string[]>();
    for (const [id, tags] of Object.entries(this.store.getSettings().iconTags ?? {})) {
      for (const t of tags) {
        const arr = tagGroups.get(t);
        if (arr) arr.push(id);
        else tagGroups.set(t, [id]);
      }
    }
    for (const ids of tagGroups.values()) groups.push(ids);

    const segs: number[] = [];
    const pos = data.positions;
    for (const g of groups) {
      // Only link icons present here, and cap the group for readability.
      const ids = g.filter(has).slice(0, 40);
      const hub = data.indexById.get(ids[0]);
      if (hub === undefined) continue;
      for (let i = 1; i < ids.length; i++) {
        const target = data.indexById.get(ids[i]);
        if (target === undefined) continue;
        segs.push(
          pos[hub * 3], pos[hub * 3 + 1], pos[hub * 3 + 2],
          pos[target * 3], pos[target * 3 + 1], pos[target * 3 + 2],
        );
      }
    }
    if (segs.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(segs, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0x7fd0ff,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.LineSegments(geo, mat);
  }

  /** A few huge, faint colored glows that read as a nebula behind the galaxy. */
  private addNebula(group: THREE.Object3D): void {
    const specs: [number, number, number, number, number][] = [
      [-60, 30, -160, 95, 0.10],
      [70, -12, -140, 115, 0.09],
      [-24, 42, 120, 120, 0.08],
      [52, 10, 95, 82, 0.09],
      [0, -30, -60, 70, 0.07],
    ];
    // Nebula shares the Icon Aurora palette (gold → cyan) so the 3D galaxy
    // and the 2D grid read as one cohesive visual identity.
    const [aur1, aur2] = auroraColors("all");
    const gold = new THREE.Color(aur1);
    const cyan = new THREE.Color(aur2);
    const violet = new THREE.Color("#8b5cf6");
    const sky = new THREE.Color("#0ea5e9");
    const colors = [
      gold.clone(),
      gold.clone().lerp(cyan, 0.55),
      cyan.clone(),
      cyan.clone().lerp(violet, 0.35),
      gold.clone().lerp(sky, 0.45),
    ];
    specs.forEach(([x, y, z, scale, opacity], i) => {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTex,
          color: colors[i % colors.length],
          transparent: true,
          opacity,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      sprite.position.set(x, y, z);
      sprite.scale.set(scale, scale, 1);
      group.add(sprite);
    });
  }

  /* --- DOM --------------------------------------------------------------- */

  private buildDom(): void {
    const content = this.contentEl;

    const canvasHost = content.createDiv({ cls: "si-galaxy-canvas" });
    void canvasHost;

    this.searchEl = content.createEl("input", {
      cls: "si-text-input si-galaxy-search",
      attr: {
        placeholder: "Search icons… (camera flies to the match)",
        spellcheck: "false",
      },
    });
    this.searchEl.addEventListener("input", debounce(() => this.runSearch(), 250));
    this.searchEl.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        this.runSearch();
      }
    });

    this.tooltipEl = content.createDiv({ cls: "si-galaxy-tooltip" });

    this.panelEl = content.createDiv({ cls: "si-galaxy-panel" });
    this.panelHintEl = content.createDiv({
      cls: "si-galaxy-hint",
      text: "🖱 Drag to orbit · Scroll to zoom · Click a star to select · Lines link collections & tags",
    });
    void this.panelHintEl;
  }

  /* --- scene --------------------------------------------------------------- */

  private initScene(): void {
    const host = this.contentEl.querySelector<HTMLElement>(".si-galaxy-canvas")!;
    const w = Math.max(320, host.clientWidth || 900);
    const h = Math.max(240, host.clientHeight || 640);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    host.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x05060a, 90, 300);
    // Opaque space backdrop so bloom has a clean base (no reliance on alpha).
    this.scene.background = new THREE.Color(0x05060a);

    this.camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1200);
    this.camera.position.set(0, 55, 100);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 340;
    this.controls.maxPolarAngle = Math.PI * 0.94;
    this.controls.target.set(0, 0, 0);
    // Cinematic idle orbit — paused while the user drags, resumes after a pause.
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.5;

    const group = new THREE.Group();
    this.scene.add(group);

    this.glowTex = this.glowTexture();

    // Ambient dust / starfield.
    const dust = new THREE.BufferGeometry();
    const dustPos = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) {
      const r = 140 + Math.random() * 260;
      const a = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 120;
      dustPos[i * 3] = Math.cos(a) * r;
      dustPos[i * 3 + 1] = y;
      dustPos[i * 3 + 2] = Math.sin(a) * r;
    }
    dust.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.3,
      map: this.glowTex,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
      sizeAttenuation: true,
    });
    group.add(new THREE.Points(dust, dustMat));

    // Icon stars.
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.data.positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(this.data.colors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 3.4,
      map: this.glowTex,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.galaxyPoints = new THREE.Points(geo, starMat);
    group.add(this.galaxyPoints);

    // Planets + labels.
    for (const planet of this.data.planets) {
      const [r, g, b] = planet.color;
      const color = new THREE.Color(r / 255, g / 255, b / 255);

      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 16, 16),
        new THREE.MeshBasicMaterial({ color }),
      );
      sphere.position.set(planet.x, planet.y, planet.z);
      group.add(sphere);

      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTex,
          color,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      glow.scale.set(7, 7, 1);
      glow.position.copy(sphere.position);
      group.add(glow);

      const label = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.labelTexture(PACK_LABELS[planet.pack as keyof typeof PACK_LABELS] ?? planet.pack),
          transparent: true,
          depthWrite: false,
        }),
      );
      label.position.set(planet.x, planet.y + 1.5, planet.z);
      label.scale.set(5.2, 1.3, 1);
      group.add(label);
    }

    // Selected-star highlight (icon sprite, hidden until a pick).
    this.highlight = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: 0xffffff,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.highlight.visible = false;
    this.highlight.scale.set(3.4, 3.4, 1);
    group.add(this.highlight);

    // Decorative lighting.
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const core = new THREE.PointLight(0xffd27a, 1.4, 220);
    core.position.set(0, 12, 0);
    this.scene.add(core);

    // Nebula haze: a few huge, faint colored glows for atmospheric depth.
    this.addNebula(group);

    // Constellation lines linking icons that share a collection or tag.
    const constellations = this.buildConstellations();
    if (constellations) group.add(constellations);

    // Neon post-processing — UnrealBloom makes the stars, planets and glow pop.
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.85, 0.6, 0.72);
    this.composer.addPass(this.bloomPass);

    // Events.
    this.renderer.domElement.addEventListener("pointerdown", (ev) => {
      this.downX = ev.clientX;
      this.downY = ev.clientY;
      // Pause the cinematic auto-orbit while the user interacts.
      this.controls.autoRotate = false;
      this.autoOrbitResumeAt = performance.now() + 8000;
    });
    this.renderer.domElement.addEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.addEventListener("pointerleave", this.onPointerLeave);
    this.renderer.domElement.addEventListener("click", this.onClick);
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(host);
  }

  /* --- interaction ---------------------------------------------------------- */

  private onPointerMove = (ev: PointerEvent): void => {
    const now = performance.now();
    if (now - this.lastRaycast < 50) return;
    this.lastRaycast = now;
    const index = this.pickAt(ev);
    this.hovered = index;
    this.renderer.domElement.toggleClass("is-hovering", index !== null);
    if (index !== null) {
      const id = this.data.iconIds[index];
      this.tooltipEl.addClass("is-visible");
      this.tooltipEl.setCssStyles({
        left: `${ev.clientX + 14}px`,
        top: `${ev.clientY + 14}px`,
      });
      const def = getIcon(id);
      this.tooltipEl.setText(def ? `${def.name} · ${PACK_LABELS[def.pack] ?? def.pack}` : id);
    } else {
      this.tooltipEl.removeClass("is-visible");
    }
  };

  private onPointerLeave = (): void => {
    this.hovered = null;
    this.tooltipEl.removeClass("is-visible");
    this.renderer.domElement.removeClass("is-hovering");
  };

  private onClick = (ev: MouseEvent): void => {
    // Ignore clicks that end a drag (orbiting shouldn't select a star).
    if (Math.hypot(ev.clientX - this.downX, ev.clientY - this.downY) > 6) return;
    const index = this.pickAt(ev);
    if (index !== null) this.select(index);
  };

  private onResize = (): void => {
    const host = this.contentEl.querySelector<HTMLElement>(".si-galaxy-canvas");
    if (!host) return;
    const w = Math.max(320, host.clientWidth);
    const h = Math.max(240, host.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
  };

  private pickAt(ev: { clientX: number; clientY: number }): number | null {
    const dom = this.renderer.domElement;
    const rect = dom.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    this.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.raycaster.params.Points.threshold = 2.4;
    const hits = this.raycaster.intersectObject(this.galaxyPoints, false);
    return hits.length ? (hits[0].index ?? null) : null;
  }

  private select(index: number): void {
    this.selected = index;
    const id = this.data.iconIds[index];
    const x = this.data.positions[index * 3];
    const y = this.data.positions[index * 3 + 1];
    const z = this.data.positions[index * 3 + 2];
    this.highlight.position.set(x, y, z);
    this.highlight.visible = true;
    const def = getIcon(id);
    this.renderPanel(def);
    this.loadIconSprite(def);
    this.opts.onSelect?.(id);
  }

  /* --- search ("fly to") ------------------------------------------------------ */

  private runSearch(): void {
    const q = this.searchEl.value.trim();
    if (!q) return;
    const found = this.store.search(q, "all", 1);
    const icon = found[0];
    if (!icon) {
      new Notice("No icon matches that search.");
      return;
    }
    const index = this.data.indexById.get(icon.id);
    if (index === undefined) {
      new Notice(`“${icon.id}” is not in the galaxy (pack not enabled).`);
      return;
    }
    this.flyTo(index);
  }

  private flyTo(index: number): void {
    const x = this.data.positions[index * 3];
    const y = this.data.positions[index * 3 + 1];
    const z = this.data.positions[index * 3 + 2];
    const target = new THREE.Vector3(x, y, z);
    const dir = target.clone().normalize();
    const camDest = target.clone().add(dir.multiplyScalar(7));
    this.fly = {
      camFrom: this.camera.position.clone(),
      camTo: camDest,
      tFrom: this.controls.target.clone(),
      tTo: target.clone(),
      start: performance.now(),
      dur: 950,
      targetIndex: index,
    };
  }

  private stepFly(time: number): void {
    const f = this.fly;
    if (!f) return;
    const k = Math.min(1, (time - f.start) / f.dur);
    const e = easeInOutCubic(k);
    this.controls.target.lerpVectors(f.tFrom, f.tTo, e);
    this.camera.position.lerpVectors(f.camFrom, f.camTo, e);
    if (k >= 1) {
      this.fly = null;
      this.select(f.targetIndex);
    }
  }

  /* --- panel --------------------------------------------------------------- */

  private renderPanel(def: IconDef | undefined): void {
    const panel = this.panelEl;
    panel.empty();
    if (!def) {
      panel.createSpan({ cls: "si-galaxy-panel-empty", text: "Icon not loaded" });
      return;
    }
    const row = panel.createDiv({ cls: "si-galaxy-panel-row" });
    const preview = row.createSpan({ cls: "si-galaxy-preview" });
    renderIcon(preview, def.id, 30);
    const meta = row.createDiv({ cls: "si-galaxy-meta" });
    meta.createDiv({ cls: "si-galaxy-name", text: def.name });
    meta.createDiv({ cls: "si-galaxy-id", text: def.id });

    const buttons = panel.createDiv({ cls: "si-galaxy-buttons" });
    const copyName = buttons.createEl("button", { cls: "si-btn si-btn-small", attr: { type: "button" } });
    copyName.createSpan({ text: "Copy name" });
    copyName.addEventListener("click", () => {
      void navigator.clipboard.writeText(def.id);
    });
    const copySvg = buttons.createEl("button", { cls: "si-btn si-btn-small", attr: { type: "button" } });
    copySvg.createSpan({ text: "Copy SVG" });
    copySvg.addEventListener("click", () => {
      void navigator.clipboard.writeText(svgForClipboard(def.svg));
    });
    const fav = buttons.createEl("button", {
      cls: "si-btn si-btn-small" + (this.store.isFavorite(def.id) ? " is-active" : ""),
      attr: { type: "button" },
    });
    fav.createSpan({ text: this.store.isFavorite(def.id) ? "★ Favorited" : "☆ Favorite" });
    fav.addEventListener("click", () => {
      void this.store.toggleFavorite(def.id).then(() => {
        fav.toggleClass("is-active", this.store.isFavorite(def.id));
        fav.setText(this.store.isFavorite(def.id) ? "★ Favorited" : "☆ Favorite");
      });
    });
    if (this.opts.onSelect) {
      const inManager = buttons.createEl("button", { cls: "si-btn si-btn-small si-btn-primary", attr: { type: "button" } });
      inManager.createSpan({ text: "Select in Manager" });
      inManager.addEventListener("click", () => {
        this.opts.onSelect?.(def.id);
        this.close();
      });
    }
  }

  /* --- sprite textures -------------------------------------------------------- */

  private glowTexture(): THREE.Texture {
    const canvas = createEl("canvas");
    canvas.remove();
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.3, "rgba(255,255,255,0.6)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private labelTexture(text: string): THREE.Texture {
    const canvas = createEl("canvas");
    canvas.remove();
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.font = "bold 44px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.85)";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, 256, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Render the selected icon's SVG onto the highlight sprite (glow + icon). */
  private loadIconSprite(def: IconDef | undefined): void {
    if (!def) return;
    const url = URL.createObjectURL(new Blob([def.svg], { type: "image/svg+xml" }));
    this.objectUrls.push(url);
    const img = new Image();
    img.onload = () => {
      if (this.disposed) return;
      const canvas = createEl("canvas");
      canvas.remove();
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d")!;
      const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
      grad.addColorStop(0, "rgba(255,255,255,0.95)");
      grad.addColorStop(0.35, "rgba(255,255,255,0.28)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      ctx.drawImage(img, 30, 30, 68, 68);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const mat = this.highlight.material;
      if (mat.map && mat.map !== this.glowTex) mat.map.dispose();
      mat.map = tex;
      mat.needsUpdate = true;
    };
    img.onerror = () => {
      /* keep the plain glow */
    };
    img.src = url;
  }

  /* --- loop --------------------------------------------------------------- */

  private animate = (time: number): void => {
    if (this.disposed) return;
    this.rafId = window.requestAnimationFrame(this.animate);
    // Resume cinematic auto-orbit after a short idle pause.
    if (!this.controls.autoRotate && this.autoOrbitResumeAt && performance.now() > this.autoOrbitResumeAt) {
      this.controls.autoRotate = true;
    }
    this.controls.update();
    // Slow galaxy rotation + subtle twinkle.
    const group = this.galaxyPoints.parent;
    if (group) group.rotation.y += 0.00035;
    if (this.highlight.visible) {
      const s = 3.2 + Math.sin(time * 0.004) * 0.5;
      this.highlight.scale.set(s, s, 1);
    }
    if (this.fly) this.stepFly(time);
    this.composer.render();
  };
}

function disposeMaterial(m: THREE.Material): void {
  const map = (m as { map?: THREE.Texture }).map;
  if (map) map.dispose();
  m.dispose();
}
