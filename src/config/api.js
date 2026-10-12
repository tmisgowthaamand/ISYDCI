// Centralized API configuration reading from frontend .env (VITE_API_URL)
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

export default {
  API_BASE_URL,
}
