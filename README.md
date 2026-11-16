# GLAAD EN Marketing Tools - Template Repository

GLAAD's Engaging Networks (EN) Marketing Tools email template and blocks: the
MJML source, the EN template import, the EN block import, and every file EN
needs uploaded. It follows the same pipeline as
[tpl-en-marketing-tools](https://github.com/4site-interactive-studios/tpl-en-marketing-tools):
the Email to EN Marketing Tools app reads `src/main.mjml` and produces the EN
import files with editable fields.

It mirrors GLAAD's current email (the "Thank you for joining our email list"
autoresponder): gray page, white 600px card, cyan logo, Arial copy, a "Follow
Us!" icon row and a near-black footer. On top of that it adds year-end appeal
blocks (match banner, gift amount buttons, CTA button, signature) and dark
mode.

## What's in the repo

| Folder | What it is | Image paths |
| :-- | :-- | :-- |
| `src/` | **The working files.** Edit only these: `main.mjml`, `styles.css`, `assets/`, and `examples.mjs` (the example email recipes) | relative (`assets/x.png`) |
| `dist/local/` | Ready-to-use copy for local work: `main.mjml`, `styles.css`, compiled `main.html`, the three example emails (`example-*.mjml` / `.html`), `assets/` | relative |
| `dist/en/` | Ready-to-use copy for Engaging Networks: `main.mjml`, `styles.css`, compiled `main.html`, **`en-template-import.json`** (EN Marketing Tools template import) and **`en-blocks-import.json`** (EN Marketing Tools block import) | GLAAD's EN image folder |
| `upload/` | Every file to upload to GLAAD's EN image library: the 10 images the template uses plus the block thumbnails, all named `glaad-…` | n/a |
| `index.html` | The preview page for GitHub Pages (below) | |
| `scripts/` | build, EN export and sync check (below) | |

`dist/en/` assumes everything in `upload/` has been uploaded to GLAAD's EN
image folder:
`https://acb0a5d73b67fccd4bbe-c2d8138f0ea10a18dd4c43ec3aa4240a.ssl.cf5.rackcdn.com/10109/`
(the folder GLAAD's live emails already load their logo from). With that
done, the MJML, the template import and the block import in `dist/en/` all
work as they are, with nothing to edit first.

`src/assets/originals/` keeps GLAAD's original logo and icons, the sources
the template's images were made from. Nothing references them.

## Using the files

1. Upload everything in `upload/` to GLAAD's EN image library.
2. In EN Marketing Tools, import `dist/en/en-template-import.json` as a
   template and `dist/en/en-blocks-import.json` as blocks.
3. To work with the MJML, open `dist/en/main.mjml` (EN image paths) or
   `dist/local/main.mjml` (local paths, with its `assets/` beside it) in any
   MJML editor, or open either `main.html` in a browser.

The import files carry client ID 10109, folder 0 (the root folder) and
**owner 0, a placeholder** until we have GLAAD's EN owner user ID. Regenerate
them with the real IDs as shown under "Keeping everything in sync".

## Preview page (GitHub Pages)

`index.html` is a single page with everything on it:

- **Preview:** three example emails built from the blocks (a year-end
  appeal, a welcome email and a news update), with an Email switch,
  desktop/phone width, light/dark mode,
  and images from the repo or from GLAAD's EN folder (the EN option shows
  broken images until `upload/` is uploaded). Dark mode shows what Apple
  Mail and iOS Mail do; Gmail apps and Outlook desktop darken emails their
  own way.
- **Blocks:** every block in the EN block import, with its thumbnail and its
  number of editable fields.
- **Files:** the EN template and block imports, both MJML versions, both HTML
  versions, the stylesheet, and every upload file (one at a time, or all in a
  ZIP the page builds in the browser).

The page reads `dist/files.json`, `dist/en/en-blocks-import.json` and
`dist/en/export-manifest.json`, so it updates itself whenever the outputs are
regenerated.

**To publish it:** in the GitHub repo, open Settings, then Pages, choose
"Deploy from a branch", and pick `main` and `/ (root)`. The page appears at
`https://4site-interactive-studios.github.io/glaad-en-marketing-tools/`.
Pages needs a public repo on GitHub's free plans. `.nojekyll` tells Pages to
serve the files as they are.

To view it locally: `npm run preview`, then open
`http://localhost:8642/index.html`. (Opening the file directly from disk
does not work: browsers block the page from reading its own data files.)

## Example emails

`src/examples.mjs` lists each example as a sequence of block names from
`main.mjml`, plus text or label overrides where an example needs its own
copy. The build copies each block's markup straight from the catalog, so an
example always shows the block exactly as EN will receive it, and it writes
`example-<id>.mjml` and `.html` into both `dist/local/` and `dist/en/`. The
first example is the preview's default. To add one, add an entry and run
`npm run build`; a misspelled block name or an override that no longer
matches stops the build with a message naming it. The copy is sample text,
not approved GLAAD messaging.

