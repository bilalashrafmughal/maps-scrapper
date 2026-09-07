import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

export default api;

// ── Stats ────────────────────────────────────────────────────────────────

export const getStats = () => api.get("/stats").then((r) => r.data);

// ── Campaigns ────────────────────────────────────────────────────────────

export const listCampaigns = () => api.get("/campaigns").then((r) => r.data);

export const getCampaign = (id) =>
  api.get(`/campaigns/${id}`).then((r) => r.data);

export const getCampaignProgress = (id) =>
  api.get(`/campaigns/${id}/progress`).then((r) => r.data);

export const getCampaignResults = (id) =>
  api.get(`/campaigns/${id}/results`).then((r) => r.data);

export const getCampaignLocations = (id) =>
  api.get(`/campaigns/${id}/locations`).then((r) => r.data);

export const createCampaign = (payload) =>
  api.post("/campaigns", payload).then((r) => r.data);
