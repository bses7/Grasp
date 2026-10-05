# Study instruments

Item text for the research study in [docs/14](../../docs/14-evaluation-methodology.md). These files are content: the app renders them on `app/(study)/test/[instrument]/page.tsx`, and `packages/content` validates their shape.

**Participant responses never live here.** A response is a row in `instrument_responses` (`session_id`, `instrument`, `form`, `item_no`, `response`, `correct`), keyed by the random `sessionId`. Nothing in this directory is written at run time, and no file here may contain a participant identifier.

## Files

| File | Instrument | Items | When |
|---|---|---|---|
| `heart-knowledge/form-a.json`, `form-b.json`, `form-c.json` | Knowledge test, three parallel forms | 15 each | pre (S1 start), post (S1 end), retention (S2, +7 days) |
| `sus.json` | System Usability Scale | 10 | S1 end, after the post-test |
| `tlx.json` | NASA-TLX, raw | 6 subscales | S1 end, after SUS |

Satisfaction (one 1 to 7 item), perceived tracking quality (gesture condition only), and the three open questions are short enough to live in the page component for the pilot; move them here if they change.

## Knowledge forms

Each form has the same structure so difficulty is comparable:

| Items | Type | Objective | What it measures |
|---|---|---|---|
| 1 to 4 | `identify_label` | `obj_identify_chambers` | Name the chamber at a lettered label on the schematic |
| 5 to 7 | `identify_label` | `obj_place_vessels` | Name the vessel at a lettered label |
| 8 to 10 | `order` | `obj_blood_path` | Order four structures along the blood path (right side, left side or through the lungs, chambers only) |
| 11 to 12 | `mcq` | `obj_identify_chambers` | Wall thickness; atria versus ventricles |
| 13 to 14 | `mcq` | `obj_place_vessels` | Oxygenation of a vessel; which chamber a vessel joins |
| 15 | `mcq` | `obj_blood_path` | Septum or left-versus-right side |

Per form: 6 items on `obj_identify_chambers`, 5 on `obj_place_vessels`, 4 on `obj_blood_path`. The letter-to-component mapping in `figure.labels` is shuffled per form so a learner cannot carry letters from pre-test to post-test. All three forms use the same schematic, `figures/heart-schematic.svg` (a flat, labelled two-dimensional drawing, not the 3D model, so neither condition gets extra practice with its input device during a test). The schematic is a Phase E deliverable; the `labels` map is the key the page uses to place letters.

### Assignment

Forms rotate through pre, post, and retention in a Latin square, balanced within condition (docs/14 "Form counterbalancing"):

| Rotation | Pre | Post | Retention |
|---|---|---|---|
| 1 | A | B | C |
| 2 | B | C | A |
| 3 | C | A | B |

The rotation is assigned with the session code at recruitment, before the condition is revealed, and recorded in `research_sessions`. Each condition gets equal counts of each rotation.

### Scoring

- One point per item, 0 to 15 per form. `identify_label` and `mcq`: `response === answer`. `order`: correct only when the full sequence matches `answer` exactly (all-or-nothing; partial credit is not pre-registered).
- Normalised gain `(post - pre) / (15 - pre)`, undefined when `pre === 15` (excluded, pre-registered).
- Pilot equivalence check: form means must differ by at most 1 point; swap items between forms if not. Drop items with facility above 0.9 or below 0.2 after the pilot (docs/14 risk table).

## SUS and TLX

- SUS: ten items, 1 to 5. Score `2.5 x sum(odd: r - 1, even: 5 - r)`, 0 to 100. Wording is the standard Brooke (1996) text.
- NASA-TLX raw: six subscales on 21-tick lines stored as 0 to 100 in steps of 5. `rawTLX = mean of six`. No pairwise weighting. Performance is anchored Perfect (0) to Failure (100) so every subscale reads higher-is-worse.
- Both are self-report and novelty-sensitive; they are interpreted alongside the log metrics, never alone.
