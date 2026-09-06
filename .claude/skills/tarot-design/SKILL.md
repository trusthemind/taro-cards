---
name: tarot-design
description: The Містичне Таро visual language — tokens, typography, motion and component patterns. Use when adding or changing any UI in this repo (screens, components, styling, animation), when pulling a component from a shadcn registry, or when asked to make something "look right" / match the app's style.
---

# Містичне Таро — design language

Candlelight in a dark room. Deep indigo night, one warm gold accent, and slow
ambient motion. Nothing is bright white; nothing is pure black.

## Non-negotiables

1. **Dark only.** There is no light theme. `:root` and `.dark` carry the same
   values on purpose — don't add a light palette or a theme toggle.
2. **Ukrainian-first typography.** Every face must ship Cyrillic *including*
   Ґ/ґ (U+0490–0491). Verify before adopting a font:
   ```bash
   curl -s "https://fonts.googleapis.com/css2?family=<Name>&display=swap" \
     -H "User-Agent: Mozilla/5.0 ... Chrome/120" | grep -c cyrillic
   ```
   Cinzel, Marcellus and most "occult" display faces are **Latin-only** and
   will silently fall back to Georgia. This bit the project once already.
3. **No currency glyph.** Write `грн`, not `₴` (U+20B4) — the display face has
   no hryvnia glyph and it falls back at a mismatched size.
4. **Respect `prefers-reduced-motion`.** The design leans on ambient loops, so
   this matters more here than usual. In CSS the global block in
   `app/globals.css` handles it; in components call `useReducedMotion()` from
   `motion/react` and pass `undefined` (not `{}`) to `animate`/`whileHover`.

## Tokens

Defined once in `app/globals.css`. Use the semantic name, never a raw colour.

| Token | Use |
|---|---|
| `--background` | page ground |
| `--surface-1` / `--surface-2` | raised panels, chat header, inputs |
| `--gold` | the single accent: CTAs, headings, borders, focus |
| `--gold-bright` / `--gold-pale` | highlight stops inside gradients only |
| `--accent` | violet; gradients and "reversed card" text. Never body text |
| `--muted-foreground` | secondary copy (measured 7:1 on the ground) |

Glow is a token too — `--glow-sm/md/lg`. Don't hand-roll new gold shadows.

### Contrast floor
Body text ≥ 4.5:1, large text ≥ 3:1. Measure, don't eyeball — a downscaled
screenshot of a dark UI always looks worse than it is:
```js
// in the browser console
const cv=document.createElement('canvas');cv.width=cv.height=1
const ctx=cv.getContext('2d',{willReadFrequently:true})
const rgb=c=>{ctx.fillStyle='#000';ctx.fillRect(0,0,1,1);ctx.fillStyle=c;ctx.fillRect(0,0,1,1)
  const d=ctx.getImageData(0,0,1,1).data;return [d[0],d[1],d[2]]}
const L=c=>{const[r,g,b]=rgb(c).map(v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4})
  return 0.2126*r+0.7152*g+0.0722*b}
const ratio=(f,b)=>{const[a,c]=[L(f),L(b)].sort((x,y)=>y-x);return (a+0.05)/(c+0.05)}
```

## Type scale

Fluid `clamp()` steps `--text-xs` … `--text-4xl`, mapped into Tailwind via
`@theme inline`. **Never** set `html { font-size: … }` to scale the UI — that
also rescales every shadcn control. Use the scale.

- `font-sans` → Playfair Display (display / headings / numerals)
- `font-serif` → Cormorant Garamond (body, chat, long copy) — the `<body>` default

## Signature treatments

- `.text-gilded` — animated gold sweep on headings. Its gradient must use
  **`background-image`**, never the `background` shorthand: the CSS pipeline
  re-emits shorthands inside an `@supports` fallback, and the later shorthand
  resets `background-clip` back to `border-box`, painting a solid bar over the
  text. Same rule applies to any new clipped-text effect.
- `.card-back` + `.foil-sheen` — the reverse of a card. Always render it via the
  `CardBack` entity component; never re-inline the markup.
- `.starfield` — one fixed, `aria-hidden`, `pointer-events: none` layer per
  page. Two drifting sub-layers give parallax.
- `.scrollbar-mystic` — for any internal scroll region.

## Motion

Ease `[0.25, 0.46, 0.45, 0.94]` for card and phase transitions. Entrances
stagger by ~45–90 ms. Ambient loops run 3–9 s. Keep hover lifts under 6%.

## Accessibility

Anything clickable is a `<button>`, not a `div` with `onClick` — the card fan
and the reveal flip both depend on this for keyboard access. Give decorative
glyphs (`✦`, emoji) `aria-hidden`, name controls with `aria-label`, and mark
live regions (`aria-live="polite"`) for the selection hint and chat log.

## Where a component goes

The UI is organised by **Atomic Design**. Pick the layer by what a thing *is*,
not by which screen uses it:

| Layer | Contains | Examples |
|---|---|---|
| `components/atoms/` | indivisible UI; no domain knowledge | `CardBack`, `Starfield`, `Ornament`, `ParascaAvatar`, `TypingIndicator`, `ui/*` (shadcn) |
| `components/molecules/` | a few atoms bound into one unit | `TarotCard`, `ChatMessage`, `PlanCard`, `SubscriptionStatus` |
| `components/organisms/` | a self-contained section with its own state | `CardSpread`, `CardSelection`, `TarotChat`, `PricingPlans`, `Paywall` |
| `components/templates/` | whole-page composition and flow state | `ReadingTemplate`, `PricingTemplate` |
| `app/**/page.tsx` | the "pages" layer — routing and metadata only | |

Rules:

- Imports only ever point **downwards** (a molecule may use atoms, never an
  organism). If an atom needs to know about a subscription plan, it isn't an atom.
- Atomic Design is a taxonomy for **UI only**. Domain models, config, hooks,
  Stripe and storage live in `lib/` and are outside it. Never create
  `entities/`, `features/`, `widgets/` or a `shared/` layer here.
- Before inlining markup a second time, extract it. `CardBack` exists because
  the same card reverse had been pasted into four places and had drifted apart.

## Pulling components from a registry

`.mcp.json` wires up the shadcn MCP with `@shadcn`, `@magicui`, `@aceternity`
and `@tweakcn`. Add with `pnpm dlx shadcn@latest add @magicui/<item>` — it lands
in `components/atoms/ui/`. Afterwards:

- Rewrite hard-coded hex colours to the tokens above (`BorderBeam` shipped with
  `#ffaa40` / `#9c40ff`).
- Confirm it imports `motion/react` — this repo does **not** use `framer-motion`.
- Confirm it imports `@/lib/utils`, and that anything re-exporting it points at
  `@/components/atoms/ui/<name>`.
