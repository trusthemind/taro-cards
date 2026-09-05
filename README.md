# Містичне Таро

ШІ-ворожіння на картах таро українською. Три карти — минуле, теперішнє,
майбутнє — і Бабця Параска, яка тлумачить їх у стилі Леся Подерев'янського.

Next.js 16 (App Router) · React 19 · Tailwind v4 · Vercel AI SDK · Stripe.

## Запуск

```bash
pnpm install
cp .env.example .env.local   # заповніть ключі
pnpm dev
```

## Архітектура

Feature-Sliced Design. Залежності йдуть тільки вниз:
`app → widgets → features → entities → shared`.

```
app/          маршрути та API-хендлери
  api/tarot           стрім тлумачення + перевірка ліміту
  api/subscription    поточні права доступу відвідувача
  api/stripe/*        checkout, billing portal, webhook
widgets/      цілі екрани (tarot-reading, pricing)
features/     сценарії користувача (card-selection, card-spread,
              tarot-chat, subscription)
entities/     предметні моделі (tarot-card, subscription)
shared/       config (env, plans), lib (kv, utils, visitor), hooks
components/ui shadcn-примітиви
```

## Підписки

Оплата — Stripe Checkout, керування — Stripe Billing Portal.

Ліміти безкоштовного тарифу задані в `shared/config/plans.ts`
(`FREE_READINGS_PER_DAY`, `FREE_FOLLOWUPS_PER_READING`). API відповідає
`402` з `code: "subscription_required"`, коли ліміт вичерпано — клієнт на це
відкриває пейволл.

### Ідентифікація без акаунтів

Акаунтів немає, тому підписка прив'язується до анонімного `visitorId` у
підписаному httpOnly-куках (`shared/lib/visitor.ts`). Він же йде в Stripe як
`client_reference_id` і в метадані підписки. Наслідок: доступ живе в межах
браузера. Коли з'являться справжні акаунти — замінюється цей один модуль.

### Налаштування Stripe

1. Створіть продукт і **два** recurring-прайси (місячний і річний).
   Їх id — у `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY`.
2. Увімкніть Billing Portal: Dashboard → Settings → Billing → Customer portal.
3. Локальний вебхук:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   `whsec_...`, який він надрукує, покладіть у `STRIPE_WEBHOOK_SECRET`.
4. На проді додайте endpoint `https://<домен>/api/stripe/webhook` на події
   `checkout.session.completed` та `customer.subscription.*`.

### Зберігання

`shared/lib/kv.ts` — маленька абстракція над key/value:

- **Upstash Redis** через REST, якщо задані `UPSTASH_REDIS_REST_URL` і
  `UPSTASH_REDIS_REST_TOKEN` (без SDK, звичайний `fetch`).
- **In-memory Map** інакше — щоб `pnpm dev` працював без налаштувань.

> На проді Upstash обов'язковий. Пам'ять не переживає рестарт і не спільна
> між serverless-інстансами, тобто підписки просто загубляться.

## Перевірка

```bash
pnpm typecheck        # tsc --noEmit
pnpm build            # типи перевіряються і під час білду
pnpm dev              # в одному терміналі
pnpm test:api         # в іншому — 43 перевірки API
```

`scripts/e2e-api.mjs` покриває: підписаний кук відвідувача й відхилення
підробки, валідацію розкладу, ліміти безкоштовного тарифу та `402`,
guard-и checkout і portal, перевірку підпису вебхука (порожній / чужий /
протермінований), видачу та відкликання доступу, а також пошук відвідувача
за `customer` id, коли в події немає метаданих. Події підписуються локально
тим самим HMAC, що й у Stripe — акаунт Stripe для тестів не потрібен.

## Дизайн

Дизайн-мова описана в `.claude/skills/tarot-design/SKILL.md` — токени,
типографіка, motion, вимоги до доступності. Читайте перед змінами в UI.

`.mcp.json` підключає shadcn MCP з реєстрами `@shadcn`, `@magicui`,
`@aceternity`, `@tweakcn`:

```bash
pnpm dlx shadcn@latest add @magicui/border-beam
```

Анімації — `motion` (не `framer-motion`), утиліти — `@/shared/lib/utils`.
