# services/

This directory is intentionally empty in **MVP**. It is the attachment point for a Python service, kept so the **V1** developer (the same person, later) does not have to rediscover where it goes. See [doc 16, The services/ seam](../docs/16-folder-structure.md#the-services-seam) and [doc 03, The seam for a Python service](../docs/03-system-architecture.md#the-seam-for-a-python-service).

## Trigger

Locked position 1 in `project-conventions`: a second deployable is justified only by **custom gesture-model training or Python-only inference**. Nothing else justifies it. The MVP backend is Next.js route handlers; CV runs in the browser; the AI tutor is one HTTP call from `apps/web/app/api/tutor/route.ts`.

## How a service attaches (five steps)

| Step | Action | Tier |
|---|---|---|
| 1 | Create `services/<name>/` with a `Dockerfile`, `pyproject.toml`, and a FastAPI app | **V1/Future** |
| 2 | Generate Pydantic models from the JSON Schema that `pnpm types:jsonschema` emits from the Zod schemas in `packages/content` and `packages/types` | **V1/Future** |
| 3 | Add the service to `infrastructure/docker-compose.yml` under a `profiles: [services]` key so `pnpm dev` is unchanged | **V1/Future** |
| 4 | Implement `RemoteTutorService` or `RemoteVisionService` in the existing package; the route handler already switches on `TUTOR_SERVICE_URL` | **V1/Future** |
| 5 | Deploy to a container host; Vercel never hosts it | **V1/Future** |

## What must not live here in MVP

Any code. A file in this directory other than this README means a locked position has been reversed without the user's agreement.
