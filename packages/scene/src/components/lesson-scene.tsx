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
 * Orbit and hotspots are Phase 4.
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
import { memo, useEffect, useRef, useState, type CSSProperties, type MutableRefObject, type RefObject } from "react";
import type { Mesh, MeshStandardMaterial, Object3D } from "three";
import type { Transform } from "@grasp/types";
import { parseGlb } from "../model-loader";
import { applySceneCommand } from "../commands";
import { SCENE_CONSTANTS } from "../constants";
import { landmarkToNdc, type Ndc, type Viewport } from "../coords";
import { beginGrab, endGrab, moveGrab, rebaseGrab, type GrabState } from "../drag-plane";
import { createInteractableRaycaster } from "../raycast";
import { snapshotSceneState } from "../scene-state";
import { snapTo, tweenTo, type SocketOccupancy } from "../sockets";
import { ComponentMesh } from "./component-mesh";
import { KEY_MAP } from "./mouse-controls";
import { SocketMarker } from "./socket-marker";

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
  /** Base URL the GLB is served under, as <base>/<manifest.id>/<manifest.file>; default "/models". */
  assetBaseUrl?: string;
  /** Self-hosted Draco decoder directory; default "/draco/". */
  dracoDecoderPath?: string;
  /** Disables capabilities listed in STUDY_PARITY_DISABLES (camera dolly). */
  studyParity?: boolean;
  reducedMotion?: boolean;
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

const TINT = { none: 0x000000, focused: 0x1e3a8a, hovered: 0x2f5d3a, grabbed: 0x6b4423 };
/** Emissive versions of the doc 11 success / partial / error roles (dimmed: emissive adds to the base colour). */
const OUTCOME_TINT = { correct: 0x1f8f52, partial: 0x9c6a1c, incorrect: 0x9e2a40 };
const OUTCOME_TINT_MS = 1200;

const CURSOR_STYLE: CSSProperties = {
  position: "absolute",
  left: 0,
  top: 0,
  width: 22,
  height: 22,
  margin: -11,
  borderRadius: "50%",
  border: "3px solid #f7fafc",
  boxShadow: "0 0 0 2px rgba(0,0,0,0.5)",
  pointerEvents: "none",
  display: "none",
};
/** Keyboard cursor step in NDC per arrow press; Shift multiplies. */
const KEY_NDC_STEP = 0.03;

function cameraPosition({ azimuth, elevation, distance }: ModelManifest["defaultCamera"]): [number, number, number] {
  const az = (azimuth * Math.PI) / 180;
  const el = (elevation * Math.PI) / 180;
  return [distance * Math.cos(el) * Math.sin(az), distance * Math.sin(el), distance * Math.cos(el) * Math.cos(az)];
}

