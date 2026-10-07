import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { landmarkToNdc, type Viewport } from "./coords";
import { createInteractableRaycaster, INTERACTABLE_LAYER } from "./raycast";

const VIDEO = 16 / 9;

/** Boxes at the four canvas corners (NDC ±0.8) and the centre, on the z = 0 plane. */
function sceneAt(canvasAspect: number) {
  const camera = new PerspectiveCamera(45, canvasAspect, 0.1, 500);
  camera.position.set(0, 0, 40);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const targets: Record<string, [number, number]> = {
    top_left: [-0.8, 0.8],
    top_right: [0.8, 0.8],
    bottom_left: [-0.8, -0.8],
    bottom_right: [0.8, -0.8],
    centre: [0, 0],
  };
  const objects = Object.entries(targets).map(([id, [x, y]]) => {
    // Unproject the NDC point onto z = 0 to find where the box must sit.
    const p = new Vector3(x, y, 0.5).unproject(camera).sub(camera.position).normalize();
    const at = camera.position.clone().addScaledVector(p, -camera.position.z / p.z);
    const g = new Group();
    g.userData = { componentId: id, grabbable: true };
    const m = new Mesh(new BoxGeometry(1.5, 1.5, 1.5), new MeshBasicMaterial());
    m.layers.enable(INTERACTABLE_LAYER);
    g.add(m);
    g.position.copy(at);
    g.updateMatrixWorld(true);
    return g;
  });
  return { camera, objects, targets };
}

/**
 * Camera-frame cursor that should land on canvas point (u, v): the inverse of cover-fit, written out
 * independently of coords.ts. The video covers the canvas, so the axis with spare video is cropped.
 */
function cameraCursorFor(u: number, v: number, canvasAspect: number) {
  const visX = Math.min(1, canvasAspect / VIDEO);
  const visY = Math.min(1, VIDEO / canvasAspect);
  return { x: (1 - visX) / 2 + u * visX, y: (1 - visY) / 2 + v * visY };
}

describe.each([
  ["16:9", 16 / 9],
  ["4:3", 4 / 3],
])("coordinate chain to raycast at a %s canvas", (_label, canvasAspect) => {
  const viewport: Viewport = { videoAspect: VIDEO, canvasAspect, mirrored: true, reachScale: 1 };
  const { camera, objects, targets } = sceneAt(canvasAspect);
  const ray = createInteractableRaycaster();

  it.each(Object.keys(targets))("a camera cursor over %s hits it", (id) => {
    const [nx, ny] = targets[id]!;
    const cursor = cameraCursorFor((nx + 1) / 2, (1 - ny) / 2, canvasAspect);
    expect(ray.hit(landmarkToNdc(cursor, viewport), camera, objects).componentId).toBe(id);
  });

  it("misses in empty space and reports nothing grabbable", () => {
    const hit = ray.hit(landmarkToNdc(cameraCursorFor(0.5, 0.25, canvasAspect), viewport), camera, objects);
    expect(hit).toMatchObject({ componentId: null, isGrabbable: false });
  });
});

describe("raycast cost", () => {
  it("stays well under 1 ms per frame for the prototype scene", () => {
    const { camera, objects } = sceneAt(16 / 9);
    const ray = createInteractableRaycaster();
    const n = 2000;
    const t0 = performance.now();
    for (let i = 0; i < n; i++) ray.hit({ x: Math.sin(i) * 0.9, y: Math.cos(i) * 0.9 }, camera, objects);
    expect((performance.now() - t0) / n).toBeLessThan(1);
  });
});
