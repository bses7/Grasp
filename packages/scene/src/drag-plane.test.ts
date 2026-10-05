import type { Socket } from "@grasp/types";
import { Object3D, PerspectiveCamera } from "three";
import { describe, expect, it } from "vitest";
import { coverFit, landmarkToNdc } from "./coords";
import { beginGrab, endGrab, moveGrab } from "./drag-plane";
import { nearestAcceptingSocket, type SocketOccupancy } from "./sockets";

function setup() {
  const camera = new PerspectiveCamera(45, 16 / 9, 0.1, 500);
  camera.position.set(0, 0, 40);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const obj = new Object3D();
  obj.userData = { componentId: "aorta", grabbable: true };
  obj.position.set(-10, 5, 0);
  return { camera, obj };
}

const socket = (id: string, x: number, accepts: string[]): Socket => ({
  id,
  transform: { position: [x, 0, 0], rotation: [0, 0, 0] },
  radius: 3,
  accepts,
  visual: "ring",
});
const SOCKETS = [socket("socket_aorta", 10, ["aorta", "pulmonary_artery"]), socket("socket_lv", -10, ["left_ventricle"])];

/** NDC of a world point, i.e. where the cursor sits when it is over that point. */
function ndcOf(camera: PerspectiveCamera, x: number, y: number, z = 0) {
  const p = camera.position.clone().set(x, y, z).project(camera);
  return { x: p.x, y: p.y };
}

describe("coords", () => {
  it("is the identity for a mouse cursor (same aspect, no reach scale)", () => {
    const vp = { videoAspect: 1.5, canvasAspect: 1.5, mirrored: true, reachScale: 1 };
    expect(coverFit({ x: 0.25, y: 0.75 }, vp)).toEqual({ u: 0.25, v: 0.75 });
    expect(landmarkToNdc({ x: 0.5, y: 0.5 }, vp)).toEqual({ x: 0, y: 0 });
  });

  it("crops the video's top and bottom when the canvas is wider", () => {
    // 16:9 video on a 32:9 canvas: only the middle half of the video height is visible
    const vp = { videoAspect: 16 / 9, canvasAspect: 32 / 9, mirrored: true, reachScale: 1 };
    expect(coverFit({ x: 0.5, y: 0.25 }, vp)).toEqual({ u: 0.5, v: 0 });
    expect(coverFit({ x: 0.5, y: 0.5 }, vp).v).toBeCloseTo(0.5);
  });
});

describe("drag plane", () => {
  it("keeps the grab offset: the object moves exactly with the cursor on the camera plane", () => {
    const { camera, obj } = setup();
    const occ: SocketOccupancy = {};
    // grab 1 unit right of the object's centre, then move the cursor 5 units right
    const grab = beginGrab("aorta", obj, ndcOf(camera, -9, 5), camera, occ)!;
    for (let i = 0; i < 20; i++) moveGrab(grab, ndcOf(camera, -4, 5), camera, 0); // lerp converges
    expect(obj.position.x).toBeCloseTo(-5, 2);
    expect(obj.position.y).toBeCloseTo(5, 2);
    expect(obj.position.z).toBeCloseTo(0, 5); // never leaves the plane without a z-hint
  });

  it("clamps the z-hint per frame", () => {
    const { camera, obj } = setup();
    const grab = beginGrab("aorta", obj, ndcOf(camera, -10, 5), camera, {})!;
    moveGrab(grab, ndcOf(camera, -10, 5), camera, 100);
    // target moved at most Z_MAX (0.15) toward -z, and DRAG_LERP halves it
    expect(obj.position.z).toBeCloseTo(-0.075, 3);
  });

  it("detaches from the socket it was grabbed out of", () => {
    const { camera, obj } = setup();
    const occ: SocketOccupancy = { socket_aorta: "aorta" };
    const grab = beginGrab("aorta", obj, ndcOf(camera, -10, 5), camera, occ)!;
    expect(grab.detachedFromSocketId).toBe("socket_aorta");
    expect(occ.socket_aorta).toBeNull();
  });
});

describe("endGrab", () => {
  it("places into an accepting socket within radius and marks it occupied", () => {
    const { camera, obj } = setup();
    const occ: SocketOccupancy = {};
    const grab = beginGrab("aorta", obj, ndcOf(camera, -10, 5), camera, occ)!;
    obj.position.set(9, 1, 0);
    const r = endGrab(grab, "release", SOCKETS, occ, 1);
    expect(r.event).toEqual({ type: "place", componentId: "aorta", socketId: "socket_aorta", t: 1 });
    expect(r.snapTo?.id).toBe("socket_aorta");
    expect(occ.socket_aorta).toBe("aorta");
  });

  it("drops with cause release outside any radius or at a socket that does not accept it", () => {
    const { camera, obj } = setup();
    const grab = beginGrab("aorta", obj, ndcOf(camera, -10, 5), camera, {})!;
    obj.position.set(-10, 0.5, 0); // inside socket_lv's radius, but it accepts only left_ventricle
    const r = endGrab(grab, "release", SOCKETS, {}, 2);
    expect(r.event).toEqual({ type: "drop", componentId: "aorta", position: [-10, 0.5, 0], cause: "release", t: 2 });
    expect(r.snapTo).toBeNull();
  });

  it("never snaps on a lost release, even inside an accepting socket", () => {
    const { camera, obj } = setup();
    const occ: SocketOccupancy = {};
    const grab = beginGrab("aorta", obj, ndcOf(camera, -10, 5), camera, occ)!;
    obj.position.set(10, 0, 0);
    const r = endGrab(grab, "lost", SOCKETS, occ, 3);
    expect(r.event).toMatchObject({ type: "drop", cause: "lost" });
    expect(r.snapTo).toBeNull();
    expect(occ.socket_aorta).toBeUndefined();
  });

  it("skips a socket occupied by another component", () => {
    const { obj } = setup();
    obj.position.set(10, 0, 0);
    expect(nearestAcceptingSocket(obj, SOCKETS, { socket_aorta: "pulmonary_artery" })).toBeNull();
    expect(nearestAcceptingSocket(obj, SOCKETS, { socket_aorta: null })?.id).toBe("socket_aorta");
  });
});
