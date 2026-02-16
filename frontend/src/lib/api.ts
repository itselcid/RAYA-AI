import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Add auth token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("raya_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("raya_token");
      localStorage.removeItem("raya_user");
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  register: (data: Record<string, string>) =>
    api.post("/auth/register", data),
  me: () => api.get("/auth/me"),
};

// Patients
export const patientsApi = {
  list: (params?: Record<string, string>) =>
    api.get("/patients", { params }),
  get: (id: string) => api.get(`/patients/${id}`),
  create: (data: Record<string, unknown>) =>
    api.post("/patients", data),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/patients/${id}`, data),
  delete: (id: string) => api.delete(`/patients/${id}`),
  count: () => api.get("/patients/count"),
  queue: () => api.get("/patients/queue"),
  // Questions (doctor-configured)
  getQuestions: (patientId: string) =>
    api.get(`/patients/${patientId}/questions`),
  addQuestion: (patientId: string, data: Record<string, unknown>) =>
    api.post(`/patients/${patientId}/questions`, data),
  updateQuestions: (patientId: string, questions: Record<string, unknown>[]) =>
    api.put(`/patients/${patientId}/questions`, { questions }),
  deleteQuestion: (patientId: string, questionId: string) =>
    api.delete(`/patients/${patientId}/questions/${questionId}`),
};

// Calls
export const callsApi = {
  list: (params?: Record<string, string>) =>
    api.get("/calls", { params }),
  get: (id: string) => api.get(`/calls/${id}`),
  schedules: () => api.get("/calls/schedules/upcoming"),
  review: (callId: string, data: { action: string; doctor_notes?: string }) =>
    api.post(`/simulate/${callId}/review`, data),
};

// Alerts
export const alertsApi = {
  list: (params?: Record<string, string>) =>
    api.get("/alerts", { params }),
  count: () => api.get("/alerts/count"),
  update: (id: string, data: Record<string, unknown>) =>
    api.patch(`/alerts/${id}`, data),
};

// Analytics
export const analyticsApi = {
  dashboard: () => api.get("/analytics/dashboard"),
};

// Simulate
export const simulateApi = {
  start: (patient_id: string) =>
    api.post("/simulate/start", { patient_id }),
  message: (call_id: string, text: string) =>
    api.post(`/simulate/${call_id}/message`, { text }),
  end: (call_id: string) =>
    api.post(`/simulate/${call_id}/end`),
};

export default api;
