# Grasp

A browser-based learning platform where students learn by manipulating 3D educational models with webcam hand gestures. MediaPipe hand tracking runs in-browser (no video leaves the device), React Three Fiber renders the scene, a declarative learning engine evaluates each 3D action against learning objectives, and a template-based tutor explains and hints from structured scene state. No paid tools or metered APIs are used anywhere; a locally run open-weights model is a V1 option for the tutor, only after measurement. The MVP domain is human heart anatomy. It is built by a solo developer on a zero budget (free no-card tiers and open-source software only) and doubles as an academic research study (gesture versus mouse).

Guiding principle: a learning system where 3D interaction and computer vision are the learning mechanism, not a model viewer with a webcam attached.

## Status

Phase C: repository scaffold. Contracts (types, Zod schemas, Drizzle schema) are complete; every function is a stub that throws `TODO Phase D`. See the phase table in [CLAUDE.md](CLAUDE.md) and the architecture document in [docs/README.md](docs/README.md).

## Prerequisites

| Tool | Version | Why |
|---|---|---|
| Node | 20 or newer | Next.js, scripts |
| pnpm | 10 (`corepack enable` picks up the `packageManager` field) | workspace linking enforces package boundaries |
| Docker | any recent | local Postgres via Compose |

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm db:up          # Postgres 16 on localhost:5432
pnpm dev            # http://localhost:3000
```

Other root scripts: `pnpm typecheck`, `pnpm test`, `pnpm content:validate`, `pnpm models:optimize <in.glb> <out.glb>`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:down`.

## Tree

```text
apps/web/          the single deployable Next.js app (pages, route handlers, HUD, stores)
packages/types     shared TypeScript contracts; no dependencies, no runtime code
packages/content   Zod schemas, manifest and lesson loaders, contentHash
packages/vision    HandLandmarker worker, One-Euro filter, gesture FSM, mouse adapter
packages/scene     R3F scene: raycast, drag plane, sockets, hotspots, scene commands
packages/learning  deterministic evaluate(), mastery, hint ladder, event logger
packages/tutor     TutorService interface, TemplateTutorService (MVP), local-model seam (V1)
packages/ui        design tokens, Radix wrappers, focus ring, live region
packages/db        Drizzle schema, migrations, client factory
content/           model manifests, lessons, study instruments, Blender sources
models/            compressed GLB outputs (committed; under 5 MB each)
scripts/           content, model, research, and database pipeline scripts
services/          empty seam for a V1/Future Python service
infrastructure/    docker-compose.yml, vercel.json
docs/              architecture document set
```

## Where things live

| I want to change | Go to | Doc |
|---|---|---|
| A gesture threshold or the state machine | `packages/vision` | [04](docs/04-computer-vision.md) |
| How a part is grabbed, dragged, or snapped | `packages/scene` | [05](docs/05-3d-interaction.md) |
| What counts as correct for a task | `content/lessons/**` (JSON), `packages/learning` (engine) | [06](docs/06-learning-engine.md) |
| Tutor templates, guardrails, engine selection (`TUTOR_ENGINE`) | `packages/tutor`, `apps/web/app/api/tutor` | [07](docs/07-ai-tutor.md) |
| A table or column | `packages/db/src/schema.ts`, then `drizzle-kit generate` | [09](docs/09-database.md) |
| The heart model or its manifest | `content/source`, `models/`, `content/models/heart_v1.json` | [10](docs/10-3d-content-system.md) |
| A shared type | `packages/types` | [03](docs/03-system-architecture.md) |
| A screen or HUD element | `apps/web/components` | [11](docs/11-ui-ux.md) |
| What gets logged for the study | `packages/types/src/log-events.ts`, `packages/learning` | [14](docs/14-evaluation-methodology.md) |
| CSP, security headers, env parsing | `apps/web/middleware.ts`, `apps/web/lib` | [15](docs/15-risks-security-scalability.md) |
| The directory layout itself | this file and `pnpm-workspace.yaml` | [16](docs/16-folder-structure.md) |

## Package boundaries

Enforced by pnpm's strict linking: a package can only import what its `package.json` declares. `learning` imports only `types` and `content`; `vision` only `types`; `scene` never imports `learning` or `tutor`; no package imports `apps/web`. Full rule table in [doc 16](docs/16-folder-structure.md#package-boundaries).
