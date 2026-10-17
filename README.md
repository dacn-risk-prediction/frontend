# Academic Risk Prediction & XAI Management System (Aurora Portal)

Frontend Single Page Application (SPA) for the **Academic Risk Prediction & Explainable AI (XAI) Management System (Aurora)**, built with React 19, TypeScript, Vite, Tailwind CSS v4, Base UI, and Lucide Icons.

---

## Tech Stack

| Category | Technology |
|---|---|
| **Core Framework** | React 19 + TypeScript (Strict Mode) + Vite 8 |
| **Package Manager** | `pnpm` (v10+) |
| **Styling & Design System** | Tailwind CSS v4 (`@tailwindcss/vite`) + Base UI (`@base-ui/react`) + Geist Font |
| **Icons** | `lucide-react` |
| **Routing & Navigation** | `react-router-dom` (v7) with Role-Based Access Control (RBAC) |
| **Server State & Data Fetching** | `@tanstack/react-query` (v5) + `axios` |
| **Client State** | `zustand` |
| **Forms & Validation** | `react-hook-form` + `zod` + `@hookform/resolvers` |
| **Notifications & Toasts** | `sonner` |
| **Charts & Visualizations** | Custom SVG Data-Driven Spline Curves & `recharts` |
| **Linter & Type Checking** | `oxlint` (Rust-based ultra-fast linter) + `tsc` |

---

## Key Features & Portal Modules

### 1. Authentication & Security
- **JWT-Based Authentication**: Secure credentials login matching FastAPI standards (`POST /api/v1/auth/login`).
- **Silent Token Rotation**: Automatic token refresh on `401 Unauthorized` responses via Axios interceptors with a failed request queue (`POST /api/v1/auth/refresh`).
- **Role-Based Access Control (RBAC)**: Route guards protecting `student`, `lecturer`, and `admin` portals, with an access-denied fallback (`/403`).

### 2. Student Academic Portal (`/student/*`)
- **Fixed Sidebar Layout (`StudentLayout`)**: Pinned desktop sidebar with independent scrollable navigation and sticky top header with user profile menu and breadcrumbs.
- **Academic Overview (`/student/overview`)**:
  - Personal student greeting and real-time academic standing metrics.
  - Interactive SVG GPA progression spline curve chart showing historical semester trends and in-progress projections.
  - Official degree completion audit progress bar (128 standard bachelor credits).
  - Active semester registered courses list queried dynamically via `GET /api/v1/students/{id}/current`.
- **Academic Record & Transcripts (`/student/record`)**:
  - Unified chronological transcript organized **newest to oldest**.
  - Collapsible semester blocks showing term GPA, cumulative GPA, and enrolled course breakdown.
  - Grade details including 4.0 scale GPA, letter grade, final exam, midterm, and quiz scores.
  - Search by course code/name and filter tabs (`ALL`, `PASSED`, `ENROLLED`, `FAILED`).
- **What-If Academic Simulator (`/student/what-if`)**:
  - Interactive score adjustment sliders to project instant GPA changes and risk counterfactuals.
  - Pre-selected course targeted simulation loaded via query parameters.
- **Academic Alerts & Notifications (`/student/alerts`)**:
  - Dynamic derived alerts based on live academic data:
    - **Academic Risk**: Critical Cumulative GPA drops below satisfactory thresholds (2.0/4.0), prerequisite course failures needing re-enrollment.
    - **Enrollment**: Active course retakes and credit registration status in the current semester.
    - **Degree Milestones**: Official graduation conferral and senior audit milestones.
  - Category filters (`ALL`, `RISK`, `ENROLLMENT`, `DEGREE`) and unread status tracking.
- **Student Profile & Settings (`/student/settings`)**:
  - Cohort, major, degree program, and institutional account information.

---

## Application Route Map

| Path | Access / Role | Component | Description |
|---|---|---|---|
| `/` | Public | `RootRedirect` | Automatically redirects authenticated users to their role portal, or to `/login` |
| `/login` | Guest Only | `LoginForm` | User authentication with email and password |
| `/student` | `student` | Redirect | Redirects to `/student/overview` |
| `/student/overview` | `student` | `StudentOverviewPage` | Student dashboard, GPA trend chart, active courses, degree progress |
| `/student/record` | `student` | `StudentAcademicRecordPage` | Official chronological semester transcript (newest to oldest) |
| `/student/what-if` | `student` | `StudentWhatIfPage` | What-If XAI grade simulator & counterfactual recovery planner |
| `/student/alerts` | `student` | `StudentAlertsPage` | Academic alerts, prerequisite reminders, and registration notices |
| `/student/settings` | `student` | `StudentSettingsPage` | Student profile and institutional program settings |
| `/lecturer/*` | `lecturer`, `admin` | `ProtectedRoute` | Lecturer class rosters and student risk evaluation |
| `/admin/*` | `admin` | `ProtectedRoute` | System administration and user management |
| `/403` | Public | Error View | Access Denied view when a user lacks required role permissions |

---

## Backend API Integration

The frontend seamlessly connects to the FastAPI backend service via [`src/lib/api-client.ts`](src/lib/api-client.ts):