export function LessonScene(props: LessonSceneProps) {
  const [announcement, setAnnouncement] = useState("");
  const keyHandler = useRef<((e: KeyboardEvent) => void) | undefined>(undefined);
  const cursorEl = useRef<HTMLDivElement>(null);
  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      tabIndex={0}
      aria-label="3D scene. Tab to choose a part, Space to grab or release it, arrow keys to move it."
      onKeyDown={(e) => keyHandler.current?.(e.nativeEvent)}
    >
      <Canvas
        frameloop="demand"
        dpr={[...SCENE_CONSTANTS.DPR_RANGE]}
        camera={{ fov: 45, near: 0.1, far: 500, position: cameraPosition(props.manifest.defaultCamera) }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
        style={{ touchAction: "none" }}
      >
        <hemisphereLight intensity={0.8} />
        <directionalLight position={[10, 20, 30]} intensity={1.8} />
        <SceneController {...props} announce={setAnnouncement} keyHandler={keyHandler} cursorEl={cursorEl} />
      </Canvas>
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
  cursorEl: RefObject<HTMLDivElement | null>;
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
  };
  const st = s.current;

  const startPose = manifest.poses[props.pose ?? Object.keys(manifest.poses)[0] ?? ""] ?? {};
  function syncFilled() {
    setFilled(new Set(Object.keys(st.occupancy).filter((k) => st.occupancy[k])));
  }
  const nameOf = (id: string) => manifest.components.find((c) => c.id === id)?.name ?? id;
  const focusable = () => live.current.props.manifest.components.filter((c) => c.interactable).map((c) => c.id);

  // The start pose is applied once per component id, ever: a ref detach/re-attach on re-render must
  // never move a part that the learner has already dragged or placed.
  const register = useRef((id: string, o: Object3D | null) => {
    if (!o) return void st.objects.delete(id);
    if (!st.posed.has(id)) {
      st.original.set(id, { position: o.position.toArray(), rotation: [o.rotation.x, o.rotation.y, o.rotation.z] });
      const tr = startPose[id];
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

  /** Emissive tint: grabbed beats outcome feedback beats hovered beats keyboard focus. */
  const refresh = () => {
    const focusedId = focusable()[st.focus];
    for (const [id, o] of st.objects) {
      const hex =
        st.grab?.componentId === id
          ? TINT.grabbed
          : st.outcome.has(id)
            ? st.outcome.get(id)!
            : st.hovered === id
            ? TINT.hovered
            : focusedId === id
              ? TINT.focused
              : TINT.none;
      o.traverse((c) => {
        const m = (c as Mesh).material as MeshStandardMaterial | undefined;
        m?.emissive?.setHex(hex);
      });
    }
    invalidate();
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
    el.style.borderColor = st.grab ? "#e53e3e" : "#f7fafc";
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
          reachScale: fromCamera ? (p.viewport?.reachScale ?? 1) : 1,
        });
      if (fromCamera) drawCursor(ndc);
      return ndc;
    };

    if (e.type === "cursor" || e.type === "hover") {
      if (st.grab) return;
      const hit = st.raycaster.hit(toNdc(e.cursor), camera, [...st.objects.values()]);
      const id = hit.componentId ?? hit.hotspotId;
      // Only the hand's cursor answers the vision FSM; a mouse hover must not steer the gesture grab rule.
      if (fromCamera) p.onHoverResult?.({ type: "hover_result", hoveredId: id, isGrabbable: hit.isGrabbable, t });
      updateHover(id, t);
    } else if (e.type === "tracking_lost" || (e.type === "hand_count" && e.n === 0)) {
      // The held part stays exactly where it is; the worker decides between regain and a lost release.
      drawCursor(null);
      if (!st.grab) updateHover(null, t);
    } else if (e.type === "tracking_regained") {
      st.rebase = true;
    } else if (e.type === "grab_start") {
      if (p.allowGrab === false || st.grab) return;
      const ndc = toNdc(e.cursor);
      const hit = st.raycaster.hit(ndc, camera, [...st.objects.values()]);
      if (!hit.componentId) return; // empty space: orbit arrives with the full environment (Phase 4)
      emit({ type: "select", componentId: hit.componentId, method: "grab", t });
      if (!hit.isGrabbable) return;
      st.grab = beginGrab(hit.componentId, st.objects.get(hit.componentId)!, ndc, camera, st.occupancy);
      st.hovered = hit.componentId;
      refresh();
      p.announce(`Grabbed ${nameOf(hit.componentId)}`);
    } else if (e.type === "grab_move") {
      if (!st.grab) return;
      const ndc = toNdc(e.cursor);
      if (st.rebase) {
        rebaseGrab(st.grab, ndc, camera);
        st.rebase = false;
      }
      moveGrab(st.grab, ndc, camera, e.zHintDelta);
      invalidate();
    } else if (e.type === "grab_end") {
      const g = st.grab;
      if (!g) return;
      st.grab = null;
      st.rebase = false;
      const { event, snapTo: socket } = endGrab(g, e.reason, p.manifest.sockets, st.occupancy, t);
      emit(event);
      syncFilled();
      if (socket) void snapTo(g.object, socket, p.reducedMotion ? 0 : SCENE_CONSTANTS.SNAP_EASE_MS, invalidate);
      refresh();
      p.announce(
        event.type === "place" ? `${nameOf(g.componentId)} placed in ${event.socketId}` : `${nameOf(g.componentId)} dropped`,
      );
    }
  };

  /** Back to the start pose with every socket empty (the engine's reset command, and the R key). */
  const reset = () => {
    const p = live.current.props;
    const ms = p.reducedMotion ? 0 : SCENE_CONSTANTS.RESET_TWEEN_MS;
    st.grab = null;
    st.rebase = false;
    st.hovered = null;
    for (const k of Object.keys(st.occupancy)) st.occupancy[k] = null;
    for (const [id, o] of st.objects) {
      const tr = startPose[id] ?? st.original.get(id);
      if (tr) void tweenTo(o, tr, ms, invalidate);
      const rest = p.manifest.components.find((c) => c.id === id)?.restSocketId;
      if (!startPose[id] && rest && rest in st.occupancy) st.occupancy[rest] = id;
    }
    syncFilled();
    refresh();
    p.announce("Scene reset");
  };

  // Keyboard equivalents (doc 05 section 7): synthesize the same events at the focused part's screen position.
  props.keyHandler.current = (ev) => {
    if ((KEY_MAP.reset as readonly string[]).includes(ev.key)) return reset();
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
      props.announce(`${nameOf(id)}${socket ? `, in ${socket}` : ""}`);
      return;
    }
    const id = ids[st.focus];
    if (!id) return;
    const t = performance.now();
    if ((KEY_MAP.grabToggle as readonly string[]).includes(ev.key)) {
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
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[ev.key];
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
        else if (cmd.type === "highlight" && cmd.style) {
          const hex = OUTCOME_TINT[cmd.style];
          for (const id of cmd.ids) st.outcome.set(id, hex);
          refresh();
          setTimeout(() => {
            for (const id of cmd.ids) if (st.outcome.get(id) === hex) st.outcome.delete(id);
            refresh();
          }, cmd.durationMs ?? OUTCOME_TINT_MS);
        } else applySceneCommand(cmd);
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

  return (
    <>
      {manifest.components.map((c) => (
        model?.nodes.has(c.id) && <ComponentMesh key={c.id} component={c} node={model.nodes.get(c.id)!} register={register} />
      ))}
      {manifest.sockets
        .filter((x) => !filled.has(x.id))
        .map((x) => (
          <SocketMarker key={x.id} socket={x} visual={visualOverrides[x.id] ?? socketVisual ?? x.visual} />
        ))}
      {model?.scenery.map((o) => <primitive key={o.uuid} object={o} />)}
    </>
  );
}, sameIgnoringCallbacks);
