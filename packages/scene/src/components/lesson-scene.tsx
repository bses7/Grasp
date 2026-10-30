/**
 * <LessonScene>, the package's single mount point (M5).
 * Owns the R3F Canvas (frameloop="demand", dpr from SCENE_CONSTANTS), the interactable raycaster,
 * the drag plane and sockets. Consumes InteractionEvents through `dispatch` (mouse adapter or the
 * vision path, one code path) and emits SceneEvents. It never grades.
 *
 * Per-frame work lives in refs: grab_move mutates the Object3D and calls invalidate(), so a drag
 * causes zero React commits. Only discrete moments (grab, place, focus) update the live region.
 * M5: grab, drag, snap, keyboard. M6: cursor → coordinate chain → raycast → debounced hover tint,
 * a hover_result back to the vision path for every cursor, and a drawn cursor for camera-space input.
 * M7: the same handler takes the hand's grab events; after tracking_regained the grab offset is rebased
 * so the part does not jump; reset (command or R key) returns to the start pose. The scene owns no
 * grace timer: tracking_lost leaves the part where it is until the worker's grab_end arrives.
 * M8: `highlight` with an outcome style tints the part green, amber or pink-red for a moment.
 * M9: loads the GLB named by the manifest; nodes named after component ids become components, `socket_*`
 * nodes are skipped (the manifest carries their poses), and every other node is static scenery.
 * Phase 4 step 4.0: a `hover` (the point gesture) held on one part for DWELL_SELECT_MS selects it, with a
 * fill ring on the cursor; a pinch selects even when the activity disallows grabbing; Enter selects.
 * Phase 4 step 4.3: whole-model orbit (a grab that starts on empty space, arrows with nothing grabbed),
 * dolly (+ / - and the wheel, off under studyParity), named poses (`setPose`, the `pose` prop, X toggles
 * exploded), hotspot markers (dwell, Tab, Enter; a DOM label on hover or focus), the hint pulse (`highlight`
 * without a style), `cameraTo` a component or hotspot, and `setVisible` / `visibleComponents`.
 */
import type {
  HoverResult,
  InteractionEvent,
  ModelManifest,
  SceneCommand,
  SceneEvent,
  SceneState,
  SocketVisual,
} from "@grasp/types";
import { Canvas, useThree } from "@react-three/fiber";
import { tokens } from "@grasp/ui";
import { memo, useEffect, useRef, useState, type CSSProperties, type MutableRefObject, type RefObject } from "react";
import { Box3, Euler, Quaternion, Vector3, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial, type Object3D } from "three";
import type { CameraPose, Transform } from "@grasp/types";
import { parseGlb } from "../model-loader";
import { SCENE_CONSTANTS } from "../constants";
import { landmarkToNdc, type Ndc, type Viewport } from "../coords";
import { beginGrab, endGrab, moveGrab, rebaseGrab, type GrabState } from "../drag-plane";
import { createInteractableRaycaster } from "../raycast";
import { snapshotSceneState } from "../scene-state";
import { nearestAcceptingSocket, snapTo, tweenTo, type SocketOccupancy } from "../sockets";
import { cameraPosition, dolly, lerpPose, orbitFrom, poseFacing } from "../orbit";
import { ComponentMesh } from "./component-mesh";
import { Hotspot, HOTSPOT_COLOR } from "./hotspot";
import { KEY_MAP } from "./mouse-controls";
import { RING_COLOR, SocketMarker } from "./socket-marker";

/**
 * Which frame a cursor is in. "camera": the mirrored webcam frame, mapped through `viewport` (cover-fit).
 * "canvas": already relative to the 3D canvas (the mouse adapter).
 */
export type CursorSpace = "camera" | "canvas";

export type LessonSceneReadyHandle = {
  /** Feed one interaction event through the doc 05 section 6 pseudocode. */
  dispatch(event: InteractionEvent, space?: CursorSpace): void;
  /** Engine → scene command (doc 05 section 4). */
  apply(cmd: SceneCommand): void;
  /** Current compact snapshot for the tutor and the research logger. */
  snapshot(): SceneState;
  /** The WebGL canvas, for input adapters (mouse) to attach to. */
  canvas: HTMLCanvasElement;
};

export type LessonSceneProps = {
  manifest: ModelManifest;
  /** Key of manifest.poses for the initial layout; defaults to the first pose. */
  pose?: string;
  /** Activity-level scene flags from lesson JSON; defaults mirror lesson-schema. */
  allowGrab?: boolean;
  allowOrbit?: boolean;
  socketVisual?: SocketVisual;
  /** Hotspot markers; default true. Off where their labels would give answers away (graded activities). */
  showHotspots?: boolean;
  /** Only these components are shown; omit to show all (activity `scene.visibleComponents`). */
  visibleComponents?: string[];
  /** Base URL the GLB is served under, as <base>/<manifest.id>/<manifest.file>; default "/models". */
  assetBaseUrl?: string;
  /** Self-hosted Draco decoder directory; default "/draco/". */
  dracoDecoderPath?: string;
  /** Disables capabilities listed in STUDY_PARITY_DISABLES (camera dolly), X explode and the extra gestures (model_turn, model_zoom, model_explode). */
  studyParity?: boolean;
  reducedMotion?: boolean;
  /** Slow turntable (the introduction), stopped for the rest of the activity by any grab, orbit, key or zoom. */
  autoRotate?: boolean;
  /** Camera-frame geometry for the gesture cursor (M6). Omit for the mouse: its cursor is already canvas-relative. */
  viewport?: Partial<Viewport>;
  onSceneEvent: (event: SceneEvent) => void;
  /** What is under each cursor, for the vision FSM's grabbable-under-cursor rule (doc 04). Same frame, raw (not debounced). */
  onHoverResult?: (result: HoverResult) => void;
  onSceneState?: (state: SceneState) => void;
  onReady: (handle: LessonSceneReadyHandle) => void;
};

const SR_ONLY: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
};

