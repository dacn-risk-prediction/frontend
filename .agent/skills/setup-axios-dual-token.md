---
name: setup-axios-dual-token
description: Configure an enterprise-grade API networking client instance in a React + Vite + TypeScript frontend with request interceptors for Bearer token injection and response interceptors with a mutex lock/queue mechanism for seamless silent token rotation (Refresh Token) matching FastAPI's OAuth2 dual-token architecture. Use when setting up API clients, configuring Axios interceptors for authentication, handling 401 unauthorized errors, or implementing token refresh logic.
---
# Setup Axios Dual Token Interceptor

Configure an advanced networking layer (`src/lib/api-client.ts`) that handles dual-token authentication (Access Token + Refresh Token) and implements silent token rotation with a concurrent request queue to prevent race conditions during expiration.

## When to Use

- Configuring API networking layers for React repositories communicating with FastAPI backends
- Implementing silent token refresh when an Access Token expires (`401 Unauthorized`)
- Preventing infinite refresh loops and managing concurrent pending API requests while a token is being refreshed

## Steps

### 1. Create the API Client Module (`src/lib/api-client.ts`)

Create a robust networking instance featuring a request interceptor for attaching the Access Token and a response interceptor with a mutex queue for refreshing tokens.

```typescript
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

// Extend request config to track retry attempts
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Create the centralized networking instance
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// ==========================================
// 1. Request Interceptor: Attach Access Token
// ==========================================
apiClient.interceptors.request.use(
  (config: CustomAxiosRequestConfig) => {
    const token = localStorage.getItem("access_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

// ==========================================
// 2. Response Interceptor: Silent Token Refresh
// ==========================================
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (originalRequest.url?.includes("/auth/refresh") || originalRequest.url?.includes("/auth/login")) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem("refresh_token");

      if (!refreshToken) {
        isRefreshing = false;
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(
          `${apiClient.defaults.baseURL}/auth/refresh`,
          { refresh_token: refreshToken },
          { headers: { "Content-Type": "application/json" } }
        );

        const { access_token, refresh_token: new_refresh_token } = response.data;

        localStorage.setItem("access_token", access_token);
        if (new_refresh_token) {
          localStorage.setItem("refresh_token", new_refresh_token);
        }

        apiClient.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
        processQueue(null, access_token);

        isRefreshing = false;

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;

        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);