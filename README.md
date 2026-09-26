# Містичне Таро

ШІ-ворожіння на картах таро українською. Людина ставить питання, обирає
розклад (від однієї карти «так чи ні» до Кельтського хреста), тягне карти — і
тарологиня Марта (ім'я — у `lib/config/reader.ts`) тлумачить їх з огляду на
питання, позиції та загальні ознаки розкладу (`lib/tarot/prompt.ts`).

Щоб поверталися: карта дня з серією і бонусним розкладом кожні 7 днів,
нагадування на пошту, журнал розкладів з продовженням розмови, акаунти через
email-посилання, 7-денний trial.

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
  api/tarot                  стрім тлумачення + ліміт + збереження в журнал
  api/subscription           права доступу, trial, email; позначає «активний сьогодні»
  api/stripe/*               checkout, confirm, billing portal, webhook
  api/auth/*                 magic link: request → verify (POST), logout
  api/me                     хто увійшов, налаштування нагадувань
  api/daily                  карта дня і серія
  api/history[/id]           журнал розкладів
  api/events                 клієнтські події аналітики (білий список)
  api/admin/stats            метрики, Bearer $ADMIN_TOKEN
  api/cron/daily             ранкові листи (Vercel Cron, vercel.json)
  login, account, history    сторінки входу, кабінету, журналу
components/
  atoms/                неподільні елементи без знання домену
    CardBack, Starfield, Ornament, Avatar, TypingIndicator
    ui/                      примітиви shadcn
  molecules/            кілька атомів як одне ціле
    TarotCard, ChatMessage, PlanCard, SubscriptionStatus, QuestionField,
    FallbackReading, AccountNav, PageHeader
  organisms/            самостійні секції зі своїм станом
    CardSpread, CardSelection, TarotChat, PricingPlans, Paywall,
    DailyCard, SpreadPicker
  templates/            композиція сторінки і стан флоу
    ReadingTemplate, PricingTemplate, LoginTemplate, AccountTemplate,
    HistoryTemplate, ReadingDetailTemplate
lib/                    не-UI: домен, конфіг, хуки, сервер
  tarot/                     колода, розклади, промпт, fallback без ШІ
  subscription/              типи, репозиторій, Stripe, trial, хук
  analytics/                 події, лічильники, retention
  config/                    env, тарифи, тарологиня
  account.ts, identity.ts    акаунти, вхід, перенесення даних між id
  daily.ts, history.ts       карта дня і серія, журнал
  kv.ts, visitor.ts, email.ts, dates.ts, utils.ts, hooks/
```

Atomic Design — таксономія **тільки для UI**. Доменні моделі, Stripe і
сховище живуть у `lib/` і в неї не входять.

## Підписки

Оплата — Stripe Checkout, керування — Stripe Billing Portal.

Ліміти безкоштовного тарифу задані в `lib/config/plans.ts`
(`FREE_READINGS_PER_DAY`, `FREE_FOLLOWUPS_PER_READING`). API відповідає
`402` з `code: "subscription_required"`, коли ліміт вичерпано або розклад
платний — клієнт на це відкриває пейволл. Бонусні розклади за серію карт дня
витрачаються після щоденного.

**Trial.** Перша підписка отримує `STRIPE_TRIAL_DAYS` (типово 7) днів
безкоштовно; картку Checkout бере одразу, без картки наприкінці trial
підписка скасовується. Один trial на email (`trial:email:*`).
Увімкніть у Stripe: Settings → Billing → Subscriptions → «Send reminder emails
before trial ends».

### Ідентифікація й акаунти

Усе (підписка, ліміт, журнал, серія) прив'язане до `visitorId` у підписаному
httpOnly-куках (`lib/visitor.ts`). Акаунт — це `email → канонічний visitorId`
(`lib/account.ts`). Вхід через одноразове посилання на пошту (15 хв):
на новому пристрої кука просто перемикається на канонічний id, тож дані
«їдуть» за людиною без другої моделі зберігання.

- Якщо до входу браузер уже мав свою підписку чи журнал — вони
  переносяться в акаунт, а старий id стає псевдонімом, щоб вебхуки Stripe зі
  старим id у метаданих теж потрапили куди треба (`lib/identity.ts`).
- Якщо підписку оплатили анонімно, а куку втрачено — вхід з email, яким
  платили, знаходить підписку в Stripe за email і повертає доступ.
- Посилання відкривається на `/login`, який погашає токен POST-запитом:
  поштові сканери, що «клікають» по посиланнях, не спалять його.
- Листи — через Resend (`RESEND_API_KEY`, `EMAIL_FROM`). Без ключа в розробці
  лист друкується в консоль `pnpm dev`, а API повертає `devLink`.

### Утримання й аналітика

- **Карта дня** (`lib/daily.ts`): детермінована для (відвідувач, дата за
  Києвом), коротке ШІ-тлумачення кешується на день. Серія днів поспіль;
  кожні 7 днів — бонусний розклад.
- **Нагадування**: `/api/cron/daily` щоранку (06:00 UTC) надсилає назву карти
  тим, хто увімкнув це в кабінеті. Потрібен `CRON_SECRET`.
- **Журнал**: кожен розклад зберігається з питанням і розмовою; розмову можна
  продовжити. Безкоштовно видно останні 5, з підпискою — усі.
- **Без ШІ**: якщо модель недоступна, API відповідає `503 ai_unavailable`
  ще до списання ліміту, а клієнт показує значення карт з колоди.
- **Метрики** (`lib/analytics`): нові, DAU, retention D1/D7/D30 по когортах і
  лічильники подій (розклади, пейволл, checkout, trial, карта дня, входи).
  ```bash
  curl -H "Authorization: Bearer $ADMIN_TOKEN" https://<домен>/api/admin/stats?days=14
  ```
  Перегляди сторінок, як і раніше, — у Vercel Analytics.

### Налаштування Stripe

Усе, що потрібно в Stripe, створює один скрипт. Його можна запускати скільки
завгодно разів: він знаходить уже створене й нічого не дублює.

```bash
pnpm stripe:setup                        # sandbox-ключ з .env.local
pnpm stripe:setup --webhook-url=https://<домен>/api/stripe/webhook
pnpm stripe:setup --dry-run              # лише показати, нічого не писати
pnpm stripe:setup --live                 # обов'язково для sk_live_
```

Він створює:
- продукт і дві ціни в UAH з lookup keys `taros_monthly` / `taros_yearly`.
  Якщо змінити суму в скрипті, з'явиться нова ціна, а наявні підписники
  лишаться на старій;
- конфігурацію Billing Portal: зміна тарифу з перерахунком, скасування в кінці
  періоду з причиною, оновлення картки, рахунки, вхід у портал за email;
- (з `--webhook-url`) webhook на потрібні події. Його секрет Stripe показує
  лише при створенні, тому скрипт записує його саме тоді.

Скрипт записує в `.env.local` змінні `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`,
`STRIPE_PORTAL_CONFIGURATION`, `NEXT_PUBLIC_STRIPE_PORTAL_LOGIN_URL` і,
за наявності, `STRIPE_WEBHOOK_SECRET`. Ті самі значення перенесіть у Vercel.

Локальний webhook без публічної адреси:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
`whsec_...`, який він надрукує, покладіть у `STRIPE_WEBHOOK_SECRET`.

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
pnpm test:api         # 109 перевірок API (з заглушкою OpenAI, див. нижче)
pnpm test:stripe      # 44 перевірки логіки платежів
pnpm test:clock       # життєвий цикл підписки на реальному test clock
```

### Шлях через модель без ключа

`scripts/lib/openai-stub.mjs` — мінімальна заглушка Responses API. З нею
`test:api` перевіряє, що промпт містить розклад, карти й питання, що розклад
списує ліміт і зберігається в журнал, а продовження розмови оновлює той самий
запис:

```bash
node scripts/lib/openai-stub.mjs &
OPENAI_API_KEY=sk-stub OPENAI_BASE_URL=http://localhost:4010/v1 pnpm dev
OPENAI_STUB=http://localhost:4010 pnpm test:api
```

Без заглушки й без ключа ці перевірки пропускаються, а решта перевіряє шлях
`503 ai_unavailable`.

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