/** Emissive tints from the doc 11 roles (tokens.sceneTint; dimmed because emissive adds to the base colour). */
const TINT = tokens.sceneTint;
const OUTCOME_TINT = { correct: TINT.correct, partial: TINT.partial, incorrect: TINT.incorrect };
const OUTCOME_TINT_MS = 1200;
/** Hint pulse colour (gold `highlight`); intensity swings at 1 Hz for HINT_PULSE_MS. */
const PULSE_TINT = TINT.pulse;
/** Camera tween for cameraTo. */
const CAMERA_TWEEN_MS = 600;
/** Orbit degrees per arrow press with nothing grabbed; Shift multiplies. */
const KEY_ORBIT_DEG = 10;
const DOLLY_STEP = 1.1;
/** demonstrate: tween into the socket, hold, tween back. */
const DEMO_TWEEN_MS = 700;
const DEMO_HOLD_MS = 900;
/** The camera and its aim sit this far above the model origin, so the model shows a little below centre (over the plinth). */
const VIEW_LIFT = 1.5;
/** Tour: how far a presented part comes toward the viewer, and up (scene units). */
const PRESENT_TOWARD = 9;
const PRESENT_RISE = 1.5;
/** Easter egg spin duration. */
const SPELL_SPIN_MS = 1800;
/** The two-hand explode can spread the parts this far past the authored exploded pose (1). */
const SPREAD_MAX = 1.8;
/** Turntable speed for autoRotate. */
const SPIN_DEG_PER_S = 12;

const LABEL_STYLE: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  padding: "4px 10px",
  borderRadius: 999,
  background: tokens.sceneDom.labelBg,
  color: tokens.sceneDom.ink,
  boxShadow: "0 0 0 1.5px #e4dccb, 0 4px 12px rgba(58,31,43,.16)",
  font: tokens.sceneDom.font,
  pointerEvents: "none",
  whiteSpace: "nowrap",
  display: "none",
};

/** Gap in px between the model's screen bounds and the label. */
const LABEL_GAP = 24;
/** How far in px the label sits above or below its marker, giving the leader its slant. */
const LABEL_RISE = 36;
const LEADER_SVG_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  pointerEvents: "none",
  overflow: "visible",
};

const CURSOR_STYLE: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  width: 22,
  height: 22,
  margin: -11,
  borderRadius: "50%",
  // Plum ring on a cream fill: the ring alone is 1.6:1 on the heart muscle, the fill makes it 5.3:1 (doc 11).
  border: `3px solid ${tokens.sceneDom.ink}`,
  background: tokens.sceneDom.cursorFill,
  pointerEvents: "none",
  display: "none",
  zIndex: 50, // above HUD cards and dialogs, so the hand can aim at their buttons
};
/** Keyboard cursor step in NDC per arrow press; Shift multiplies. */
const KEY_NDC_STEP = 0.03;

