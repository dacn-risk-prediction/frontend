---
name: init_vite_tailwind_core
description: Initialize and configure a production-ready React + Vite + TypeScript frontend foundation with Tailwind CSS, shadcn/ui, path aliases (@/), TanStack Query, Axios, and the bulletproof-react directory structure.
triggers:
  - "init frontend foundation"
  - "initialize vite tailwind core"
  - "setup react vite project"
  - "run init_vite_tailwind_core"
---

# Skill: Initialize React + Vite + Tailwind + Shadcn Core (`init_vite_tailwind_core`)

## Purpose

Automate the complete foundational setup for the Academic Risk Prediction & XAI Frontend SPA. This workflow takes an empty or newly created repository and configures Vite, strict TypeScript, `@/` path resolution, Tailwind CSS, `shadcn/ui`, core libraries, and the `bulletproof-react` folder hierarchy without leaving boilerplate clutter.

---

## Pre-Execution Checks

1. **Check Current Directory:** Verify whether a `package.json` with `vite` already exists in the workspace root.
   - If **NO**, scaffold a new Vite React-TS project in the current directory.
   - If **YES**, skip Step 1 and proceed directly to configuring aliases and dependencies.
2. **Package Manager:** Use `pnpm` exclusively for every command in this workflow.
   - If `pnpm` is not installed, enable it with `corepack enable pnpm` (or `npm install -g pnpm`).
   - If a `package-lock.json` or `yarn.lock` exists, remove it after the first `pnpm install` so only `pnpm-lock.yaml` remains.

---

## Step-by-Step Execution Workflow

### Step 1: Scaffold Vite + React + TypeScript
If the project is not yet initialized, run:
```bash
pnpm create vite@latest . --template react-ts
pnpm install
```

### Step 2: Configure Path Aliases (`@/`) in TypeScript & Vite
1. Install Node types:
   ```bash
   pnpm add -D @types/node
   ```
2. Update `tsconfig.json` and `tsconfig.app.json` inside `compilerOptions` to enforce strict mode and resolve `@/*`:
   ```json
   {
     "compilerOptions": {
       "strict": true,
       "baseUrl": ".",
       "paths": {
         "@/*": ["./src/*"]
       }
     }
   }
   ```
3. Update `vite.config.ts` to resolve `@` to `./src` and configure the dev server port (`5173`):
   ```typescript
   import path from "path"
   import react from "@vitejs/plugin-react"
   import { defineConfig } from "vite"

   export default defineConfig({
     plugins: [react()],
     resolve: {
       alias: {
         "@": path.resolve(__dirname, "./src"),
       },
     },
     server: {
       port: 5173,
     },
   })
   ```

### Step 3: Initialize Tailwind CSS & `shadcn/ui`
1. Initialize `shadcn/ui` non-interactively (this configures Tailwind CSS, CSS variables, and `@/lib/utils`):
   ```bash
   pnpm dlx shadcn@latest init -d -y
   ```
2. Ensure `src/lib/utils.ts` exists with the standard `cn()` class merging utility (`clsx` + `tailwind-merge`).
3. Install essential foundational UI primitives for layouts and feedback:
   ```bash
   pnpm dlx shadcn@latest add button card input label skeleton sonner -y
   ```

### Step 4: Install Core Architecture Dependencies
Install all required packages defined in `react-frontend.md`:
```bash
pnpm add @tanstack/react-query @tanstack/react-table axios react-router-dom zustand react-hook-form zod @hookform/resolvers lucide-react recharts
pnpm add -D @tanstack/react-query-devtools
```

### Step 5: Scaffold `bulletproof-react` Directory Structure
Create the standardized directory tree and remove default Vite boilerplate files (`src/App.css`, `src/assets/react.svg`):
```text
src/
├── app/
│   ├── providers.tsx
│   ├── router.tsx
│   └── App.tsx
├── components/
│   ├── ui/                  # Populated by shadcn/ui
│   └── layout/
├── features/
│   ├── auth/
│   ├── courses/
│   ├── classes/
│   ├── students/
│   └── xai-predictions/
├── hooks/
├── lib/
│   ├── api-client.ts
│   └── utils.ts
└── types/
    └── index.ts
```

### Step 6: Generate Base Boilerplate Files
1. **Environment Template (`.env.example` & `.env.development`):**
   ```env
   VITE_API_BASE_URL=http://localhost:8000/api/v1
   ```
2. **Global Providers (`src/app/providers.tsx`):**
   Configure `QueryClientProvider` with sensible defaults (`retry: 1`, `refetchOnWindowFocus: false`) and include `<Toaster />` from `sonner`.
3. **App Shell (`src/app/App.tsx`):**
   Wrap the router with `<AppProviders>` and update `src/main.tsx` to import `App` from `@/app/App`.
4. **Global Types (`src/types/index.ts`):**
   Define shared base contracts matching FastAPI:
   ```typescript
   export type UserRole = 'lecturer' | 'student';

   export interface PaginationParams {
     skip?: number;
     limit?: number;
     search?: string;
   }

   export interface PaginatedResponse<T> {
     items: T[];
     total: number;
   }
   ```

---

## Post-Execution Verification (Mandatory)

After completing Steps 1–6, run the following checks and fix any issues before finishing:
1. **Type Check:** Run `pnpm exec tsc --noEmit` to verify zero TypeScript or `@/` alias resolution errors.
2. **Build Check:** Run `pnpm build` to confirm Vite bundles cleanly.
3. **Summary Output:** Report the installed stack, created directory tree, and prompt the user to run the next skill (`setup_axios_dual_token`).
