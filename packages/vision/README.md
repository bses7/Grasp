# @grasp/vision

Camera to interaction events. Runs MediaPipe Tasks Vision `HandLandmarker` in a Web Worker, smooths landmarks with One-Euro filters, classifies the five **MVP** gestures (`open_palm`, `point`, `pinch`, `pinch_drag`, `release`), and emits the `InteractionEvent` and `CvStatus` contracts from `@grasp/types`. Spec: [docs/04-computer-vision.md](../../docs/04-computer-vision.md). Phase C status: stubs only; every exported function throws `TODO Phase D`.

## Two invariants

1. **No landmarks are persisted.** Landmarks exist in worker memory for the current frame and are discarded. Nothing in this package writes landmarks to a log, store, message, or network; only derived scalars (features, events, `cv_status`, `perf_sample`) leave the worker.
2. **No scene knowledge beyond `hover_result`.** The worker receives `{ type: "hover_result", hoveredId, isGrabbable, t }` and nothing else about the scene. This package imports only `@grasp/types` and `@mediapipe/tasks-vision`; never `three`, `react`, `@grasp/scene`, or `@grasp/learning`.

## Contents by milestone (doc 17)

| Milestone | Files | Delivers |
|---|---|---|
| M1 camera and landmarks | `worker/hand-landmarker.worker.ts` (init path), `constants.ts` | `HandLandmarker` init with self-hosted WASM and `.task`, 640x360 capture, `initialising` / `ok` / `no_hand` status line |
| M2 One-Euro and cursor | `one-euro.ts`, `landmarks.ts` | Filter class with unit tests; `handSize`, `pinchDist`, `palmCenter`, `cursorFor`; `beta` 5.0 settled empirically |
| M3 pinch FSM | `gesture-fsm.ts`, `gesture-fsm.test.ts` | `NO_HAND`, `IDLE`, `GRABBING`, `DRAGGING`, `LOST` with hysteresis and hold frames; fixture-replay tests; `HOVER` and `point` / `open_palm` classification follow the Phase 3 stop/go |
| M4 worker and perf | `worker/hand-landmarker.worker.ts`, `worker-client.ts`, `cv-status.ts` | Transferred `ImageBitmap`s, `OffscreenCanvas` feature-detect, alternate-frame main-thread fallback, `cv_status` channel, `perf_sample` fields |
| M5 mouse path | `mouse-adapter.ts` | Identical event stream from pointer events for the control condition (placed here per doc 16) |
| M10 event log | (fields only) | `grab_start.pinchDist`, `grab_end.holdMs`, `tracking_regained.durationMs`, `hand_count.primarySwitched` on emitted events for the `LogEvent` logger in `@grasp/learning` |
| After M11 | `calibration.ts` | Threshold calibration (mandatory, ~5 s) and the 20-prompt calibration tutorial; the prompt list is already real content |

## Exports

| Entry | Use |
|---|---|
| `@grasp/vision` | Constants, features, filter, FSM, status, worker client, calibration, protocol types |
| `@grasp/vision/worker` | Worker entry for `new Worker(new URL(..., import.meta.url), { type: "module" })` only |
| `@grasp/vision/mouse-adapter` | Mouse input source, importable without pulling in MediaPipe |

## Tuning

Every number in `constants.ts` is a starting value. The logging needed to tune each one is listed in doc 04 "What to log for tuning"; the tuning pass is M11.
