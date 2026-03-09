# Transfer Window Financial Simulator — Frontend

**Version 2.0.0** | Next.js 14 App Router + TypeScript + Tailwind + shadcn-inspired UI

## ✨ Features

- 🌙 **Dark/Light theme** with system preference detection
- 🔐 **Secure auth** — tokens stored in sessionStorage (not localStorage), auto-refresh on 401
- 🎨 **Beautiful UI** — Syne display font, custom design system, smooth animations (framer-motion)
- 📊 **FFP Charts** — recharts-powered squad cost / wage bill / ratio projections
- 📱 **Fully responsive** — mobile-first layout
- ⚡ **React Query** — intelligent caching, optimistic mutations, skeleton loaders
- 🧩 **All endpoints** integrated per OpenAPI spec

## 📋 Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_BACKEND_ORIGIN=http://localhost:8000
```

### 3. Start backend

Make sure your FastAPI backend is running at `http://localhost:8000`.

### 4. Run development server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## 🗂 Project Structure

```
transfer-window-simulator/
├── app/                        # Next.js App Router pages
│   ├── page.tsx                # Landing hero
│   ├── login/page.tsx          # Login form
│   ├── register/page.tsx       # Registration form
│   ├── me/page.tsx             # User profile
│   ├── clubs/
│   │   ├── search/page.tsx     # Club search
│   │   └── [clubId]/
│   │       ├── page.tsx        # Club profile
│   │       └── squad/page.tsx  # Squad viewer
│   ├── players/
│   │   └── [playerApiId]/page.tsx  # Player + salary override
│   ├── ffp/
│   │   └── [clubId]/page.tsx   # FFP dashboard + sim overlay
│   ├── simulations/
│   │   ├── page.tsx            # My simulations list
│   │   └── [simId]/page.tsx    # Simulation editor (buys/sells/loans)
│   └── admin/
│       └── users/page.tsx      # Admin user management
├── components/
│   ├── ui/index.tsx            # Design system components
│   ├── charts/FFPChart.tsx     # Recharts FFP visualizations
│   ├── forms/
│   │   └── SimulationCreateModal.tsx
│   └── layout/Navbar.tsx
├── lib/
│   ├── api/
│   │   ├── client.ts           # Full typed API client
│   │   └── types.ts            # TypeScript types from OpenAPI
│   ├── auth/context.tsx        # Auth provider + hooks
│   ├── schemas.ts              # Zod validation schemas
│   └── utils.ts                # Formatting utilities
└── scripts/
    └── generate-openapi-types.mjs  # Type generation script
```

---

## 🛡 Security Model

Tokens are stored in **sessionStorage** (not localStorage) and kept in memory. The access token is sent via `Authorization: Bearer <token>` header on every API call.

**Refresh flow:**
1. If any API call returns 401, the client attempts to exchange the refresh token
2. If refresh succeeds, the original request is retried
3. If refresh fails, all tokens are cleared and user is redirected to `/login`

---

## 👥 Role-Based Access

| Role | Access |
|------|--------|
| Anonymous | Search clubs, view squad (est. salaries), FFP dashboard |
| User | + Create/manage simulations |
| Sport Director | + Set club revenue, salary overrides, force sync |
| Admin | + All above + manage users via admin panel |

---

## 🔧 Generate TypeScript Types

```bash
# Copy your openapi.json to project root, then:
npm run generate-types
```

Or place `openapi.json` in the project root and it will be auto-read.

---

## 📦 Key Dependencies

| Package | Purpose |
|---------|---------|
| `next@14` | App Router framework |
| `@tanstack/react-query` | Data fetching, caching, mutations |
| `framer-motion` | Page/element animations |
| `recharts` | FFP projection charts |
| `react-hook-form` + `zod` | Form validation |
| `sonner` | Toast notifications |
| `next-themes` | Dark/light theme |
| `tailwindcss` | Utility-first CSS |
| `lucide-react` | Icon library |

---

## 📝 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_BACKEND_ORIGIN` | `http://localhost:8000` | Backend API base URL |

---

## 🚀 Production Build

```bash
npm run build
npm start
```
