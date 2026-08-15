# Versioning

Geist has **two independent version concepts**. Do not confuse them — they serve
different purposes and are set in different ways.

| | Semantic version (`1.0.x`) | Deploy version (commit SHA) |
|---|---|---|
| Example | `1.0.7` | `87c0b02` |
| Set by | **Humans, manually** (this doc) | **CI, automatically** (git commit) |
| Purpose | Human-facing release label | Identifies exactly which build is running |
| Read by build/deploy? | **No** | **Yes** |
| Shown where | Settings sidebar (`Geist v1.0.7`) | `GET /api/info` → `{"version":"<sha>"}` |

## 1. Semantic version (`1.0.x`) — manual

This is a **cosmetic label** based on [Semantic Versioning](https://semver.org/) and
[Keep a Changelog](https://keepachangelog.com/). Nothing in the CI/Docker pipeline reads
it — it exists purely for humans and for the version shown in the app UI.

By project convention, every feature release is a **patch bump** (`1.0.6 → 1.0.7`),
even though SemVer would call a backward-compatible feature a minor bump. Follow the
existing history unless you have a reason to break the pattern.

### Files to update for a new semantic version

There are **four** places. Only one of them actually drives the number shown in the app.

1. **`frontend/public/version.json`** — ⭐ the only file that controls the version
   displayed in the app (Settings sidebar reads it via `fetch('/version.json')`).
   Update both fields:
   ```json
   {
     "version": "1.0.7",
     "releaseDate": "2026-08-16"
   }
   ```

2. **`CHANGELOG.md`** — add a new `## [1.0.7] - YYYY-MM-DD` section at the top
   (under `### Added` / `### Fixed` / `### Changed` as appropriate), and add a row to
   the **Version History** table at the bottom.

3. **`backend/package.json`** + **`backend/package-lock.json`** — bump with:
   ```sh
   cd backend && npm version 1.0.7 --no-git-tag-version
   ```
   (Pipeline ignores this; kept in sync for hygiene. `npm version` updates both files.)

4. **`frontend/package.json`** + **`frontend/package-lock.json`** — bump with:
   ```sh
   cd frontend && npm version 1.0.7 --no-git-tag-version
   ```

### Release checklist

- [ ] Decide the new number (patch bump by convention, e.g. `1.0.6 → 1.0.7`).
- [ ] `frontend/public/version.json` → new `version` + `releaseDate` (today).
- [ ] `CHANGELOG.md` → new section + Version History table row.
- [ ] `npm version <new> --no-git-tag-version` in `backend/` and `frontend/`.
- [ ] Verify the four version strings match: `version.json`, `CHANGELOG.md`,
      `backend/package.json`, `frontend/package.json`.
- [ ] Commit and merge to `main` (this triggers the deploy — see below).

> Keeping `frontend/public/version.json` out of sync is the classic mistake: the
> CHANGELOG says `1.0.7` but the app still shows `1.0.6` because the UI only ever
> reads `version.json`.

## 2. Deploy version (commit SHA) — automatic

This is the number that actually matters operationally. It is **not** set by hand.

- On merge to `main`, GitHub Actions (`.github/workflows/docker-build.yml`) computes
  `IMAGE_TAG = <short commit SHA>`.
- Images are pushed to `ghcr.io/geist-app/geist-backend` and `-frontend`, tagged with
  that SHA (and `latest`).
- `docker-compose.prod.yml` runs the pinned tag and injects `APP_VERSION: ${IMAGE_TAG}`.
- The backend exposes it at `GET /api/info` → `{"version":"<short-sha>"}`.

Because deploys are pinned to an immutable SHA, rollbacks just re-run `deploy.sh` with an
older `IMAGE_TAG`. See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full pipeline.

**Bumping the semantic version does not trigger or change a deploy** — deploys are driven
entirely by commits landing on `main`. The semantic version simply rides along in whatever
commit you push it in.
