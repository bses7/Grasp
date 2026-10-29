/**
 * Whole-model orbit (doc 05 section 3.3): azimuth, elevation and distance around the model origin, in the
 * manifest's defaultCamera convention (degrees, scene units). Pure math; LessonScene drives it from a
 * grab_start on empty space (hand or mouse), arrows with nothing grabbed, + / - and the wheel.
 * Preferred over Drei OrbitControls, which fights real pointer input in the mouse condition.
 */
import type { CameraPose, Vec3 } from "@grasp/types";
import type { Ndc } from "./coords";
import { SCENE_CONSTANTS } from "./constants";

const DISTANCE_RANGE: [number, number] = [8, 80];

export function cameraPosition({ azimuth, elevation, distance }: CameraPose): Vec3 {
  const az = (azimuth * Math.PI) / 180;
  const el = (elevation * Math.PI) / 180;
  return [distance * Math.cos(el) * Math.sin(az), distance * Math.sin(el), distance * Math.cos(el) * Math.cos(az)];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Pose after dragging the cursor from `start` to `now` (NDC: a full canvas width is 2 units). */
export function orbitFrom(pose0: CameraPose, start: Ndc, now: Ndc): CameraPose {
  const gain = SCENE_CONSTANTS.ORBIT_GAIN_DEG / 2;
  const max = SCENE_CONSTANTS.ORBIT_ELEVATION_MAX_DEG;
  // Dragging right turns the model right, so the camera moves left; dragging up tilts the model up.
  return {
    ...pose0,
    azimuth: pose0.azimuth - (now.x - start.x) * gain,
    elevation: clamp(pose0.elevation - (now.y - start.y) * gain, -max, max),
  };
}

export function dolly(pose: CameraPose, factor: number): CameraPose {
  return { ...pose, distance: clamp(pose.distance * factor, ...DISTANCE_RANGE) };
}

/** The pose on the same distance that faces `point` (model space) from outside the model. */
export function poseFacing(point: Vec3, distance: number): CameraPose {
  const [x, y, z] = point;
  if (Math.hypot(x, y, z) < 1e-6) return { azimuth: 0, elevation: 0, distance };
  const max = SCENE_CONSTANTS.ORBIT_ELEVATION_MAX_DEG;
  return {
    azimuth: (Math.atan2(x, z) * 180) / Math.PI,
    elevation: clamp((Math.atan2(y, Math.hypot(x, z)) * 180) / Math.PI, -max, max),
    distance,
  };
}

/** Interpolate along the shorter way round in azimuth. */
export function lerpPose(a: CameraPose, b: CameraPose, k: number): CameraPose {
  const dAz = ((((b.azimuth - a.azimuth) % 360) + 540) % 360) - 180;
  return {
    azimuth: a.azimuth + dAz * k,
    elevation: a.elevation + (b.elevation - a.elevation) * k,
    distance: a.distance + (b.distance - a.distance) * k,
  };
}