## Find and replace: switching image paths

Every image reference is a quoted path, so one find/replace switches a file
between the two outputs. Use the whole string, including the opening quote.

**Local paths to EN paths** (in `main.mjml` or `main.html`):

- Find: `"assets/`
- Replace: `"https://acb0a5d73b67fccd4bbe-c2d8138f0ea10a18dd4c43ec3aa4240a.ssl.cf5.rackcdn.com/10109/`

**EN paths to local paths:** the same pair, reversed.

**Files uploaded to a different EN image folder** (another EN account or
environment): in all four files in `dist/en/` (`main.mjml`, `main.html`,
`en-template-import.json`, `en-blocks-import.json`):

- Find: `https://acb0a5d73b67fccd4bbe-c2d8138f0ea10a18dd4c43ec3aa4240a.ssl.cf5.rackcdn.com/10109/`
- Replace: the new folder's URL, ending in `/`

After uploading, open one image URL in a browser to confirm EN kept the
filename exactly as uploaded (case included); the paths assume it does.

## Keeping everything in sync

`dist/` and `upload/` are generated from `src/` and must match it **after
every change**. Change only `src/`, then regenerate and commit `src/`,
`dist/` and `upload/` together:

```bash
npm install                       # once; then once: npx playwright install chromium
npm run build                     # dist/local, dist/en MJML + HTML, upload/ images
npm run export-en                 # EN import JSON + thumbnails, via the importer app
```

- `npm run build` needs only this repo.
- `npm run export-en` runs the real Email to EN Marketing Tools importer (the
  private `email-to-en-marketing-tools` repo, checked out beside this one) in
  a headless browser, so the JSON and thumbnails are exactly what the app
  would produce. While it runs, the browser answers requests for GLAAD's EN
  image folder from `upload/`, so each block's JSON points at its own
  thumbnail, as it would once the files are uploaded. Set `IMPORTER_DIR` if the checkout lives elsewhere, and
  `EN_OWNER_ID` / `EN_FOLDER_ID` once GLAAD's are known, e.g.
  `EN_OWNER_ID=12345 EN_FOLDER_ID=678 npm run export-en`.
- Both finish with `npm run check-sync`, which warns about anything that has
  fallen behind `src/`: a copy that differs, a stale compiled HTML, an image
  missing from `upload/`, an EN export made from older source, a block in the
  MJML that is missing from the block import, a block exported with EN's
  generic placeholder thumbnail instead of its own, a merge tag with no
  field, or a path the preview page names that no longer exists.
  **It must print `check-sync: 0 warnings` before anything is committed.**

## Blocks

| Block | What it is | Main editable fields |
| :-- | :-- | :-- |
| Logo Header | Centered 200px GLAAD logo | logo image, link, alt text, alignment, top padding, gap below |
| CTA Header | Logo left (160px), DONATE button right; stays side by side on phones | show/hide logo and button, logo image/link/alt/width, button label/link/colors/width, column order, gap below |
| Match Banner | Navy band, white heading and line, for match or deadline messages | content, text color, background, padding, gap below |
| Body Copy | Rich-text copy at the 30px baseline | content, link color, side padding, gap below |
| Gift Amount Buttons 4x1 | $50 / $100 / $250 / OTHER, 120px each; stack full column on phones | each button's label, link, colors and width; side padding up to 20px |
| CTA Button | Centered DONATE NOW button | label, link, colors, width, alignment, gap below |
| Signature (no photo) | "With gratitude," plus name and title | content, side padding, gap below |
| Image (full width) | 600px edge-to-edge image | image, link, alt text, gap below |
| Image (indented) | 540px image aligned to the copy | image, link, alt text, gap below |
| Social Links | "Follow Us!" heading plus four icons (black with a thin white halo; solid white in dark mode) | heading (show/hide), each icon's link and alt text (shared by both icon sets), light icon images (Social 1-4), dark icon images (Social 5-8), gap below |
| Footer | Near-black band: copyright, address, unsubscribe | content, text color, link color, padding |

The importer also adds its standard utility blocks (Template Styles and
Raw HTML).

**Debug Helper (template setting).** The template has a "Debug Helper"
field, Off by default. Switch it On in an email to show each block's name
(and version, once the repo has a version ledger) as a grey band above it
in EN's builder; switch it Off to hide them. The bands only ever show in
the builder, so an email sent with it On looks the same in the inbox.

**File names.** Every file in `upload/` starts with `glaad-`, because
GLAAD's EN image folder is shared with GLAAD's own files. The prefix is
declared once, as `assetPrefix` in the `en-tools-config` comment of
`src/main.mjml`: our own images in `src/assets/` are named with it, and the
importer adds it to the thumbnails and placeholder it names. check-sync
warns about any upload file without it.

