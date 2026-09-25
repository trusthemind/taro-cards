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

UI — **Atomic Design**. Імпорти йдуть тільки вниз:
`pages → templates → organisms → molecules → atoms`.

```
app/                    маршрути Next.js — це шар "pages"
  api/tarot                  стрім тлумачення + перевірка ліміту
  api/subscription           поточні права доступу відвідувача
  api/stripe/*               checkout, billing portal, webhook
components/
  atoms/                неподільні елементи без знання домену
    CardBack, Starfield, Ornament, Avatar, TypingIndicator
    ui/                      примітиви shadcn
  molecules/            кілька атомів як одне ціле
    TarotCard, ChatMessage, PlanCard, SubscriptionStatus
  organisms/            самостійні секції зі своїм станом
    CardSpread, CardSelection, TarotChat, PricingPlans, Paywall
  templates/            композиція сторінки і стан флоу
    ReadingTemplate, PricingTemplate
lib/                    не-UI: домен, конфіг, хуки, сервер
  tarot/                     колода, типи, системний промпт
  subscription/              типи, репозиторій, Stripe, хук
  config/                    env, тарифи
  kv.ts, visitor.ts, utils.ts, hooks/
```

Atomic Design — таксономія **тільки для UI**. Доменні моделі, Stripe і
сховище живуть у `lib/` і в неї не входять.

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
pnpm dev              # в одному терміналі
pnpm test             # в іншому — typecheck + обидва локальні набори
```

Окремо:

```bash
pnpm typecheck        # tsc --noEmit
pnpm test:api         # 49 перевірок API загалом
pnpm test:stripe      # 44 перевірки логіки платежів
pnpm test:clock       # життєвий цикл підписки на реальному test clock
```

### Два рівні тестів платежів

**`scripts/stripe-webhook.test.mjs`** (`pnpm test:stripe`) — детерміновано,
без акаунта Stripe. Події підписуються локально тим самим HMAC, що й у
Stripe, тому досяжна кожна гілка приймача, включно з тими, які на живому
акаунті відтворити важко:

- підпис: відсутній / чужий секрет / зіпсований / прив'язаний до тіла;
- **вікно толерантності підпису** — повтор старої, але валідно підписаної
  події відхиляється, а помірний перекіс годинника — ні;
- **доставка не по порядку** — Stripe не гарантує порядок, і його ретраї
  роблять інверсії буденними. Пізній `updated` не воскрешає скасовану підписку;
- ідемпотентність при повторній доставці;
- **строк перевіряється по годиннику, а не лише по статусу** — про це нижче;
- тріали, `past_due`, `unpaid`, `cancel_at_period_end`;
- період читається з **item**, а не зі старого поля підписки;
- пошук відвідувача: метадані → `client_reference_id` → зворотний пошук за
  `customer`.

**`scripts/stripe-clock.test.mjs`** (`pnpm test:clock`) — реальний
[test clock](https://docs.stripe.com/billing/testing/test-clocks). Потребує
справжнього `sk_test_…` і двох recurring-цін; `--bootstrap-prices` створить
їх і надрукує для `.env.local`. Проганяє тріал → конвертацію → продовження →
невдалий платіж → скасування в кінці періоду.

Чому дві: перший набір фіксує **наші рішення** на даних, які ми контролюємо;
другий віддає цей контроль заради реалізму — об'єкти еволюціонує сам Stripe.

### Що тут легко зробити неправильно

- **`advance` асинхронний.** Ендпойнт одразу повертає `advancing`; об'єкти ще
  не оновлені. Треба опитувати `status`, доки не стане `ready`. Це найчастіша
  причина примарних падінь у наборах з test clock.
- **Рахунок висить у `draft` близько години.** Якщо перемотати рівно на межу
  періоду, побачите несплачений draft і «застряглу» підписку. Треба
  переступати і через цю годину — тут це робить `advancePastBoundary`.
- **Не більше двох інтервалів за раз** (для місячної ціни — два місяці).
- **Годинник симуляції — не годинник застосунку.** Застосунок звіряється з
  реальним часом хоста і про симуляцію нічого не знає, тому клок стартує з
  *зараз* і рухається лише вперед. Клок у минулому зробив би всі підписки
  простроченими для застосунку.
- **`list` приховує об'єкти test clock**, якщо не звузити запит (тут — за
  `subscription`).
- **Ліміти:** 3 клієнти на симуляцію, 3 підписки на клієнта; симуляції
  видаляються через 30 днів. Скрипт прибирає за собою у `finally`.
- Скрипт **відмовляється працювати з `sk_live_`**.

`scripts/lib/stripe-stub.mjs` — крихітна заглушка Stripe API для димового
прогону самого скрипта (`STRIPE_API_HOST`/`STRIPE_API_PORT`). Вона перевіряє
керуючий потік, а не поведінку Stripe.

## Дизайн

Дизайн-мова описана в `.claude/skills/tarot-design/SKILL.md` — токени,
типографіка, motion, вимоги до доступності. Читайте перед змінами в UI.

`.mcp.json` підключає shadcn MCP з реєстрами `@shadcn`, `@magicui`,
`@aceternity`, `@tweakcn`:

```bash
pnpm dlx shadcn@latest add @magicui/border-beam
```

Анімації — `motion` (не `framer-motion`), утиліти — `@/lib/utils`, примітиви shadcn — `@/components/atoms/ui`.

Там же підключено **Playwright MCP** (headless), щоб агенти могли відкрити
`pnpm dev` у браузері, пройти сценарій і зробити скріншоти на desktop і mobile.
