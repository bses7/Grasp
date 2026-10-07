/**
 * One interactable component: the GLB node whose name equals the component id (doc 05 section 8, M9).
 * Tags the node with userData.componentId / grabbable and puts its meshes on INTERACTABLE_LAYER.
 * The pose lives only on the Object3D: LessonScene applies the start pose once at registration, and a
 * re-render can never move a part the learner has dragged. Highlights are emissive swaps by LessonScene.
 */
import type { Component } from "@grasp/types";
import { useEffect, useMemo } from "react";
import type { Mesh, Object3D } from "three";
import { INTERACTABLE_LAYER } from "../raycast";

export type ComponentMeshProps = {
  component: Component;
  /** The GLB node named `component.id`. */
  node: Object3D;
  register: (id: string, object: Object3D | null) => void;
};

export function ComponentMesh({ component, node, register }: ComponentMeshProps) {
  useMemo(() => {
    node.userData.componentId = component.id;
    node.userData.grabbable = component.grabbable;
    node.traverse((o) => {
      if ((o as Mesh).isMesh) o.layers.enable(INTERACTABLE_LAYER);
    });
  }, [node, component.id, component.grabbable]);

  useEffect(() => {
    register(component.id, node);
    return () => register(component.id, null);
  }, [component.id, node, register]);

  return <primitive object={node} />;
}