export function LessonScene(props: LessonSceneProps) {
  const [announcement, setAnnouncement] = useState("");
  const keyHandler = useRef<((e: KeyboardEvent) => void) | undefined>(undefined);
  const wheelHandler = useRef<((e: WheelEvent) => void) | undefined>(undefined);
  const cursorEl = useRef<HTMLDivElement>(null);
  const labelEl = useRef<HTMLDivElement>(null);
  const leaderEl = useRef<SVGPolylineElement>(null);
  // Stable: R3F re-applies a changed camera prop on every render, which would undo the orbit.
  const [cameraOpts] = useState(() => {
    const [x, y, z] = cameraPosition(props.manifest.defaultCamera);
    return { fov: 45, near: 0.1, far: 500, position: [x, y + VIEW_LIFT, z] as [number, number, number] };
  });
  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      tabIndex={0}
      aria-label={`3D scene. Tab to choose a part or marker, Enter to select it, Space to grab or release it, arrow keys to move it or, with nothing held, to turn the model.${props.studyParity ? "" : " X explodes."} R resets.`}
      onKeyDown={(e) => keyHandler.current?.(e.nativeEvent)}
      onWheel={(e) => wheelHandler.current?.(e.nativeEvent)}
    >
      <Canvas
        frameloop="demand"
        dpr={[...SCENE_CONSTANTS.DPR_RANGE]}
        camera={cameraOpts}
        onCreated={({ camera }) => camera.lookAt(0, VIEW_LIFT, 0)}
        // Transparent: the CSS studio backdrop shows through (doc 05 section 10, doc 11 "Backdrop").
        gl={{ alpha: true }}
        style={{ touchAction: "none" }}
      >
        {/* Still doc 05's one hemisphere plus one directional light; brighter, and the key light comes from the front. */}
        <hemisphereLight args={["#fff8ef", "#c9d5c3"]} intensity={1.6} />
        <directionalLight position={[6, 14, 30]} intensity={2.8} />
        <SceneController
          {...props}
          announce={setAnnouncement}
          keyHandler={keyHandler}
          wheelHandler={wheelHandler}
          cursorEl={cursorEl}
          labelEl={labelEl}
          leaderEl={leaderEl}
        />
      </Canvas>
      <svg style={LEADER_SVG_STYLE} aria-hidden>
        <polyline ref={leaderEl} fill="none" stroke={tokens.sceneDom.ink} strokeWidth={1.5} strokeLinejoin="round" style={{ display: "none" }} />
      </svg>
      <div ref={labelEl} style={LABEL_STYLE} aria-hidden />
      {/* Gesture cursor: moved by style.transform from the controller, never by React state. */}
      <div ref={cursorEl} style={CURSOR_STYLE} aria-hidden />
      <p style={SR_ONLY} aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

type ControllerProps = LessonSceneProps & {
  announce: (text: string) => void;
  keyHandler: MutableRefObject<((e: KeyboardEvent) => void) | undefined>;
  wheelHandler: MutableRefObject<((e: WheelEvent) => void) | undefined>;
  cursorEl: RefObject<HTMLDivElement | null>;
  labelEl: RefObject<HTMLDivElement | null>;
  leaderEl: RefObject<SVGPolylineElement | null>;
};

/**
 * Memoized so announcements and parent re-renders never re-render the 3D tree. Callback props are
 * ignored in the comparison because the controller reads them through `live` at call time.
 */
const sameIgnoringCallbacks = (a: ControllerProps, b: ControllerProps) =>
  (Object.keys(a) as (keyof ControllerProps)[]).every(
    (k) => Object.is(a[k], b[k]) || (typeof a[k] === "function" && typeof b[k] === "function"),
  );

const SceneController = memo(function SceneController(props: ControllerProps) {
  const { manifest, socketVisual } = props;
  const { camera, gl, size, invalidate } = useThree();
  const [visualOverrides, setVisualOverrides] = useState<Record<string, SocketVisual>>({});
  // Which sockets are filled, for hiding their rings. Copied from st.occupancy on register, grab_end and
  // reset only, never on grab_start, so a drag causes no React commit.
  const [filled, setFilled] = useState<ReadonlySet<string>>(new Set());

  // Latest props for the stable handlers below; the handle given to onReady never changes.
  const live = useRef({ props, size });
  live.current = { props, size };

  const s = useRef<{
    objects: Map<string, Object3D>;
    occupancy: SocketOccupancy;
    grab: GrabState | null;
    focus: number;
    kbCursor: Ndc;
    lastEvent: SceneState["lastEvent"];
    raycaster: ReturnType<typeof createInteractableRaycaster>;
    posed: Set<string>;
    hovered: string | null;
    hoverCandidate: string | null;
    hoverFrames: number;
    /** Set by tracking_regained; the next grab_move rebases the grab offset. */
    rebase: boolean;
    /** Outcome tints currently shown, by component id. */
    outcome: Map<string, number>;
    /** Each component's transform as authored in the GLB (the assembled pose), for reset. */
    original: Map<string, Transform>;
    /** Dwell-select on the debounced hovered id; fires once per continuous dwell. */
    dwell: { id: string | null; since: number; fired: boolean };
    /** Hotspot markers by hotspot id. */
    markers: Map<string, Mesh>;
    /** Socket ring meshes, and the one lit because the held part would snap into it on release. */
    rings: Map<string, Mesh>;
    inRange: string | null;
    /** Orbit camera pose, and the drag that is turning it (a grab that started on empty space). */
    cam: CameraPose;
    orbit: { start: Ndc; cam0: CameraPose } | null;
    /** How far the parts are spread toward the exploded pose (0 assembled, 1 the authored pose), by the two-hand explode. */
    spread: number;
    /** The part the easter-egg tour has pulled out, and where it was. */
    presented: { o: Object3D; from: Transform } | null;
    /** Camera roll from the two-hand twist, radians; R resets it. */
    roll: number;
    /** Bumped to cancel a running camera tween. */
    camTween: number;
    /** Hint pulses by component id: start time. */
    pulse: Map<string, number>;
    /** The named pose last applied. */
    pose: string;
    /** autoRotate: the learner took over, so the turntable stops for this activity. */
    spinOff: boolean;
  } | null>(null);
  s.current ??= {
    objects: new Map(),
    occupancy: Object.fromEntries(manifest.sockets.map((x) => [x.id, null])),
    grab: null,
    focus: -1,
    kbCursor: { x: 0, y: 0 },
    lastEvent: null,
    raycaster: createInteractableRaycaster(),
    posed: new Set(),
    hovered: null,
    hoverCandidate: null,
    hoverFrames: 0,
    rebase: false,
    outcome: new Map(),
    original: new Map(),
    dwell: { id: null, since: 0, fired: false },
    markers: new Map(),
    rings: new Map(),
    inRange: null,
    cam: { ...manifest.defaultCamera },
    orbit: null,
    roll: 0,
    spread: 0,
    presented: null,
    camTween: 0,
    pulse: new Map(),
    pose: props.pose ?? Object.keys(manifest.poses)[0] ?? "",
    spinOff: false,
  };
  const st = s.current;
  function syncFilled() {
    setFilled(new Set(Object.keys(st.occupancy).filter((k) => st.occupancy[k])));
  }
  /** Graded activities (no hotspots) never speak a part's name or socket, or the screen reader would give identify answers away. */
  const graded = () => live.current.props.showHotspots === false;
  const nameOf = (id: string) =>
    graded() ? "part" : (manifest.components.find((c) => c.id === id)?.name ?? manifest.hotspots.find((h) => h.id === id)?.label ?? id);
  const isVisible = (o: Object3D | undefined) => {
    for (let x = o ?? null; x; x = x.parent) if (!x.visible) return false;
    return !!o;
  };
  /** Tab order: visible interactable components, each followed by its visible hotspots. */
  const focusable = () =>
    live.current.props.manifest.components
      .filter((c) => c.interactable && isVisible(st.objects.get(c.id)))
      .flatMap((c) => [c.id, ...manifest.hotspots.filter((h) => h.componentId === c.id && st.markers.has(h.id)).map((h) => h.id)]);
  const interactables = () => [...st.objects.values()].filter((o) => o.visible);

  // The start pose is applied once per component id, ever: a ref detach/re-attach on re-render must
  // never move a part that the learner has already dragged or placed.
  const register = useRef((id: string, o: Object3D | null) => {
    if (!o) return void st.objects.delete(id);
    if (!st.posed.has(id)) {
      st.original.set(id, { position: o.position.toArray(), rotation: [o.rotation.x, o.rotation.y, o.rotation.z] });
      const tr = live.current.props.manifest.poses[st.pose]?.[id];
      if (tr) {
        o.position.set(...tr.position);
        o.rotation.set(...tr.rotation);
      } else {
        const rest = live.current.props.manifest.components.find((c) => c.id === id)?.restSocketId;
        if (rest && rest in st.occupancy) st.occupancy[rest] = id;
      }
      st.posed.add(id);
    }
    st.objects.set(id, o);
    syncFilled();
    invalidate();
  }).current;

  // The model: fetched once per manifest, split into component nodes and static scenery.
  const [model, setModel] = useState<{ nodes: Map<string, Object3D>; scenery: Object3D[] } | null>(null);
  useEffect(() => {
    let alive = true;
    const url = `${props.assetBaseUrl ?? "/models"}/${manifest.id}/${manifest.file}`;
    fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${url}: HTTP ${r.status}`))))
      .then((buf) => parseGlb(buf, props.dracoDecoderPath ?? "/draco/"))
      .then(({ scene }) => {
        const ids = new Set(manifest.components.map((c) => c.id));
        const nodes = new Map<string, Object3D>();
        const scenery: Object3D[] = [];
        for (const o of [...scene.children]) {
          if (ids.has(o.name)) nodes.set(o.name, o);
          else if (!o.name.startsWith("socket_")) scenery.push(o);
        }
        for (const id of ids) if (!nodes.has(id)) console.warn(`${manifest.id}: no GLB node named "${id}"`);
        if (alive) setModel({ nodes, scenery });
      })
      .catch((err) => console.error("model load failed", err));
    return () => {
      alive = false;
    };
    // The manifest identity is the model; props are read once per load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest.id, manifest.file]);

  const registerRing = useRef((id: string, m: Mesh | null) => {
    if (m) st.rings.set(id, m);
    else st.rings.delete(id);
  }).current;

  /** Light the ring the held part would snap into ("release to place here", doc 11 pre-commit states). */
  const lightRing = (id: string | null) => {
    if (id === st.inRange) return;
    for (const [rid, ring] of st.rings) {
      const mat = ring.material as MeshBasicMaterial;
      mat.color.setHex(rid === id ? RING_COLOR.inRange : RING_COLOR.idle);
    }
    st.inRange = id;
  };

  /**
   * While held, a part draws over everything (no depth test), so it stays visible when it passes behind
   * another part, e.g. the aorta behind the pulmonary artery on its way into its socket.
   */
  const drawOnTop = (o: Object3D, onTop: boolean) =>
    o.traverse((c) => {
      const m = (c as Mesh).material as MeshStandardMaterial | undefined;
      if (!m || c.userData.hotspotId) return;
      m.depthTest = !onTop;
      c.renderOrder = onTop ? 20 : 0;
    });

  const registerMarker = useRef((id: string, m: Mesh | null) => {
    if (m) st.markers.set(id, m);
    else st.markers.delete(id);
  }).current;

  /** Emissive tint: grabbed beats outcome feedback beats the hint pulse beats hovered beats keyboard focus. */
  const refresh = () => {
    const focusedId = focusable()[st.focus];
    const now = performance.now();
    for (const [id, start] of st.pulse) if (now - start > SCENE_CONSTANTS.HINT_PULSE_MS) st.pulse.delete(id);
    for (const [id, o] of st.objects) {
      const pulse = st.pulse.has(id) && st.grab?.componentId !== id && !st.outcome.has(id);
      const hex =
        st.grab?.componentId === id
          ? TINT.grabbed
          : st.outcome.has(id)
            ? st.outcome.get(id)!
            : pulse
              ? PULSE_TINT
              : st.hovered === id
                ? TINT.hovered
                : focusedId === id
                  ? TINT.focused
                  : TINT.none;
      // 1 Hz: full at the start of each second, dark at the half.
      const k = pulse && !live.current.props.reducedMotion ? 0.5 + 0.5 * Math.cos((2 * Math.PI * (now - st.pulse.get(id)!)) / 1000) : 1;
      o.traverse((c) => {
        if (c.userData.hotspotId) return;
        const m = (c as Mesh).material as MeshStandardMaterial | undefined;
        m?.emissive?.setHex(hex).multiplyScalar(k);
      });
    }
    for (const [id, m] of st.markers) {
      (m.material as MeshBasicMaterial).color.setHex(st.hovered === id || focusedId === id ? HOTSPOT_COLOR.active : HOTSPOT_COLOR.idle);
    }
    drawLabel(st.hovered && st.markers.has(st.hovered) ? st.hovered : focusedId && st.markers.has(focusedId) ? focusedId : null);
    invalidate();
  };

  /** Runs refresh every frame while a hint pulse is live; the demand frameloop is otherwise idle. */
  const pulseLoop = () => {
    refresh();
    if (st.pulse.size) requestAnimationFrame(pulseLoop);
  };

  /**
   * The hotspot label: one DOM pill outside the model's screen bounds, on the marker's side of the model
   * centre, joined to the marker by a leader line.
   * ponytail: bounds are the projected corners of the visible parts' world AABB, loose when the model is
   * turned; per-pixel silhouette tests if labels sit visibly far out.
   */
  const drawLabel = (hotspotId: string | null) => {
    const el = props.labelEl.current;
    const line = props.leaderEl.current;
    if (!el || !line) return;
    const m = hotspotId ? st.markers.get(hotspotId) : undefined;
    if (!m || !isVisible(m)) {
      el.style.display = "none";
      line.style.display = "none";
      return;
    }
    const { width, height } = live.current.size;
    const toPx = (v: Vector3) => [((v.x + 1) / 2) * width, ((1 - v.y) / 2) * height] as const;
    const box = new Box3();
    for (const o of interactables()) box.expandByObject(o);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < 8; i++) {
      const c = new Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
      const [x, y] = toPx(c.project(camera));
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const [mx, my] = toPx(m.getWorldPosition(new Vector3()).project(camera));
    el.textContent = nameOf(hotspotId!);
    el.style.display = "block";
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = mx < (minX + maxX) / 2;
    const lx = Math.min(Math.max(left ? minX - LABEL_GAP - w : maxX + LABEL_GAP, 8), width - w - 8);
    // Raised or lowered away from the model's vertical centre, so the leader leaves the marker on a slant.
    const rise = my < (minY + maxY) / 2 ? -LABEL_RISE : LABEL_RISE;
    const ly = Math.min(Math.max(my + rise - h / 2, 8), height - h - 8);
    el.style.transform = `translate(${lx}px, ${ly}px)`;
    // Textbook callout: a slant from the marker to one bend, then straight across into the label.
    const ex = left ? lx + w : lx;
    const ey = ly + h / 2;
    const kx = ex + (left ? LABEL_GAP : -LABEL_GAP);
    line.style.display = "block";
    line.setAttribute("points", `${mx},${my} ${kx},${ey} ${ex},${ey}`);
  };

  const placeCamera = () => {
    const [x, y, z] = cameraPosition(st.cam);
    camera.position.set(x, y + VIEW_LIFT, z);
    camera.lookAt(0, VIEW_LIFT, 0);
    camera.rotateZ(st.roll);
    refresh();
  };

  /** Tween the orbit pose (0 ms under reduced motion); a new tween or an orbit drag cancels it. */
  const tweenCamera = (to: CameraPose) => {
    const token = ++st.camTween;
    const from = { ...st.cam };
    const ms = live.current.props.reducedMotion ? 0 : CAMERA_TWEEN_MS;
    const t0 = performance.now();
    const step = (now: number) => {
      if (token !== st.camTween) return;
      const k = ms <= 0 ? 1 : Math.min(1, (now - t0) / ms);
      st.cam = lerpPose(from, to, 1 - (1 - k) ** 3);
      placeCamera();
      if (k < 1) requestAnimationFrame(step);
    };
    step(t0);
  };

  /**
   * Turn to the side a hotspot sits on (marker minus its part's origin, so a detached part shows the same
   * face as an assembled one). A component turns to its first hotspot; one without a hotspot keeps the view.
   */
  const cameraTo = (target: string) => {
    const hsId = st.markers.has(target) ? target : manifest.hotspots.find((h) => h.componentId === target)?.id;
    const m = hsId ? st.markers.get(hsId) : undefined;
    if (!m?.parent) return void (st.objects.has(target) || console.warn(`cameraTo: unknown target ${target}`));
    const face = m.getWorldPosition(new Vector3()).sub(m.parent.getWorldPosition(new Vector3()));
    tweenCamera(poseFacing(face.toArray(), st.cam.distance));
  };

  const emit = (e: SceneEvent) => {
    const { type, t } = e;
    st.lastEvent = {
      type,
      t,
      ...("componentId" in e && e.componentId ? { componentId: e.componentId } : {}),
      ...(e.type === "place" ? { socketId: e.socketId } : {}),
      ...(e.type === "drop" ? { cause: e.cause } : {}),
    };
    live.current.props.onSceneEvent(e);
  };

  /** Debounced hover (HOVER_DEBOUNCE_FRAMES agreeing frames) → tint and one `hover` scene event per change. */
  const updateHover = (id: string | null, t: number) => {
    if (id === st.hovered) return void (st.hoverCandidate = null);
    if (id !== st.hoverCandidate) [st.hoverCandidate, st.hoverFrames] = [id, 0];
    if (++st.hoverFrames < SCENE_CONSTANTS.HOVER_DEBOUNCE_FRAMES) return;
    st.hovered = id;
    st.hoverCandidate = null;
    refresh();
    emit({ type: "hover", componentId: id, t });
  };

  const drawCursor = (ndc: Ndc | null) => {
    const el = props.cursorEl.current;
    if (!el) return;
    if (!ndc) return void (el.style.display = "none");
    const { width, height } = live.current.size;
    el.style.display = "block";
    el.style.transform = `translate(${((ndc.x + 1) / 2) * width}px, ${((1 - ndc.y) / 2) * height}px)`;
    el.style.borderColor = st.grab ? tokens.sceneDom.cursorGrab : tokens.sceneDom.ink;
  };

  /** Dwell progress 0..1 as a fill inside the cursor ring (DOM only, no React state). */
  const drawDwell = (k: number) => {
    const el = props.cursorEl.current;
    if (el) el.style.background = k > 0 ? `conic-gradient(${tokens.sceneDom.dwellFill} ${k * 360}deg, ${tokens.sceneDom.cursorFill} 0)` : tokens.sceneDom.cursorFill;
  };

  const handle = (e: InteractionEvent, space: CursorSpace = "camera", ndcOverride?: Ndc) => {
    const { props: p, size: sz } = live.current;
    const t = e.t ?? performance.now();
    const canvasAspect = sz.width / sz.height;
    const fromCamera = space === "camera" && !ndcOverride;
    const toNdc = (cursor: { x: number; y: number }) => {
      const ndc =
        ndcOverride ??
        landmarkToNdc(cursor, {
          videoAspect: fromCamera ? (p.viewport?.videoAspect ?? canvasAspect) : canvasAspect,
          canvasAspect,
          mirrored: true,
          reachScale: fromCamera ? (p.viewport?.reachScale ?? SCENE_CONSTANTS.REACH_SCALE) : 1,
        });
      if (fromCamera) drawCursor(ndc);
      return ndc;
    };

    if (e.type === "cursor" || e.type === "hover") {
      if (st.grab || st.orbit) return void toNdc(e.cursor);
      const hit = st.raycaster.hit(toNdc(e.cursor), camera, interactables());
      const id = hit.componentId ?? hit.hotspotId;
      // Only the hand's cursor answers the vision FSM; a mouse hover must not steer the gesture grab rule.
      if (fromCamera) p.onHoverResult?.({ type: "hover_result", hoveredId: id, isGrabbable: hit.isGrabbable, t });
      updateHover(id, t);

      // Dwell-select (doc 05 section 3): only the point gesture (`hover`) dwells; open palm and the mouse do not.
      const target = e.type === "hover" ? st.hovered : null;
      if (target !== st.dwell.id) st.dwell = { id: target, since: t, fired: false };
      if (!target || st.dwell.fired) return void drawDwell(0);
      const k = Math.min(1, (t - st.dwell.since) / SCENE_CONSTANTS.DWELL_SELECT_MS);
      drawDwell(k);
      if (k >= 1) {
        st.dwell.fired = true;
        drawDwell(0);
        const isComponent = st.objects.has(target);
        emit(
          isComponent
            ? { type: "select", componentId: target, method: "dwell", t }
            : { type: "select", hotspotId: target, method: "dwell", t },
        );
        p.announce(`Selected ${nameOf(target)}`);
      }
    } else if (e.type === "tracking_lost" || (e.type === "hand_count" && e.n === 0)) {
      // The held part stays exactly where it is; the worker decides between regain and a lost release.
      drawCursor(null);
      if (!st.grab) updateHover(null, t);
    } else if (e.type === "tracking_regained") {
      st.rebase = true;
    } else if (e.type === "grab_start") {
      st.spinOff = true;
      if (st.grab || st.orbit) return;
      const ndc = toNdc(e.cursor);
      const hit = st.raycaster.hit(ndc, camera, interactables());
      if (hit.hotspotId) {
        emit({ type: "select", hotspotId: hit.hotspotId, method: "grab", t });
        return p.announce(`Selected ${nameOf(hit.hotspotId)}`);
      }
      if (!hit.componentId) {
        // Empty space turns the whole model (doc 05 section 3.3); the hover state clears while it turns.
        if (p.allowOrbit === false) return;
        st.camTween++;
        st.orbit = { start: ndc, cam0: { ...st.cam } };
        updateHover(null, t);
        return;
      }
      emit({ type: "select", componentId: hit.componentId, method: "grab", t });
      // allowGrab false (introduction, explore): the pinch only selects (doc 05 section 3).
      if (p.allowGrab === false || !hit.isGrabbable) return;
      st.grab = beginGrab(hit.componentId, st.objects.get(hit.componentId)!, ndc, camera, st.occupancy);
      if (st.grab) drawOnTop(st.grab.object, true);
      st.hovered = hit.componentId;
      refresh();
      p.announce(`Grabbed ${nameOf(hit.componentId)}`);
    } else if (e.type === "grab_move") {
      if (st.orbit) {
        st.cam = orbitFrom(st.orbit.cam0, st.orbit.start, toNdc(e.cursor));
        return placeCamera();
      }
      if (!st.grab) return;
      const ndc = toNdc(e.cursor);
      if (st.rebase) {
        rebaseGrab(st.grab, ndc, camera);
        st.rebase = false;
      }
      moveGrab(st.grab, ndc, camera, e.zHintDelta);
      lightRing(nearestAcceptingSocket(st.grab.object, p.manifest.sockets, st.occupancy, camera.getWorldDirection(new Vector3()))?.id ?? null);
      invalidate();
    } else if (e.type === "model_turn") {
      // Extra gestures (outside the study): a fist turns the model anywhere, even over a part; a twist rolls it.
      if (p.studyParity || p.allowOrbit === false || st.grab) return;
      st.camTween++;
      st.spinOff = true;
      st.cam = orbitFrom(st.cam, { x: 0, y: 0 }, { x: 2 * e.dx, y: -2 * e.dy });
      st.roll += e.roll;
      placeCamera();
    } else if (e.type === "model_zoom") {
      dollyBy(e.factor);
    } else if (e.type === "spell_circle") {
      // Easter egg (dev only): one full turn of the model in the direction the circles were drawn.
      if (p.studyParity || p.reducedMotion) return;
      const token = ++st.camTween;
      st.spinOff = true;
      const from = st.cam.azimuth;
      const dir = e.clockwise ? -1 : 1;
      const t0 = performance.now();
      const step = (now: number) => {
        if (token !== st.camTween) return;
        const k = Math.min(1, (now - t0) / SPELL_SPIN_MS);
        st.cam = { ...st.cam, azimuth: from + dir * 360 * (1 - (1 - k) ** 3) };
        placeCamera();
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    } else if (e.type === "model_explode") {
      spreadBy(e.delta);
    } else if (e.type === "grab_end") {
      if (st.orbit) return void (st.orbit = null);
      const g = st.grab;
      if (!g) return;
      st.grab = null;
      st.rebase = false;
      drawOnTop(g.object, false);
      lightRing(null);
      const { event, snapTo: socket } = endGrab(g, e.reason, p.manifest.sockets, st.occupancy, t, camera.getWorldDirection(new Vector3()));
      if (!event) {
        refresh();
        return p.announce(`${nameOf(g.componentId)} let go`);
      }
      emit(event);
      syncFilled();
      if (socket) void snapTo(g.object, socket, p.reducedMotion ? 0 : SCENE_CONSTANTS.SNAP_EASE_MS, invalidate);
      refresh();
      p.announce(
        event.type === "place" && !graded() ? `${nameOf(g.componentId)} placed in ${event.socketId}` : `${nameOf(g.componentId)} ${event.type === "place" ? "placed" : "dropped"}`,
      );
    }
  };

  /**
   * Tween every part to a named pose: parts the pose lists leave their sockets, the rest return to the
   * assembled transform in their rest socket. Any held part is let go without an event.
   */
  const setPose = (name: string, instant = false) => {
    const p = live.current.props;
    const pose = p.manifest.poses[name];
    if (!pose) return console.warn(`setPose: no pose "${name}" in ${p.manifest.id}`);
    const ms = p.reducedMotion || instant ? 0 : SCENE_CONSTANTS.RESET_TWEEN_MS;
    st.pose = name;
    st.spread = name === "exploded" ? 1 : 0;
    st.presented = null; // the pose tween below moves it back too
    if (st.grab) drawOnTop(st.grab.object, false);
    lightRing(null);
    st.grab = null;
    st.rebase = false;
    st.hovered = null;
    for (const k of Object.keys(st.occupancy)) st.occupancy[k] = null;
    for (const [id, o] of st.objects) {
      const tr = pose[id] ?? st.original.get(id);
      if (tr) void tweenTo(o, tr, ms, invalidate);
      const rest = p.manifest.components.find((c) => c.id === id)?.restSocketId;
      if (!pose[id] && rest && rest in st.occupancy) st.occupancy[rest] = id;
    }
    syncFilled();
    refresh();
  };

  /** Back to the activity's pose with sockets as it sets them (the engine's reset command, and the R key). */
  const reset = () => {
    const p = live.current.props;
    setPose(p.pose ?? Object.keys(p.manifest.poses)[0] ?? "");
    if (st.roll) {
      st.roll = 0;
      placeCamera();
    }
    p.announce("Scene reset");
  };

  /** The worked example: pulse the part and, given a socket, tween it in, hold, and tween it back. */
  /** Tour: pull `id` straight out toward where `cameraTo(id)` puts the camera (its hotspot's side), a little raised. */
  const present = (id: string | null) => {
    const ms = live.current.props.reducedMotion ? 0 : DEMO_TWEEN_MS;
    if (st.presented) void tweenTo(st.presented.o, st.presented.from, ms, invalidate);
    st.presented = null;
    const o = id ? st.objects.get(id) : undefined;
    if (!o?.parent) return;
    st.presented = { o, from: { position: o.position.toArray(), rotation: [o.rotation.x, o.rotation.y, o.rotation.z] } as Transform };
    const hs = live.current.props.manifest.hotspots.find((h) => h.componentId === id)?.id;
    const m = hs ? st.markers.get(hs) : undefined;
    const face = m?.parent ? m.getWorldPosition(new Vector3()).sub(m.parent.getWorldPosition(new Vector3())) : camera.position.clone();
    const toward = new Vector3(...cameraPosition(poseFacing(face.toArray(), st.cam.distance))).setLength(PRESENT_TOWARD);
    const target = o.parent.worldToLocal(o.getWorldPosition(new Vector3()).add(toward).add(new Vector3(0, PRESENT_RISE, 0)));
    void tweenTo(o, { position: target.toArray(), rotation: st.presented.from.rotation }, ms, invalidate);
  };

  const demonstrate = (id: string, socketId?: string) => {
    const o = st.objects.get(id);
    const socket = live.current.props.manifest.sockets.find((x) => x.id === socketId);
    if (!o) return console.warn(`demonstrate: unknown component ${id}`);
    const running = st.pulse.size > 0;
    st.pulse.set(id, performance.now());
    if (!running) pulseLoop();
    if (!socket || st.grab?.componentId === id) return;
    // Reduced motion: the part jumps in and back (no tween), so the example still shows where it goes.
    const ms = live.current.props.reducedMotion ? 0 : DEMO_TWEEN_MS;
    const back = { position: o.position.toArray(), rotation: [o.rotation.x, o.rotation.y, o.rotation.z] } as Transform;
    void tweenTo(o, socket.transform, ms, invalidate)
      .then(() => new Promise((r) => setTimeout(r, DEMO_HOLD_MS)))
      .then(() => tweenTo(o, back, ms, invalidate));
  };

  /** X: the exploded view, and back to the activity's pose. */
  const toggleExplode = () => {
    const p = live.current.props;
    if (!p.manifest.poses.exploded || p.studyParity) return; // keyboard-only: off in study sessions, like dolly
    const back = p.pose && p.pose !== "exploded" ? p.pose : "assembled";
    setPose(st.pose === "exploded" ? back : "exploded");
    p.announce(st.pose === "exploded" ? "Exploded view" : "Assembled view");
  };

  /**
   * Two-hand explode (dev only): move every part along the line from its assembled transform to the exploded
   * pose, past it up to SPREAD_MAX. Leaving the assembled pose frees the sockets like X does; closing fully
   * returns to the activity's pose, which restores them.
   */
  const spreadBy = (delta: number) => {
    const p = live.current.props;
    const ex = p.manifest.poses.exploded;
    if (!ex || p.studyParity) return;
    if (st.pose !== "exploded") {
      if (delta <= 0) return;
      setPose("exploded", true); // frees the sockets; the direct placement below replaces it at once
      p.announce("Exploded view");
      st.spread = 0;
    }
    st.spread = Math.min(SPREAD_MAX, Math.max(0, st.spread + delta));
    if (st.spread === 0) {
      setPose(p.pose && p.pose !== "exploded" ? p.pose : "assembled");
      return p.announce("Assembled view");
    }
    const q = new Quaternion();
    for (const [id, o] of st.objects) {
      const a = st.original.get(id);
      const b = ex[id] ?? a;
      if (!a || !b) continue;
      o.position.set(...a.position).lerp(new Vector3(...b.position), st.spread);
      o.quaternion.setFromEuler(new Euler(...a.rotation)).slerp(q.setFromEuler(new Euler(...b.rotation)), Math.min(1, st.spread));
    }
    invalidate();
    refresh();
  };

  const dollyBy = (factor: number) => {
    if (live.current.props.studyParity) return;
    st.camTween++;
    st.spinOff = true;
    st.cam = dolly(st.cam, factor);
    placeCamera();
  };
  props.wheelHandler.current = (ev) => dollyBy(ev.deltaY > 0 ? DOLLY_STEP : 1 / DOLLY_STEP);

  // Keyboard equivalents (doc 05 section 7): synthesize the same events at the focused part's screen position.
  props.keyHandler.current = (ev) => {
    const is = (action: keyof typeof KEY_MAP) => (KEY_MAP[action] as readonly string[]).includes(ev.key);
    if (is("reset")) return reset();
    if (is("explode")) return toggleExplode();
    if (is("dollyIn")) return dollyBy(1 / DOLLY_STEP);
    if (is("dollyOut")) return dollyBy(DOLLY_STEP);
    const ids = focusable();
    if (ev.key === "Tab") {
      if (st.grab) return void ev.preventDefault(); // keep focus on the held part
      const next = st.focus + (ev.shiftKey ? -1 : 1);
      st.focus = next >= 0 && next < ids.length ? next : -1;
      refresh();
      if (st.focus === -1) return; // past either end: let focus leave the scene (no keyboard trap)
      ev.preventDefault();
      const id = ids[st.focus]!;
      const socket = Object.keys(st.occupancy).find((k) => st.occupancy[k] === id);
      if (graded()) return props.announce(`Part ${st.focus + 1} of ${ids.length}`);
      props.announce(`${nameOf(id)}${st.markers.has(id) ? ", marker" : socket ? `, in ${socket}` : ""}`);
      return;
    }
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[ev.key];
    // Arrows with nothing held turn the model, like a drag on empty space.
    if (dir && !st.grab) {
      if (live.current.props.allowOrbit === false) return;
      ev.preventDefault();
      const step = (KEY_ORBIT_DEG * (ev.shiftKey ? SCENE_CONSTANTS.KEY_STEP_SHIFT_MULTIPLIER : 1)) / (SCENE_CONSTANTS.ORBIT_GAIN_DEG / 2);
      st.camTween++;
      st.spinOff = true;
      st.cam = orbitFrom(st.cam, { x: 0, y: 0 }, { x: dir[0]! * step, y: dir[1]! * step });
      return placeCamera();
    }
    const id = ids[st.focus];
    if (!id) return;
    const t = performance.now();
    // Enter selects the focused part or marker (doc 05 section 7); while a part is held it releases, like Space.
    if (!st.grab && is("select")) {
      ev.preventDefault();
      emit(st.markers.has(id) ? { type: "select", hotspotId: id, method: "click", t } : { type: "select", componentId: id, method: "click", t });
      props.announce(`Selected ${nameOf(id)}`);
      return;
    }
    if (st.markers.has(id)) return; // markers select; they do not grab
    if (is("grabToggle")) {
      ev.preventDefault();
      if (!st.grab) {
        const p = st.objects.get(id)!.position.clone().project(camera);
        st.kbCursor = { x: p.x, y: p.y };
        handle({ type: "grab_start", cursor: { x: 0, y: 0 }, t }, "canvas", st.kbCursor);
      } else {
        handle({ type: "grab_end", cursor: { x: 0, y: 0 }, reason: "release", t }, "canvas", st.kbCursor);
      }
      return;
    }
    if (dir && st.grab) {
      ev.preventDefault();
      const step = KEY_NDC_STEP * (ev.shiftKey ? SCENE_CONSTANTS.KEY_STEP_SHIFT_MULTIPLIER : 1);
      st.kbCursor = { x: st.kbCursor.x + dir[0]! * step, y: st.kbCursor.y + dir[1]! * step };
      handle({ type: "grab_move", cursor: { x: 0, y: 0 }, zHintDelta: 0, t }, "canvas", st.kbCursor);
    }
  };

  useEffect(() => {
    props.onReady({
      dispatch: (e, space) => handle(e, space),
      apply(cmd) {
        if (cmd.type === "setSocketVisual") setVisualOverrides((v) => ({ ...v, [cmd.socketId]: cmd.visual }));
        else if (cmd.type === "reset") reset();
        else if (cmd.type === "setPose") setPose(cmd.pose);
        else if (cmd.type === "demonstrate") demonstrate(cmd.componentId, cmd.socketId);
        else if (cmd.type === "present") present(cmd.componentId);
        else if (cmd.type === "cameraTo") cameraTo(cmd.target);
        else if (cmd.type === "setVisible") {
          for (const id of cmd.ids) {
            const o = st.objects.get(id);
            if (o) o.visible = cmd.visible;
          }
          refresh();
        } else if (cmd.type === "highlight" && !cmd.style) {
          const running = st.pulse.size > 0;
          for (const id of cmd.ids) st.pulse.set(id, performance.now());
          if (!running) pulseLoop();
        } else if (cmd.type === "highlight" && cmd.style) {
          const hex = OUTCOME_TINT[cmd.style];
          for (const id of cmd.ids) st.outcome.set(id, hex);
          refresh();
          setTimeout(() => {
            for (const id of cmd.ids) if (st.outcome.get(id) === hex) st.outcome.delete(id);
            refresh();
          }, cmd.durationMs ?? OUTCOME_TINT_MS);
        } else console.warn(`scene command ${cmd.type} is V1`); // playAnimation
        invalidate();
      },
      snapshot: () =>
        snapshotSceneState({
          modelId: manifest.id,
          camera,
          components: st.objects,
          occupancy: st.occupancy,
          hovered: st.hovered,
          grabbed: st.grab?.componentId ?? null,
          lastEvent: st.lastEvent,
        }),
      canvas: gl.domElement,
    });
    // The handle is created once; it reads current props through `live`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Turntable (introduction). One rAF loop renders every frame while it turns, like a drag does; it ends when the
  // learner takes over. Leaving the activity untouched tweens back to the default view for the next one.
  useEffect(() => {
    if (!props.autoRotate || props.reducedMotion) return;
    st.spinOff = false;
    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      if (st.spinOff) return;
      if (!st.orbit && !st.grab) {
        st.cam = { ...st.cam, azimuth: st.cam.azimuth + ((now - last) / 1000) * SPIN_DEG_PER_S };
        placeCamera();
        invalidate();
      }
      last = now;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      // The default view nearest the current angle, so the tween turns less than half a revolution.
      const d = manifest.defaultCamera.azimuth;
      if (!st.spinOff) tweenCamera({ ...manifest.defaultCamera, azimuth: d + Math.round((st.cam.azimuth - d) / 360) * 360 });
      st.spinOff = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.autoRotate, props.reducedMotion]);

  // Activity changes: a new pose prop tweens there (the first pose is applied at registration).
  useEffect(() => {
    if (model && props.pose && props.pose !== st.pose) setPose(props.pose);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.pose, model]);

  // The activity's visible set; runs after the components register (child effects run first).
  useEffect(() => {
    const only = props.visibleComponents;
    for (const [id, o] of st.objects) o.visible = !only || only.includes(id);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.visibleComponents, model]);

  return (
    <>
      {manifest.components.map((c) => (
        model?.nodes.has(c.id) && <ComponentMesh key={c.id} component={c} node={model.nodes.get(c.id)!} register={register} />
      ))}
      {manifest.sockets
        .filter((x) => !filled.has(x.id))
        .map((x) => (
          <SocketMarker key={x.id} socket={x} visual={visualOverrides[x.id] ?? socketVisual ?? x.visual} register={registerRing} />
        ))}
      {props.showHotspots !== false && manifest.hotspots.map((h) => {
        const node = model?.nodes.get(h.componentId);
        return node && <Hotspot key={h.id} hotspot={h} node={node} register={registerMarker} />;
      })}
      {model?.scenery.map((o) => <primitive key={o.uuid} object={o} />)}
    </>
  );
}, sameIgnoringCallbacks);
