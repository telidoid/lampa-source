# Changes

## Docker/Podman: configure torrent parser URLs via environment variables

Adds environment variables to the Docker/Podman image (built from the
`build/github/lampa/` gulp output), so TorrServer, Jackett, and Prowlarr
addresses/keys can be set from the container's configuration instead of
manually through the app's settings UI.

- `index/github/plugins/modification.js` (new) — local plugin loaded automatically
  by the app on every startup (`src/core/plugins.js` always tries to load
  `./plugins/modification.js`, silently skipping it if absent). Force-sets each
  of the following `Storage` (localStorage) fields from a build placeholder on
  every load, overwriting any value entered manually in the settings UI, so the
  container's env vars are always the source of truth:
  - `torrserver_url` ← `TORRSERVER_URL`
  - `jackett_url` ← `JACKETT_URL`
  - `jackett_key` ← `JACKETT_KEY`
  - `prowlarr_url` ← `PROWLARR_URL`
  - `prowlarr_key` ← `PROWLARR_KEY`
  - `parser_torrent_type` ← `PARSER_TORRENT_TYPE` — selects which backend is
    actually used for torrent search (read by
    `src/core/api/sources/parser.js`), so this makes the other vars
    functionally active rather than just stored/inert. Validated against the
    three accepted values (`jackett`/`prowlarr`/`torrserver`); anything else
    (including the unsubstituted placeholder, or a typo'd value) is rejected
    and the existing stored value is left alone.
  - `parser_use` ← `PARSER_USE` — boolean toggle (`true`/`false`) that shows
    the per-card "search torrent" button (`src/components/full/start/torrents.js`).
    Validated against the two accepted string values, same rejection behavior
    as above for anything else. This field is a boolean trigger, not a plain
    string: `Lampa.Storage.get()` coerces stored `'true'`/`'false'` strings to
    a real JS `boolean` on read (`src/core/storage/storage.js:73`), so the
    unchanged-value check compares against a `boolean`, not the raw
    placeholder string — otherwise it would (harmlessly, but pointlessly)
    write on every single page load.

  Each field only writes to `Storage` when the value actually differs from
  what's already stored, to avoid needless localStorage writes on every app
  load. If a given placeholder wasn't substituted (its env var unset), that
  field's existing stored value is left untouched — fields are independent of
  each other.
- `index/github/entrypoint.sh` (new) — container entrypoint. For each env var
  that's set, substitutes it into the matching placeholder in
  `modification.js` via `sed` before starting Apache (`httpd-foreground`).
  Removed from the web root after the substitution step so it isn't publicly
  downloadable.
- `index/github/Dockerfile` — now runs `entrypoint.sh` instead of the base
  `httpd` image's default entrypoint.
- `index/github/README.md` — documents the new env vars and force-override
  behavior.
- `gulpfile.js` — exposes a new `bundle` task (`exports.bundle = series(merge)`).
  `pack_github` consumes `dest/app.js` (via `uglify_task`) but never ran the
  rollup `merge` step that produces it, so building the image from a fresh clone
  failed with `ENOENT: ./dest/app.js`. `merge` calls `done()` before its stream
  finishes writing, so it can't be chained into `pack_github` via `series` in a
  single process — running it as its own gulp invocation lets the write flush on
  process exit before `pack_github` starts.

### Building the image

The Docker image must be built from the assembled `build/github/lampa/`
directory, **not** from `index/github/`. `index/github/` is only a template
(index.html, Dockerfile, and the new `plugins/modification.js`); the actual app
bundle and assets (`app.min.js`, `css/`, `vender/`, `lang/`, …) are layered in
by the gulp `pack_github` task. Building straight from `index/github/` produces
an image that 404s on every asset.

```
npm install                 # first time only
npx gulp bundle             # rollup -> dest/app.js  (separate command; see note above)
npx gulp pack_github        # assembles build/github/lampa/ (app + assets + plugin)

cd build/github/lampa
podman build --build-arg domain=<your-domain-or-ip> -t lampa .
```

### Running

```
podman run -p 8080:80 -d --restart unless-stopped -it --name lampa \
  -e TORRSERVER_URL=http://192.168.1.10:8090 \
  -e JACKETT_URL=http://192.168.1.11:9117 \
  -e JACKETT_KEY=abc123 \
  -e PROWLARR_URL=http://192.168.1.12:9696 \
  -e PROWLARR_KEY=xyz789 \
  -e PARSER_TORRENT_TYPE=prowlarr \
  -e PARSER_USE=true \
  lampa
```

Only set the variables you need — unset ones are left alone (existing stored
values, if any, are preserved).

### Verified

End-to-end on the deployment server: `npx gulp bundle && npx gulp pack_github`,
then `podman build` from `build/github/lampa/` and `podman run` — the app loads
and runs (no asset 404s), confirming the full build flow above. An earlier
attempt building directly from `index/github/` produced an image that 404'd on
`app.min.js`, `vender/*`, and `css/app.css`, which is what the
`build/github/lampa/` build flow fixes.

Built and ran the image locally with `podman build`/`podman run` for three
scenarios — all five original env vars set, only a subset (Jackett) set, and
none set — and confirmed `plugins/modification.js` is served with the correct
substituted/placeholder value for each field independently in every case.
Also re-verified in Node that the force-override-but-skip-if-unchanged logic
behaves correctly: overwrites when the value differs, no-ops when it already
matches, and leaves the stored value untouched when a placeholder wasn't
substituted.

For `PARSER_TORRENT_TYPE`: verified in Node that a valid value (`prowlarr`)
is accepted and stored, a mistyped value (`Prowlarr`, wrong case) is rejected
and the existing stored value is preserved, and the unsubstituted placeholder
is likewise rejected. Rebuilt the image and confirmed via `podman build`/`run`
that `-e PARSER_TORRENT_TYPE=prowlarr` substitutes correctly into
`modification.js`, and that leaving it unset leaves the placeholder (and thus
the guard's rejection path) intact.

For `PARSER_USE`: reproduced `Storage.get()`'s exact `'true'`/`'false'` → real
`boolean` coercion in a standalone Node snippet and confirmed all four cases —
already `true` with incoming `true` (no write), stored `false` with incoming
`true` (write), nothing stored with incoming `true` (write), and env var unset
with an existing stored value (no write, value preserved). Rebuilt the image
and confirmed via `podman build`/`run` that `-e PARSER_USE=true` substitutes
correctly, and that leaving it unset leaves the placeholder intact.
