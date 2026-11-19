FROM node:20-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Install dependencies using lockfile
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy application source code
COPY . .

EXPOSE 5173

# Run Vite dev server bound to all interfaces so host can connect
CMD ["pnpm", "dev", "--host", "0.0.0.0"]
