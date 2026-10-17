// Centralized API configuration reading from frontend .env (VITE_API_URL) with Render production fallback
export const API_BASE_URL =
  import.meta.env.VITE_API_URL !== undefined
    ? import.meta.env.VITE_API_URL
    : (import.meta.env.PROD ? '' : 'http://localhost:5000')

export default {
  API_BASE_URL,
}
