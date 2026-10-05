# public/models

GLB delivery for the MVP pilot (docs/16 directory guide; docs/10 "GLB hosting"). Files here are copied from the repo's `models/` directory by `pnpm models:optimize` and are git-ignored; only this README and `.gitignore` are committed.

- Key layout mirrors object storage: `models/<modelId>/<file>.glb`, so `/models/heart_v1/heart.glb` here is the same key as the V1 CDN.
- `NEXT_PUBLIC_ASSET_BASE_URL` defaults to `/models` and points here.
- Limit: 5 MB per GLB, Draco or meshopt compressed (locked position 6); the validator rejects larger files.
- V1: the same keys move to object storage behind a CDN and this directory returns to development use.
