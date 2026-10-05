/**
 * Hotspot marker and label (doc 05 section 3.7; Phase 4, after the prototype).
 * Marker: billboard sprite on INTERACTABLE_LAYER with userData.hotspotId.
 * Label: Drei <Html occlude> so it is real DOM for screen readers and focus.
 * Selectable like a component; emits { type: "select", hotspotId }.
 */
import type { Hotspot as HotspotData } from "@grasp/types";

export type HotspotProps = {
  hotspot: HotspotData;
  hovered: boolean;
  /** 0..1 dwell progress for the fill ring. */
  dwellProgress: number;
  showLabel: boolean;
};

export function Hotspot(_props: HotspotProps) {
  throw new Error("TODO Phase D: Hotspot (doc 05, Phase 4)");
}
