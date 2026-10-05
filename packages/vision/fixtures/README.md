# Gesture FSM fixtures

Recorded feature sequences (developer's own; features only, never landmarks) replayed by `src/gesture-fsm.test.ts`.

Record on `/prototype` with **Record features** → **Stop and save features**, move the file here, and add an `expect` block:

| Fixture | Perform | `expect` |
|---|---|---|
| `pinches-20.json` | 20 deliberate pinch-and-release cycles | `{ "grabPairs": 20, "tolerance": 2 }` |
| `cover-mid-pinch.json` | pinch, cover the camera for 2 s, uncover | `{ "grabPairs": 1, "lostRelease": true }` |

Every fixture is also checked for a valid event order (no nested grabs, every `grab_end` closes a grab).
