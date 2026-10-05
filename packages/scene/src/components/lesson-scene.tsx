/**
 * <LessonScene>, the package's single mount point (M5).
 * Owns the R3F Canvas (frameloop="demand", dpr from SCENE_CONSTANTS), the interactable raycaster,
 * the drag plane and sockets. Consumes InteractionEvents through `dispatch` (mouse adapter or the
 * vision path, one code path) and emits SceneEvents. It never grades.
 *
 * Per-frame work lives in refs: grab_move mutates the Object3D and calls invalidate(), so a drag
 * causes zero React commits. Only discrete moments (grab, place, focus) update the live region.
 * M5 scope: grab, drag, snap, keyboard. Hover highlight is M6; orbit and hotspots are Phase 4.
 */
import type {
  InteractionEvent,
  ModelManifest,
  SceneCommand,
  SceneEvent,
  SceneState,
  SocketVisual,
} from "@grasp/types";
import { Canvas, useThree } from "@react-three/fiber";
import { memo, useEffect, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import type { Mesh, MeshStandardMaterial, Object3D } from "three";
import { applySceneCommand } from "../commands";
import { SCENE_CONSTANTS } from "../constants";
import { landmarkToNdc, type Ndc, type Viewport } from "../coords";
import { beginGrab, endGrab, moveGrab, type GrabState } from "../drag-plane";
import { createInteractableRaycaster } from "../raycast";
import { snapshotSceneState } from "../scene-state";
import { snapTo, type SocketOccupancy } from "../sockets";
import { ComponentMesh } from "./component-mesh";
import { KEY_MAP } from "./mouse-controls";
import { SocketMarker } from "./socket-marker";

export type LessonSceneReadyHandle = {
  /** Feed one interaction event through the doc 05 section 6 pseudocode. */
  dispatch(event: InteractionEvent): void;
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
  /** Base URL for GLB and draco decoder assets; default "/models" and "/draco". */
  assetBaseUrl?: string;
  /** Disables capabilities listed in STUDY_PARITY_DISABLES (camera dolly). */
  studyParity?: boolean;
  reducedMotion?: boolean;
  /** Camera-frame geometry for the gesture cursor (M6). Omit for the mouse: its cursor is already canvas-relative. */
  viewport?: Partial<Viewport>;
  onSceneEvent: (event: SceneEvent) => void;
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

const TINT = { none: 0x000000, focused: 0x1e3a8a, grabbed: 0x6b4423 };
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
        <SceneController {...props} announce={setAnnouncement} keyHandler={keyHandler} />
      </Canvas>
      <p style={SR_ONLY} aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}

type ControllerProps = LessonSceneProps & {
  announce: (text: string) => void;
  keyHandler: MutableRefObject<((e: KeyboardEvent) => void) | undefined>;
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
  };
  const st = s.current;

  const startPose = manifest.poses[props.pose ?? Object.keys(manifest.poses)[0] ?? ""] ?? {};
  const nameOf = (id: string) => manifest.components.find((c) => c.id === id)?.name ?? id;
  const focusable = () => live.current.props.manifest.components.filter((c) => c.interactable).map((c) => c.id);

  // The start pose is applied once per component id, ever: a ref detach/re-attach on re-render must
  // never move a part that the learner has already dragged or placed.
  const register = useRef((id: string, o: Object3D | null) => {
    if (!o) return void st.objects.delete(id);
    const tr = startPose[id];
    if (tr && !st.posed.has(id)) {
      o.position.set(...tr.position);
      o.rotation.set(...tr.rotation);
      st.posed.add(id);
    }
    st.objects.set(id, o);
  }).current;

  /** Emissive tint: grabbed beats focused; nothing else is highlighted until M6 hover. */
  const refresh = () => {
    const focusedId = focusable()[st.focus];
    for (const [id, o] of st.objects) {
      const hex = st.grab?.componentId === id ? TINT.grabbed : focusedId === id ? TINT.focused : TINT.none;
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

  const handle = (e: InteractionEvent, ndcOverride?: Ndc) => {
    const { props: p, size: sz } = live.current;
    const t = e.t ?? performance.now();
    const canvasAspect = sz.width / sz.height;
    const toNdc = (cursor: { x: number; y: number }) =>
      ndcOverride ??
      landmarkToNdc(cursor, {
        videoAspect: p.viewport?.videoAspect ?? canvasAspect,
        canvasAspect,
        mirrored: true,
        reachScale: p.viewport?.reachScale ?? 1,
      });

    if (e.type === "grab_start") {
      if (p.allowGrab === false || st.grab) return;
      const ndc = toNdc(e.cursor);
      const hit = st.raycaster.hit(ndc, camera, [...st.objects.values()]);
      if (!hit.componentId) return; // empty space: orbit arrives with the full environment (Phase 4)
      emit({ type: "select", componentId: hit.componentId, method: "grab", t });
      if (!hit.isGrabbable) return;
      st.grab = beginGrab(hit.componentId, st.objects.get(hit.componentId)!, ndc, camera, st.occupancy);
      refresh();
      p.announce(`Grabbed ${nameOf(hit.componentId)}`);
    } else if (e.type === "grab_move") {
      if (!st.grab) return;
      moveGrab(st.grab, toNdc(e.cursor), camera, e.zHintDelta);
      invalidate();
    } else if (e.type === "grab_end") {
      const g = st.grab;
      if (!g) return;
      st.grab = null;
      const { event, snapTo: socket } = endGrab(g, e.reason, p.manifest.sockets, st.occupancy, t);
      emit(event);
      if (socket) void snapTo(g.object, socket, p.reducedMotion ? 0 : SCENE_CONSTANTS.SNAP_EASE_MS, invalidate);
      refresh();
      p.announce(
        event.type === "place" ? `${nameOf(g.componentId)} placed in ${event.socketId}` : `${nameOf(g.componentId)} dropped`,
      );
    }
    // cursor and hover: M6 (raycast highlight); tracking_* and hand_count carry nothing for the scene.
  };

  // Keyboard equivalents (doc 05 section 7): synthesize the same events at the focused part's screen position.
  props.keyHandler.current = (ev) => {
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
        handle({ type: "grab_start", cursor: { x: 0, y: 0 }, t }, st.kbCursor);
      } else {
        handle({ type: "grab_end", cursor: { x: 0, y: 0 }, reason: "release", t }, st.kbCursor);
      }
      return;
    }
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[ev.key];
    if (dir && st.grab) {
      ev.preventDefault();
      const step = KEY_NDC_STEP * (ev.shiftKey ? SCENE_CONSTANTS.KEY_STEP_SHIFT_MULTIPLIER : 1);
      st.kbCursor = { x: st.kbCursor.x + dir[0]! * step, y: st.kbCursor.y + dir[1]! * step };
      handle({ type: "grab_move", cursor: { x: 0, y: 0 }, zHintDelta: 0, t }, st.kbCursor);
    }
  };

  useEffect(() => {
    props.onReady({
      dispatch: (e) => handle(e),
      apply(cmd) {
        if (cmd.type === "setSocketVisual") setVisualOverrides((v) => ({ ...v, [cmd.socketId]: cmd.visual }));
        else applySceneCommand(cmd);
        invalidate();
      },
      snapshot: () =>
        snapshotSceneState({
          modelId: manifest.id,
          camera,
          components: st.objects,
          occupancy: st.occupancy,
          hovered: null,
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
        <ComponentMesh key={c.id} component={c} register={register} />
      ))}
      {manifest.sockets.map((x) => (
        <SocketMarker key={x.id} socket={x} visual={visualOverrides[x.id] ?? socketVisual ?? x.visual} />
      ))}
    </>
  );
}, sameIgnoringCallbacks);
