import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios"

// Extend request config to track retry attempts
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

// Create the centralized networking instance
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
})

// ==========================================
// 1. Request Interceptor: Attach Access Token
// ==========================================
apiClient.interceptors.request.use(
  (config: CustomAxiosRequestConfig) => {
    const token = localStorage.getItem("access_token")
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: AxiosError) => Promise.reject(error)
)

// ==========================================
// 2. Response Interceptor: Silent Token Refresh
// ==========================================
let isRefreshing = false
let failedQueue: Array<{
  resolve: (token: string) => void
  reject: (error: unknown) => void
}> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else if (token) {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as CustomAxiosRequestConfig | undefined

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Never attempt refresh or page reload if login itself returned 401
      if (originalRequest.url?.includes("/auth/login")) {
        return Promise.reject(error)
      }

      // If refresh token request itself fails with 401, clear credentials & redirect
      if (originalRequest.url?.includes("/auth/refresh")) {
        localStorage.removeItem("access_token")
        localStorage.removeItem("refresh_token")
        if (window.location.pathname !== "/login") {
          window.location.href = "/login"
        }
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`
            }
            return apiClient(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem("refresh_token")

      if (!refreshToken) {
        isRefreshing = false
        if (window.location.pathname !== "/login") {
          window.location.href = "/login"
        }
        return Promise.reject(error)
      }

      try {
        const response = await axios.post<{
          access_token: string
          refresh_token?: string
        }>(
          `${apiClient.defaults.baseURL}/auth/refresh`,
          { refresh_token: refreshToken },
          { headers: { "Content-Type": "application/json" } }
        )

        const { access_token, refresh_token: new_refresh_token } = response.data

        localStorage.setItem("access_token", access_token)
        if (new_refresh_token) {
          localStorage.setItem("refresh_token", new_refresh_token)
        }

        apiClient.defaults.headers.common["Authorization"] = `Bearer ${access_token}`
        processQueue(null, access_token)

        isRefreshing = false

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${access_token}`
        }
        return apiClient(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        isRefreshing = false

        localStorage.removeItem("access_token")
        localStorage.removeItem("refresh_token")
        if (window.location.pathname !== "/login") {
          window.location.href = "/login"
        }

        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)
