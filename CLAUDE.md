# Repo instructions: GLAAD EN Marketing Tools

MJML source, EN template import, EN block import and upload files for
GLAAD's Engaging Networks Marketing Tools template. The
reference implementation is
[tpl-en-marketing-tools](https://github.com/4site-interactive-studios/tpl-en-marketing-tools);
when this file is silent, do what TPL does.

## Governing documents (read both before changing MJML)

They are not copied here, so they cannot go stale here. Fetch them from the
TPL mirrors, which are re-mirrored on every change:

- Authoring guide: https://raw.githubusercontent.com/4site-interactive-studios/tpl-en-marketing-tools/main/MJML-AUTHORING-GUIDE.md
- Importer contract: https://raw.githubusercontent.com/4site-interactive-studios/tpl-en-marketing-tools/main/CONVENTIONS.md

The guide's §8 QA checklist applies; report what each check returned.

## Keep every output in sync (binding, every change)

`src/` holds the only working files. `dist/local/`, `dist/en/` and `upload/`
are generated from it and are committed so anyone can use them without a
build. After ANY change to `src/`:

1. `npm run build` (dist/local + dist/en MJML/HTML, upload/ images)
2. `npm run export-en` (EN template + block import JSON, thumbnails; needs
   the importer checkout beside this repo)
3. `npm run check-sync` must print `check-sync: 0 warnings`
4. Commit `src/`, `dist/` and `upload/` in ONE commit

Never hand-edit anything in `dist/` or `upload/`; it is overwritten. The
example emails (`dist/*/example-*`) are composed by the build from the
recipes in `src/examples.mjs`, which name catalog blocks and override text
only; never copy block markup into a recipe, or the example stops tracking
the block. Renaming a block means updating the recipes that use it (the
build fails until you do).
`index.html` (the GitHub Pages preview) is hand-written but reads its lists
from the generated files, so it follows them; edit it only for layout or
copy, and check-sync confirms every path it names still exists. A
change that only touches `src/` is incomplete. If you cannot run step 2
(no importer checkout, no browser), say so explicitly: check-sync will be
warning that the EN export is stale, and that warning must not be silenced.

## Facts specific to this repo

- `src/main.mjml` is the only catalog. Blocks are START/END comment pairs
  named per TPL PLAYBOOK §4 (`Family (qualifier)`).
- EN client ID 10109. Asset root (flat folder, filenames unique repo-wide):
  `https://acb0a5d73b67fccd4bbe-c2d8138f0ea10a18dd4c43ec3aa4240a.ssl.cf5.rackcdn.com/10109/`
- Source keeps relative `assets/…` paths; `grep rackcdn.com src/*.mjml` must
  return nothing; `dist/en/` is where EN paths live. Every referenced image
  is ours and lands in `upload/`: the transparent logo, the haloed black
  icons, the white icons and the placeholder. GLAAD's originals stay in
  `src/assets/originals/` as the sources they were derived from; nothing
  references them and the build never copies them.
- Every uploaded file starts with `glaad-` (user decision 2026-11-16): the
  `assetPrefix` in `en-tools-config` makes the importer name thumbnails and
  the placeholder that way, and any new image in `src/assets/` must be named
  with it too. check-sync enforces it.
- The import files carry owner 0 (placeholder, user decision 2026-11-16)
  until GLAAD's EN owner user ID is known; then
  `EN_OWNER_ID=… EN_FOLDER_ID=… npm run export-en`.
- The `en-tools-config` scale is on tens (0/10/20/30/40/60) and the content
  baseline is 30px, both taken from GLAAD's live email. Keep every value on
  that scale.

## Deliberate differences from TPL

- **Dark mode is TPL's mechanism, trimmed**: the head swap CSS, the unclassed
  Outlook seed div at the top of mj-body, and both dark branches in
  styles.css with `!important` on every declaration. Dark text and links
  must clear 5.4:1 against Outlook's #333333 base (Light Cyan `#5DCBEB`
  does; Cyan `#00B2E3` does not).
- **One transparent logo** (`glaad-logo-cyan-transparent.png`) serves
  both modes, so the headers have no light/dark image pair. Social Links
  pairs two `mj-social` rows (`light-only` / `dark-only` +
  `data-style-dark-mode`, the dark one inside `[if !mso]`). The black icons
  carry a 1px white halo for clients that cannot swap (Gmail apps, Outlook
  desktop). The Dark Audit's "orphan-swap-class" notes on that row are its
  per-image adjacency heuristic meeting row-level twins, not a defect; the
  light/dark render count is the real check.
- **Match Banner has no `block` class** so the dark repaints skip it and it
  keeps its Navy ground. Any new dark-ground band should do the same.
- **No `versions.json` / `version-sync`**, no debug overlay, no category
  divider blocks (GLAAD's EN folder IDs are unknown), no check-catalog.
- **Build is `scripts/build.mjs`**, not TPL's shell chain: two outputs
  (local paths, EN paths) instead of TPL's `_local-debug` / `_live` HTML
  pair, and the MJML ships in both forms too.
- **Links with query strings use a raw `&`**, not `&amp;`: `&amp;` reaches the
  importer's Link URL fields verbatim.

## Verifying a change

1. The sync steps above, then open `dist/local/main.html` at 700px and 375px.
2. From a sibling checkout of the private `email-to-en-marketing-tools` repo:
   `npx vite-node scripts/qc-validate.mts ../glaad-en-marketing-tools --strict`
   must print STRICT PASS, and
   `npx vite-node scripts/qc-dump.mts <out.json> ../glaad-en-marketing-tools`
   must report 0 orphan tags.
3. In the app, after import, the Test Center's Inert Audit must show 0 FAIL,
   the Dark Audit 0 concerns, and the Export panel's Template tab no Outlook
   dark warnings.
4. Render `dist/local/main.html` with the browser in light and in dark color
   scheme: exactly one of each light/dark pair may be visible (guide §8 5a).

## Git

Never commit or push unless asked; "commit" means commit and push to
`origin/main`. Before committing, `git status -sb` must show `## main...`;
after pushing, `git ls-remote origin main` must equal `git rev-parse HEAD`.