Full width and indented are two blocks on purpose: an image sized to fill its
column has its width baked into the compiled HTML, so the importer withholds
a gutter control that would overflow it in Outlook.

## Brand and spacing

Declared in the `en-tools-config` comment at the top of `src/main.mjml`.

- **Spacing scale**: None 0, X-Small 10, Small 20, Medium 30, Large 40,
  X-Large 60 (px). GLAAD's email sits on a 10px grid, and the copy baseline is
  Medium (30px), the gutter their current template uses. Vertical spacing is
  bottom-only: each block owns the gap below it.
- **Brand colors**: Cyan `#00B2E3`, Light Cyan `#5DCBEB`, Azure `#008DD0`,
  Blue `#105BAB`, Navy `#0B4280` (sampled from the logo), plus CTA Blue
  `#0313C4` (the live email's own Outlook button rule), Near Black `#111111`,
  Charcoal `#454545` and Light Gray `#DEDEDE` from the live email, and
  Alt Cyan `#00AFDF`, Red `#FF3131` and Light Red `#FF7272` (added
  2026-11-16). The names are ours; swap in GLAAD's brand-guide names if
  they have them.

| Style | Size | Line-height |
| :-- | :-- | :-- |
| `h1` | 32px | 40px |
| `h2` | 24px | 30px |
| `h3` | 18px | 24px |
| Body `p` | 16px | 24px |
| Button (ALL CAPS, bold) | 16px | 20px |
| Footer | 14px | 18px |

Links are Blue `#105BAB` (6.9:1 on white); footer and banner links are white. Buttons
are CTA Blue with white text, 10px 30px padding and 3px corners, matching the
live email's `.msCta` rule. Donate links keep GLAAD's `?chain` parameter as
their live email uses it; gift amount links add EN's documented prefill
parameter, e.g. `?chain&transaction.donationAmt=50`.

## Dark mode

Ported from TPL's measured setup (authoring guide §2c):

- **Apple Mail, iOS Mail and similar** (`prefers-color-scheme: dark`) and
  **Outlook.com / Outlook for Mac** (`[data-ogsc]`, wrapped in a media query
  so EN keeps it) repaint the blocks black with white copy, Light Cyan
  `#5DCBEB` links, and CTA Blue buttons with white labels. Cyan `#00B2E3`
  would fail Outlook.com's 5.4:1 text check, so links use Light Cyan.
- The Match Banner keeps its Navy band in dark mode on purpose.
- The logo is a transparent PNG, so one file works on white and on black. The
  social icons swap to solid white versions where the client supports it.
- **Gmail apps and Outlook desktop can't run either branch.** They darken the
  email on their own and keep the black icons, so those carry a 1px white
  halo: invisible on white, an outline on a darkened ground. The icons are
  36px files (32px glyph plus halo room).

## Re-importing in the app by hand

`npm run export-en` does this for you. To do it manually: open the Email to
EN Marketing Tools app, paste the GitHub URL of `src/main.mjml`, then set
GLAAD's values in Settings (client 10109, asset root above) or paste any EN
export from GLAAD's account. Check the settings card before compiling: the
app pre-selects TPL's account values on load, and they must be replaced.

## Before the first real send

- **Unsubscribe link**: the footer's link is a placeholder. Replace it in the
  Footer block's Content field with EN's "Insert unsubscribe link" tool,
  pointing at GLAAD's subscription management page.
- **Upload everything in `upload/`** to GLAAD's EN image library. Until
  then the logo, icons, placeholder photo and block thumbnails show as
  broken.
- **Owner ID**: regenerate the import files with GLAAD's real owner (and
  folder) ID, see "Keeping everything in sync".
- **Gift amounts**: match the buttons to the amounts on GLAAD's donation page,
  and click each through from a real test email. EN only applies a prefill on
  the first click from an email, and we could not check the live page from
  here.
- **Signature**: confirm the name and title (Sarah Kate Ellis, President &
  CEO) with GLAAD before the first send.
- **Test send**: send one through EN to Email on Acid and check Outlook
  desktop, Gmail and Apple Mail, light and dark, at desktop and phone widths.

## Known limits of this first pass

- **Dark mode is unmeasured.** It follows TPL's measured rules, but no GLAAD
  email has been through a real EN send and Email on Acid yet.
- **Logo is 1x.** The transparent logo was made from GLAAD's 200px PNG (each
  pixel unmixed from the white plate), so it is still 200px wide shown at
  200px. A vector or 400px original from GLAAD would look sharper on retina
  screens.
- **No version ledger yet.** TPL's `versions.json` and `version-sync` are not
  ported, so EN block names carry no version suffix.
- **Twitter icon.** The live email still uses the Twitter bird; swap in an X
  icon if GLAAD has one.
