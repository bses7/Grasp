import { Object3D, PerspectiveCamera } from "three";
import { describe, expect, it } from "vitest";
import { diffSceneState, snapshotSceneState } from "./scene-state";

function input() {
  const camera = new PerspectiveCamera();
  camera.position.set(0, 0, 40);
  const a = new Object3D();
  a.position.set(6.04, 7.96, -0.01);
  const b = new Object3D();
  b.position.set(-14, -9, 0);
  return {
    modelId: "proto_primitives",
    camera,
    components: new Map([
      ["aorta", a],
      ["left_ventricle", b],
    ]),
    occupancy: { socket_aorta: "aorta", socket_left_ventricle: null },
    hovered: null,
    grabbed: null,
    lastEvent: { type: "place", componentId: "aorta", socketId: "socket_aorta", t: 1 },
  };
}

describe("snapshotSceneState", () => {
  it("is compact: rounded positions, socket from occupancy, camera as an orbit pose", () => {
    const s = snapshotSceneState(input());
    expect(s.components.aorta).toEqual({ socketId: "socket_aorta", position: [6, 8, 0], visible: true });
    expect(s.components.left_ventricle!.socketId).toBeNull();
    expect(s.camera).toEqual({ azimuth: 0, elevation: 0, distance: 40 });
    expect(JSON.parse(JSON.stringify(s))).toEqual(s); // JSON-serialisable, nothing lost
  });
});

describe("diffSceneState", () => {
  it("reports only what changed", () => {
    const i = input();
    const a = snapshotSceneState(i);
    expect(diffSceneState(a, snapshotSceneState(i))).toEqual({ changed: [], components: [] });
    i.components.get("left_ventricle")!.position.set(10, -4, 0);
    const b = snapshotSceneState({ ...i, grabbed: "left_ventricle" });
    expect(diffSceneState(a, b)).toEqual({ changed: ["components", "grabbed"], components: ["left_ventricle"] });
  });
});
