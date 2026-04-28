<div align="center">
  <img alt="ArcWall Logo" src="./public/logo.png" width="120" />
  <h1>ArcWall</h1>
  <p><b>AI wallpaper creation and asset management platform</b></p>
  <p>
    <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js" alt="Next.js" /></a>
    <a href="https://www.prisma.io/"><img src="https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma" alt="Prisma" /></a>
    <a href="https://redis.io/"><img src="https://img.shields.io/badge/Redis-Cache-DC382D?style=flat-square&logo=redis" alt="Redis" /></a>
    <a href="https://www.rabbitmq.com/"><img src="https://img.shields.io/badge/RabbitMQ-Queue-FF6600?style=flat-square&logo=rabbitmq" alt="RabbitMQ" /></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License" /></a>
  </p>
  <p>
    English | <a href="./docs/README.zh.md">简体中文</a>
  </p>
</div>

---

## 📖 Introduction

ArcWall is an AI-powered wallpaper platform for creators. You provide prompts, and ArcWall turns ideas into high-quality wallpapers. It includes end-to-end workflows for generation, publishing, favorites, recycle bin, credits, billing, and async task processing. In short: a digital studio that can paint, queue, and do bookkeeping.

## 🌟 Preview

> Preview assets are from the `public/` directory.

![ArcWall Banner](./public/banner.png)

<div align="center">
  <table>
    <tr>
      <td align="center"><b>Poster 01</b></td>
      <td align="center"><b>Poster 02</b></td>
    </tr>
    <tr>
      <td><img src="./public/poster_01.png" alt="Poster 01" width="400"/></td>
      <td><img src="./public/poster_02.png" alt="Poster 02" width="400"/></td>
    </tr>
    <tr>
      <td align="center"><b>Poster 03</b></td>
      <td align="center"><b>Poster 04</b></td>
    </tr>
    <tr>
      <td><img src="./public/poster_03.png" alt="Poster 03" width="400"/></td>
      <td><img src="./public/poster_04.png" alt="Poster 04" width="400"/></td>
    </tr>
  </table>
</div>

## ✨ Features

- 🎨 **AI Generation & Prompt Optimization**: Supports prompt input, model params, async generation, and retry on failure.
- 🖼️ **Gallery & Asset Management**: Includes trending/latest gallery, personal workspace, publish/unpublish, favorites, and batch operations.
- 🗑️ **Recycle Bin Workflow**: Deleted works can be restored or permanently removed, preventing accidental loss.
- 💰 **Credits & Billing**: Includes credit consumption/recharge history, orders, and balance tracking.
- 🌐 **Internationalization**: Built-in Chinese/English localization via `messages/zh.json` and `messages/en.json`.
- ⚡ **Async Job Architecture**: RabbitMQ + Redis + Worker handle generation jobs with distributed lock, progress cache, and result cache.
- ☁️ **Object Storage Upload**: Uploads files to OSS and returns signed URLs for access.

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS, Radix UI
- **State/Data**: Zustand, TanStack Query
- **Auth**: Clerk
- **Database**: PostgreSQL + Prisma
- **Queue & Cache**: RabbitMQ, Redis
- **AI Service**: OpenAI SDK-compatible endpoint (`ARK_API_BASE_URL`)
- **Storage**: Aliyun OSS
- **Deployment**: Vercel (with Cron + function maxDuration settings)

## 📁 Project Structure

```text
arcwall/
├── app/                 # Next.js App Router pages & API routes
├── components/          # UI components
├── lib/                 # Infra utilities (prisma/redis/rabbitmq/oss/auth)
├── messages/            # i18n locale files
├── models/              # Data access layer
├── prisma/              # Schema and seed sql
├── services/            # External service wrappers
├── store/               # Zustand stores
├── workers/             # Background worker process
└── public/              # Static assets
```

## 🚀 Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root and fill values for your environment.

```env
# Database
DATABASE_URL=
DIRECT_URL=

# Redis
REDIS_URL=

# RabbitMQ
RABBITMQ_URL=

# OSS
OSS_REGION=
OSS_AK=
OSS_SK=
OSS_BUCKET=
OSS_HOST=

# AI service (OpenAI-compatible)
ARK_API_BASE_URL=
ARK_API_KEY=

# App / Security
CRON_SECRET=
```

### 3. Generate Prisma client & Push schema

```bash
# Generate Prisma Client
npm run prisma:generate

# Push schema to database
npm run db:push

# Or if you prefer migration flow:
npm run prisma:migrate
```

### 4. Start dev server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

### 5. Start background worker (Recommended in another terminal)

```bash
npm run worker
```

> **Note:** Without the worker, queue jobs will not be processed.

## ☁️ Deployment

### Vercel (Recommended)

This project already includes `vercel.json`:
- Build command: `prisma generate && next build`
- `maxDuration` for critical API routes
- Cron for `/api/worker/process-queue` (every minute)

**Steps:**
1. Import repository into Vercel.
2. Configure all environment variables.
3. Deploy.
4. Ensure DB, Redis, RabbitMQ, and OSS are reachable from the deployment environment.

> **Note:** Cron auth uses `CRON_SECRET`; keep it consistent with callers.

## 📜 Useful Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run lint checks |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to DB |
| `npm run prisma:migrate` | Run DB migration |
| `npm run worker` | Start background worker |

## 🔌 API Overview (Partial)

- `POST /api/get-wallpapers`: Get wallpaper list (latest/trending)
- `POST /api/upload`: Upload file and return signed URL
- `POST /api/dictionaries`: Get dictionary config
- `POST /api/get-user-info`: Get user info
- `POST /api/models`: Get model config

## 📊 Data Models (Excerpt)

Core entities include:
- `users`, `roles`, `user_roles`
- `wallpapers`, `system_wallpapers`, `favorites`
- `orders`, `user_balance`, `credit_transactions`
- `dictionaries`, `redeem_codes`, `prompt_optimizations`

Full definitions can be found in `prisma/schema.prisma`.

## 💡 Additional Notes

### 🔒 Security
- Never commit `.env` file.
- Use separate production secrets with least-privilege access.
- Add rate limiting and audit logs for public endpoints.

### ⚡ Performance
- Add CDN caching for the image delivery pipeline.
- Scale worker instances horizontally based on queue length.
- Optimize Prisma queries with indexes and pagination strategy.

### 🐛 Troubleshooting
- **App opens but generation stalls**: Check Redis/RabbitMQ/Worker status first.
- **Generation fails**: Check AI service keys, network access, and quotas.
- **Image access fails**: Check OSS permissions, signed URL expiration, and domain config.

## 📄 License

This project is licensed under the [MIT License](./LICENSE).

## 🙏 Acknowledgements

Thanks to everyone turning "I have an idea" into "wow, this wallpaper looks amazing."
