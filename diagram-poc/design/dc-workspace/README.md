# DC-Workspace redesign — Block Diagram inside Demand Creation

The previous DC-workspace POC was rejected for not feeling like a real workspace
tool. This is the redesign: **Option A — "IDE Classic"**, an IntelliJ-style
workspace, themed with the official brand palette, in **dark and light**.

Open `workspace-reference.html` in a browser and use the **◐ Theme** button to
switch themes. That file is the visual contract for implementation; `tokens.css`
is the token set to import into the app.

| File | What it is |
|---|---|
| `workspace-reference.html` | The canonical Option A reference, both themes, self-contained |
| `tokens.css` | Design tokens to import into the Angular app |
| `ws-dark.png` / `ws-light.png` | Option A rendered in both themes |
| `optA.png` / `optB.png` / `optC.png` | The three directions that were reviewed |

## Why Option A

| Option | Idea | Verdict |
|---|---|---|
| **A — IDE Classic** | Activity bar → project tree → editor tabs → inspector → status bar | **Chosen.** Literal IntelliJ metaphor: diagrams are "files", the canvas is the "editor". Densest and most credible as a tool. |
| B — Studio | Canvas-first with floating dockable panels (Figma-like) | Modern but further from the "IntelliJ" ask |
| C — Hub-embedded | Full Smart Ehub shell, editor as the active workspace | Most 1:1 with the hub, but less canvas room |

## Palette

From the brand template (`theme1.xml` accents) plus the hub's own CSS:

| Token | Value | Use |
|---|---|---|
| `--brand` | `#E31837` | Logo mark, primary/destructive CTA. Sparingly. |
| `--accent` | `#0084D5` | Interaction + selection — the "IDE blue" |
| `--accent-2` | `#47D7AC` | Success / live / synced |
| `--amber` | `#FFC845` | Warning |
| `--coral` | `#FF8674` | Attention / needs review |

Type: **Inter** for UI, **Arrow Display** for the wordmark, monospace for MPNs.

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
| **0 · Tokens** | `tokens.css` + component kit (buttons, badges, panels, inputs) | Foundation, no visible risk |
| **1 · Chrome** | Activity bar, top bar, breadcrumb, editor tabs, status bar | The "it's a tool now" moment |
| **2 · Panels** | Explorer tree, inspector, bottom dock; wire to existing data | |
| **3 · Canvas theming** | Recolor GoJS: grid, node fill/stroke, selection `--accent`, wires | Themed via tokens so light works too |
| **4 · Symbols** | Recolor the electrical symbol library + part cards to brand | "even the block diagram" |
| **5 · Polish** | Motion, empty states, light-theme QA, responsive | |

Each phase is independently reviewable and revertible.

## Backlog — further IntelliJ-style ideas

- **Command palette** (Ctrl/⌘-K) — jump to any diagram, symbol, or action
- **Problems dock** — design-review/DRC findings as clickable items that select the offending node
- **Search everywhere** across diagrams, parts, templates
- **Dockable/collapsible tool windows** with edge toggles
- **Recent files / reopen last diagram** on launch
