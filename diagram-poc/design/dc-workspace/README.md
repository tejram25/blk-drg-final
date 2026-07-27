# DC-Workspace redesign — Block Diagram inside Demand Creation

The previous DC-workspace POC was rejected for not feeling like a real workspace
tool. This is the redesign: **Option A — "IDE Classic"**, an IntelliJ-style
workspace, themed with the official brand palette, in **dark and light**.

Open `workspace-reference.html` in a browser and use the **◐ Theme** button to
switch themes. That file is the visual contract for implementation; `tokens.css`
is the token set to import into the app.

| File | What it is |
|---|---|
| `workspace-reference.html` | The canonical Option A reference, both themes, self-contained (real Arrow logo + Arrow Display embedded) |
| `tokens.css` | Design tokens to import into the Angular app |
| `brand/` | Arrow wordmark, cropped from the official lockup, for light and dark chrome |
| `p2-*.png` | Phase 2 panels: Problems, BOM, Collaboration (dark + light) |

## Why Option A

| Option | Idea | Verdict |
|---|---|---|
| **A — IDE Classic** | Activity bar → project tree → editor tabs → inspector → status bar | **Chosen.** Literal IntelliJ metaphor: diagrams are "files", the canvas is the "editor". Densest and most credible as a tool. |
| B — Studio | Canvas-first with floating dockable panels (Figma-like) | Modern but further from the "IntelliJ" ask |
| C — Hub-embedded | Full Smart Ehub shell, editor as the active workspace | Most 1:1 with the hub, but less canvas room |

## Palette — strictly the Arrow theme

The brand guidelines say **"DON'T alter or add colors to the Arrow Color Theme."**
These six are the whole palette:

| Name | Value | Use here |
|---|---|---|
| Arrow Black | `#000000` | Chrome, canvas ground (dark) |
| White | `#FFFFFF` | Ground (light), text (dark) |
| Sky Blue | `#0084D5` | **Primary interaction + selection** |
| Patina Green | `#47D7AC` | Success / live / synced |
| Copper Yellow | `#FFC845` | Warning |
| Solar Orange | `#FF8674` | Attention / needs review |

**Neutrals are pure tints of Arrow Black/White** — no hue is added. That is the
fix for the earlier draft, which drifted off-brand by inventing navy/slate
neutrals and using a red that isn't in the Arrow theme.

Type: **Arrow Display** — Medium (600) for headings and emphasis, Regular (400)
for body; monospace only for part numbers. Fonts ship in the repo at
`diagram-poc/react-native-app/assets/fonts/`.

Logo: the official Arrow wordmark (`brand/`), white on dark chrome, black on
light — cropped from the full "ARROW / Five Years Out" lockup so it stays legible
at top-bar height.

> Rule: components consume **tokens only**, never raw hex — that's what keeps
> dark and light in sync, including the canvas.

## Layout anatomy (Option A)

```
┌──────────────────────────────────────────────────────────────────┐
│ top bar: mark · breadcrumb · Import/Validate/Share · presence    │
├────┬───────────────┬──────────────────────────┬─────────────────┤
│ a  │ Explorer      │ Editor                   │ Inspector       │
│ c  │  Diagrams     │  ┌ tabs ────────────┐    │  properties     │
│ t  │  Components   │  │ sub-bar          │    │  attached parts │
│ i  │  BOM          │  │ CANVAS (GoJS)    │    │  design review  │
│ v  │               │  │  minimap · zoom  │    │  AI copilot     │
├────┴───────────────┴──────────────────────────┴─────────────────┤
│ status bar: live·synced · collaborators · BOM · zoom · revision  │
└──────────────────────────────────────────────────────────────────┘
```

The IntelliJ cues that make it read as a workspace: an **activity bar**, a
**project tree**, **editor tabs with a modified dot**, a **breadcrumb**, a
**status bar**, a right-hand **inspector**, and a bottom **dock** (planned) for
Problems / BOM / Collaboration.

## Phases

| Phase | Scope | Notes |
|---|---|---|
| **0 · Tokens** ✅ | `tokens.css` + component kit (buttons, badges, panels, inputs) | Foundation, no visible risk |
| **1 · Chrome** ✅ | Activity bar, top bar, breadcrumb, editor tabs, status bar | The "it's a tool now" moment |
| **2 · Panels** ✅ | Explorer tree, inspector, bottom dock; wire to existing data | |
| **3 · Canvas theming** | Recolor GoJS: grid, node fill/stroke, selection `--accent`, wires | Themed via tokens so light works too |
| **4 · Symbols** | Recolor the electrical symbol library + part cards to brand | "even the block diagram" |
| **5 · Polish** | Motion, empty states, light-theme QA, responsive | |

Each phase is independently reviewable and revertible.

## Phase 2 — panels (done)

The reference is now **interactive**; open it and click around.

**Explorer** — filter box with a `Ctrl K` affordance, and a real collapsible
tree (chevrons rotate, children hide) across Diagrams, Component library and BOM.

**Inspector** — three tool tabs so the panel stops being one long scroll:

| Tab | Contents |
|---|---|
| Properties | label, symbol, part, classification chip, geometry |
| Parts | attached parts with qty, “Attach part”, lifecycle + stock |
| AI | copilot prompt and recent suggestions |

**Bottom dock** — the IntelliJ tool-window pattern, collapsible via the button
at its right edge:

| Tab | Contents |
|---|---|
| **Problems** `3` | DRC + AI-review findings, severity-coded (Solar = error, Copper = warning, Patina = pass), each with the offending node and the rule that fired |
| **Bill of materials** `14` | Ref / MPN / description / qty / lifecycle table, NRND flagged in Copper |
| **Collaboration** `3` | Live participants and the recent activity feed, including the AI agent's edits |
| **History** | Revision trail with author and age |

Severity and lifecycle are encoded in **color *and* glyph**, so state survives
greyscale printing and colour-blind viewing.

## Backlog — further IntelliJ-style ideas

- **Command palette** (Ctrl/⌘-K) — jump to any diagram, symbol, or action
- **Problems dock** — design-review/DRC findings as clickable items that select the offending node
- **Search everywhere** across diagrams, parts, templates
- **Dockable/collapsible tool windows** with edge toggles
- **Recent files / reopen last diagram** on launch
