# M11 hallway test: protocol and tuning sheet

Two non-developers, about ten minutes each, on `/prototype` (doc 17 M11). This is a **smoke test, not a pilot**: it catches gross failures and nothing subtler, and it supports no study claim (the 8 to 12 per group pilot in doc 14 still comes first). Results go into the stop/go table with `pnpm research:stopgo`.

## Before the participants arrive

1. **Integrated GPU.** The budgets are for an integrated GPU. On a laptop with a discrete GPU (this one has an RTX 4070), open Windows Settings → System → Display → Graphics, add the browser, set it to **Power saving**, and restart the browser. Check that a `perf_sample` reports sensible numbers.
2. **Two lighting set-ups.** Good light: the light source faces the participant. Window: the participant sits with a bright window, or a lamp, behind them.
3. `pnpm dev`, open `http://localhost:3000/prototype`, start the camera once yourself to confirm that the worker path and GPU are working, then reload the page.
4. Close other heavy apps, and keep this sheet and a timer nearby.

## Consent (verbal; this is not the study)

Say: "This tests the software, not you. The camera tracks your hand inside this browser; no video is saved or sent anywhere. The page records only what you did on screen, like which part you picked up and when. I'll use that to tune the software and then delete it. You can stop at any time." Do not run the session without a yes. Delete the logs after the tuning evening.

## Briefing (read it the same way to both people)

1. Point at each loose part on screen and name it: "This is the aorta, this is the pulmonary artery, this is the left ventricle." This removes anatomy knowledge from a test of interaction.
2. "Pinch your thumb and finger to pick a part up, move your hand to carry it, and open your hand to let go. The box at the top tells you which part to put back." Demonstrate one pinch in the air. **Do not coach after this point**; write down what you would have said instead.

## Runs, per participant (gesture first for both people)

| # | Run | Then |
|---|---|---|
| 1 | Gesture, good light: three placements | **Download event log**, save as `p1-good.json` (p2: `p2-good.json`), reload the page |
| 2 | Gesture, window behind them: three placements | Download, save as `p1-window.json`, reload |
| 3 | Switch to mouse ("switch to mouse" link): three placements | Download, save as `p1-mouse.json` |

Always download before you switch modes or reload: each one starts a new log. Stop a run at 3 minutes. Write down anything the log cannot show: hesitations, confusion about the instructions, physical strain, what they said.

## Score

```powershell
pnpm research:stopgo p1-good=p1-good.json p1-window=p1-window.json p1-mouse=p1-mouse.json p2-good=p2-good.json p2-window=p2-window.json p2-mouse=p2-mouse.json --tti 2.9 --out stopgo-before.md
```

`--tti` is the time to first interaction measured at M9 (2.9 s at 10 Mbps); measure it again if the model or network changes. Each log is scored on its first run.

## Tuning evening (one pass, then re-score)

Change one or two knobs at a time, check them on yourself, and keep a list of what you changed.

| Symptom in the logs or the notes | Knob | File | Now | Direction |
|---|---|---|---|---|
| Pinches not recognised; many `grab_start` missing | `PINCH_ENTER` | `packages/vision/src/constants.ts` | 0.25 | up (0.28 to 0.30) |
| Parts drop mid-drag; release while still pinching | `PINCH_EXIT` | same | 0.40 | up (0.45) |
| Grabs fire when people aren't pinching | `HOLD_FRAMES.pinch` | same | 2 | up (3) |
| Cursor shakes at rest (`jitterNorm` > 0.005) | `ONE_EURO_LANDMARKS.minCutoff` | same | 1.0 | down (0.7) |
| Cursor trails behind fast moves | `ONE_EURO_*.beta` | same | 5.0 | up (7 to 10) |
| People can't reach the edges of the scene | `REACH_SCALE` | `packages/scene/src/constants.ts` | 1.0 | up (1.2 to 1.4) |
| Right part, near the socket, does not snap | socket `radius` | `content/models/heart_v1.json` | 1.5 / 1.5 / 2.0 | up by 0.5 |
| Parts drift toward or away from the camera while dragged (large `zHintAbsSum`) | `Z_GAIN` | `packages/scene/src/constants.ts` | 0.3 | down (0.1), or 0 to disable |

After a radius change, run `pnpm content:validate`.

## Result (paste below)

- `stopgo-before.md`, then the knobs changed and why, then `stopgo-after.md`.
- Decision rule (doc 17): all rows Go, or at most two rows Tune after one tuning pass, passes the Phase 3 gate. Any Stop row puts the gesture modality at risk.
