# Academic Risk Prediction & XAI Frontend

Frontend Single Page Application (SPA) for the **Academic Risk Prediction & Explainable AI (XAI) Management System**, built with React 19, TypeScript, Vite, Tailwind CSS v4, and `shadcn/ui`.

---

## Tech Stack

| Category | Technology |
|---|---|
| **Core Framework** | React 19 + TypeScript (Strict Mode) + Vite 8 |
| **Package Manager** | `pnpm` |
| **Styling & UI Kit** | Tailwind CSS v4 (`@tailwindcss/vite`) + `shadcn/ui` + `lucide-react` |
| **Routing** | `react-router-dom` (v7) |
| **Server State & Data Fetching** | `@tanstack/react-query` (v5) + `axios` |
| **Client State** | `zustand` |
| **Forms & Validation** | `react-hook-form` + `zod` + `@hookform/resolvers` |
| **Data Tables** | `@tanstack/react-table` |
| **Charts & Visualizations** | `recharts` |
| **Linter** | `oxlint` (Rust-based ultra-fast linter) |

---

## Project Structure

This project follows the **`bulletproof-react`** feature-based architectural pattern:

```text
frontend/
├── public/                  # Static assets
├── src/
│   ├── app/                 # Application shell, routing, and providers
│   │   ├── App.tsx          # Root shell composing providers and router
│   │   ├── providers.tsx    # TanStack Query, Sonner Toaster, Devtools
│   │   └── router.tsx       # Route definitions & RBAC navigation
│   ├── components/          # Reusable shared UI components
│   │   ├── layout/          # Shared layout components (Sidebar, Topbar, RoleGuard)
│   │   └── ui/              # shadcn/ui primitives (button, card, input, label, skeleton, sonner)
│   ├── features/            # Domain-driven feature modules
│   │   ├── auth/            # Login, session management, user profile
│   │   ├── classes/         # Class management and student rosters
│   │   ├── courses/         # Course list, prerequisites, CRUD operations
│   │   ├── students/        # Student academic profiles & risk badges
│   │   └── xai-predictions/ # SHAP/LIME visualizers, Counterfactuals, What-if simulator
│   ├── hooks/               # Shared custom React hooks
│   ├── lib/                 # Core utilities & networking layer
│   │   ├── api-client.ts    # Axios client with Bearer injection & silent token refresh
│   │   └── utils.ts         # cn() utility helper (clsx + tailwind-merge)
│   ├── types/               # Shared global TypeScript interfaces
│   ├── index.css            # Tailwind CSS v4 styling entrypoint
│   └── main.tsx             # Application bootstrap & DOM mount
├── .env.example             # Environment variables template
├── .env.development         # Local development environment configuration
├── .oxlintrc.json           # Oxlint configuration
├── components.json          # shadcn/ui configuration
├── package.json             # Dependencies and scripts
├── pnpm-lock.yaml           # Locked dependencies
├── tsconfig.json            # Root TypeScript project references
├── tsconfig.app.json        # Application TypeScript configuration with @/* alias
├── tsconfig.node.json       # Tooling TypeScript configuration
└── vite.config.ts           # Vite bundler configuration (@/* path alias + Tailwind plugin)
```

---

## Getting Started

### Prerequisites

- **Node.js**: `v20.x` or `v24.x`
- **pnpm**: `v10.x` or newer (Recommended: enable via `corepack enable pnpm`)

### 1. Install Dependencies

Install project dependencies using `pnpm`:

```bash
pnpm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.development` (or create `.env.local` for local overrides):

```bash
cp .env.example .env.development
```

Ensure the API base URL matches your FastAPI backend service:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

### 3. Start the Development Server

Run the Vite dev server:

```bash
pnpm run dev
```

The application will be available at:
```text
http://localhost:5173
```

---

## Available Scripts

| Command | Description |
|---|---|
| `pnpm run dev` | Starts Vite local development server on port `5173` |
| `pnpm run build` | Runs TypeScript typecheck (`tsc -b`) and builds production bundle |
| `pnpm run preview` | Previews the production build locally |
| `pnpm run lint` | Runs `oxlint` to check for React and TypeScript issues |
| `pnpm exec tsc --noEmit` | Runs TypeScript type checking without emitting files |

---

## Adding shadcn/ui Components

To add additional `shadcn/ui` components to `src/components/ui/`, run:

```bash
pnpm dlx shadcn@latest add <component-name>
```

Example:
```bash
pnpm dlx shadcn@latest add dialog dropdown-menu tabs
```