| Endpoint | Method | Purpose in Frontend |
|---|---|---|
| `/auth/login` | `POST` | User authentication (exchanges email/password for JWT tokens) |
| `/auth/refresh` | `POST` | Silent background rotation of expired access tokens |
| `/users/me` | `GET` | Current authenticated user profile and assigned role |
| `/students/{id}` | `GET` | Student profile, cohort, major, and degree metadata |
| `/students/{id}/summary` | `GET` | Overall cumulative GPA, degree credits, and semester GPA history |
| `/students/{id}/current` | `GET` | Registered classes in current active semester (class code, group, credits, lecturer) |
| `/students/{id}/enrollments` | `GET` | Full course enrollment results and historical evaluation grades |
| `/courses/` | `GET` | Catalog of university courses and credit weights |

---

## Project Structure

This project follows the **`bulletproof-react`** domain-driven architectural pattern:

```text
frontend/
├── public/                  # Static assets
├── src/
│   ├── app/                 # Application shell, routing, and providers
│   │   ├── App.tsx          # Root shell composing providers and router
│   │   ├── providers.tsx    # TanStack Query, Sonner Toaster, Devtools
│   │   └── router.tsx       # Route definitions & RBAC navigation
│   ├── components/          # Shared components across features
│   │   ├── layout/          # Layout components (StudentLayout, ProtectedRoute)
│   │   └── ui/              # Base UI / shadcn primitives (avatar, badge, button, card, dropdown, input, progress, skeleton, sonner)
│   ├── features/            # Feature modules
│   │   ├── auth/            # Login, session management, auth hooks, user schemas
│   │   │   ├── api/         # auth-api.ts (login, refresh, me)
│   │   │   ├── components/  # LoginForm.tsx
│   │   │   ├── schemas/     # login-schema.ts (Zod validation)
│   │   │   └── types/       # AuthUser, LoginCredentials, TokenResponse
│   │   └── students/        # Student portal domain
│   │       ├── api/         # student-api.ts (TanStack Query hooks)
│   │       └── components/  # StudentOverviewPage, StudentAcademicRecordPage, StudentWhatIfPage, StudentAlertsPage, StudentSettingsPage
│   ├── lib/                 # Core network and utility layers
│   │   ├── api-client.ts    # Axios client with Bearer injection & silent token refresh
│   │   └── utils.ts         # cn() utility helper (clsx + tailwind-merge)
│   ├── types/               # Shared global TypeScript interfaces (api.ts, index.ts)
│   ├── index.css            # Tailwind CSS v4 styling entrypoint & theme variables
│   └── main.tsx             # Application bootstrap & DOM mount
├── .agent/rules/            # Project guidelines & API specifications
│   ├── API_SPECIFICATION.MD # Complete backend FastAPI endpoint contract
│   └── react_frontend_rules.md # Frontend coding rules & architectural constraints
├── .env.example             # Environment variables template
├── .env.development         # Local development environment configuration
├── .oxlintrc.json           # Oxlint configuration
├── components.json          # UI component configuration
├── package.json             # Dependencies and scripts
├── pnpm-lock.yaml           # Locked dependencies
├── tsconfig.json            # Root TypeScript project references
├── tsconfig.app.json        # Application TypeScript configuration with @/* alias
├── tsconfig.node.json       # Tooling TypeScript configuration
└── vite.config.ts           # Vite configuration (@/* alias + Tailwind v4 plugin)
```

---

## Getting Started

### Prerequisites

- **Node.js**: `v20.x` or `v24.x`
- **pnpm**: `v10.x` or newer (`corepack enable pnpm`)

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

Create `.env.development` (or `.env.local` for local overrides) matching your backend address:

```bash
cp .env.example .env.development
```

Ensure `VITE_API_BASE_URL` points to your active FastAPI backend:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

### 3. Start the Development Server

```bash
pnpm run dev
```

Open your browser at:
```text
http://localhost:5173
```

---

## Available Scripts

| Command | Description |
|---|---|
| `pnpm run dev` | Starts Vite local development server with hot-module replacement |
| `pnpm run build` | Runs TypeScript type checking (`tsc -b`) and bundles for production |
| `pnpm run preview` | Previews the production build locally |
| `pnpm run lint` | Runs `oxlint` to verify code quality with 0 errors/warnings |
| `pnpm exec tsc --noEmit` | Runs strict TypeScript verification without emitting output files |

---

## Coding Standards & Conventions

- **Conditional Classes**: Always use the [`cn()`](src/lib/utils.ts) helper (`clsx` + `tailwind-merge`) when conditionally applying Tailwind CSS classes. Never use manual string interpolations in `className`.
- **Strict TypeScript**: Avoid `any`; use strict interfaces reflecting backend schemas from [`src/types/api.ts`](src/types/api.ts).
- **Component Design**: Domain components reside in `src/features/{feature}/components`, while primitives reside in `src/components/ui/`.
- **Clean Linting**: Codebase maintains **0 errors and 0 warnings** under `oxlint` and `tsc --noEmit`.
