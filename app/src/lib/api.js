const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const VISION_BASE_URL = import.meta.env.VITE_VISION_BASE_URL || "http://localhost:8001";
const PACKING_BASE_URL = import.meta.env.VITE_PACKING_BASE_URL || "http://localhost:8002";

async function request(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${text}`);
  }
  return response.json();
}

function jsonBody(data) {
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

export const api = {
  listContainers: () => request(`${API_BASE_URL}/containers`),
  createContainer: (data) => request(`${API_BASE_URL}/containers`, { method: "POST", ...jsonBody(data) }),
  updateContainer: (id, data) => request(`${API_BASE_URL}/containers/${id}`, { method: "PUT", ...jsonBody(data) }),
  deleteContainer: (id) => request(`${API_BASE_URL}/containers/${id}`, { method: "DELETE" }),
  resetContainer: (id) => request(`${API_BASE_URL}/containers/${id}/reset`, { method: "POST" }),
  dispatchContainer: (id) => request(`${API_BASE_URL}/containers/${id}/dispatch`, { method: "POST" }),
  recallContainer: (id) => request(`${API_BASE_URL}/containers/${id}/recall`, { method: "POST" }),
  removePlanItem: (itemId) => request(`${API_BASE_URL}/packing-plans/items/${itemId}`, { method: "DELETE" }),
  listBoxes: (status) => request(`${API_BASE_URL}/boxes${status ? `?status=${status}` : ""}`),
  createBox: (data) => request(`${API_BASE_URL}/boxes`, { method: "POST", ...jsonBody(data) }),
  listPlans: () => request(`${API_BASE_URL}/packing-plans`),
  getDashboard: () => request(`${API_BASE_URL}/analytics/dashboard`),
  getMe: () => request(`${API_BASE_URL}/accounts/me`),
  updateMe: (data) => request(`${API_BASE_URL}/accounts/me`, { method: "PUT", ...jsonBody(data) }),
  listApiKeys: () => request(`${API_BASE_URL}/api-keys/`),
  createApiKey: (data) => request(`${API_BASE_URL}/api-keys/`, { method: "POST", ...jsonBody(data) }),
  deleteApiKey: (id) => request(`${API_BASE_URL}/api-keys/${id}`, { method: "DELETE" }),
  listInventoryContainers: () => request(`${API_BASE_URL}/inventory/containers`),
  listShipments: () => request(`${API_BASE_URL}/inventory/shipments`),
  createShipment: (data) => request(`${API_BASE_URL}/inventory/shipments`, { method: "POST", ...jsonBody(data) }),
  updateShipment: (id, data) => request(`${API_BASE_URL}/inventory/shipments/${id}`, { method: "PUT", ...jsonBody(data) }),
  deleteShipment: (id) => request(`${API_BASE_URL}/inventory/shipments/${id}`, { method: "DELETE" }),
};

export const vision = {
  scan: (topBlob, sideBlob, label) => {
    const form = new FormData();
    form.append("camera_top", topBlob, "top.jpg");
    if (sideBlob) form.append("camera_side", sideBlob, "side.jpg");
    const query = label ? `?label=${encodeURIComponent(label)}` : "";
    return request(`${VISION_BASE_URL}/scan${query}`, {
      method: "POST",
      body: form,
    });
  },
};

export const packing = {
  run: (boxIds) =>
    request(`${PACKING_BASE_URL}/pack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ box_ids: boxIds ?? null }),
    }),
};

async function ping(url) {
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export const health = {
  check: async () => {
    const [api, visionSvc, packingSvc] = await Promise.all([
      ping(API_BASE_URL),
      ping(VISION_BASE_URL),
      ping(PACKING_BASE_URL),
    ]);
    return { api, vision: visionSvc, packing: packingSvc };
  },
};

export { API_BASE_URL, VISION_BASE_URL, PACKING_BASE_URL };
