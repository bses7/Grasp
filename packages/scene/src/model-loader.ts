/**
 * GLB loading (doc 05 section 8, doc 17 M9). The decoder is self-hosted under public/draco/ so the CSP
 * stays 'self'. `parseGlb` takes bytes, not a URL: the dev review page reads a local file, and parsing
 * from memory needs no fetch at all.
 */
import { Box3, Vector3, type Group, type Material, type Mesh, type Object3D } from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type GlbPart = {
  /** The glTF node name as three.js reports it (spaces become underscores). */
  name: string;
  object: Mesh;
  triangles: number;
  /** World-space bounding-box size, model units. */
  size: [number, number, number];
  materialName: string;
};

let draco: DRACOLoader | null = null;

/** Parse a .glb from memory. Every mesh gets its own material copy so one part can be tinted alone. */
export function parseGlb(data: ArrayBuffer, dracoDecoderPath: string): Promise<{ scene: Group; parts: GlbPart[] }> {
  draco ??= new DRACOLoader().setDecoderPath(dracoDecoderPath);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  return new Promise((resolve, reject) => {
    loader.parse(
      data,
      "",
      (gltf) => {
        gltf.scene.updateMatrixWorld(true);
        const parts: GlbPart[] = [];
        gltf.scene.traverse((o: Object3D) => {
          const mesh = o as Mesh;
          if (!mesh.isMesh) return;
          const mats = ([] as Material[]).concat(mesh.material);
          mesh.material = mats.length === 1 ? mats[0]!.clone() : mats.map((m) => m.clone());
          const g = mesh.geometry;
          const triangles = Math.round((g.index ? g.index.count : g.attributes.position!.count) / 3);
          const s = new Box3().setFromObject(mesh).getSize(new Vector3());
          parts.push({
            name: mesh.name || mesh.parent?.name || mesh.uuid,
            object: mesh,
            triangles,
            size: [s.x, s.y, s.z],
            materialName: mats.map((m) => m.name).join(", "),
          });
        });
        resolve({ scene: gltf.scene, parts });
      },
      reject,
    );
  });
}
