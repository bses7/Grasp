/**
 * @grasp/scene: R3F scene, raycast, drag plane, sockets, hotspots, scene commands.
 * The scene reports select, place, drop, hover; it never grades.
 * Boundary: never imports @grasp/learning or @grasp/tutor; no network calls.
 */
export { SCENE_CONSTANTS } from "./constants";
export type { SceneConstants, StudyParityCapability } from "./constants";

export { coverFit, landmarkToNdc } from "./coords";
export type { Cursor, Ndc, Viewport } from "./coords";

export { INTERACTABLE_LAYER, createInteractableRaycaster } from "./raycast";
export type { InteractableHit, InteractableRaycaster } from "./raycast";

export { beginGrab, moveGrab, endGrab } from "./drag-plane";
export type { AxisLocks, GrabEndResult, GrabState } from "./drag-plane";

export { nearestAcceptingSocket, snapTo, resolveSocketVisual } from "./sockets";
export type { SocketOccupancy } from "./sockets";

export { applySceneCommand } from "./commands";
export type { SceneHandle } from "./commands";

export { snapshotSceneState, diffSceneState } from "./scene-state";
export type { SnapshotInput, SceneStateDiff } from "./scene-state";

export { LessonScene } from "./components/lesson-scene";
export type { LessonSceneProps, LessonSceneReadyHandle } from "./components/lesson-scene";
export { ComponentMesh } from "./components/component-mesh";
export type { ComponentMeshProps } from "./components/component-mesh";
export { SocketMarker } from "./components/socket-marker";
export type { SocketMarkerProps } from "./components/socket-marker";
export { Hotspot } from "./components/hotspot";
export type { HotspotProps } from "./components/hotspot";
export { OrbitRig } from "./components/orbit-rig";
export type { OrbitPose, OrbitRigProps } from "./components/orbit-rig";
export { MouseControls, KEY_MAP } from "./components/mouse-controls";
export type { KeyAction, MouseControlsProps } from "./components/mouse-controls";
export { PrototypeCanvas } from "./components/prototype-canvas";
export type { PrototypeCanvasProps } from "./components/prototype-canvas";
