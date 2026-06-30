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

export const api = {
  listContainers: () => request(`${API_BASE_URL}/containers`),
  listBoxes: (status) =>
    request(`${API_BASE_URL}/boxes${status ? `?status=${status}` : ""}`),
  listPlans: () => request(`${API_BASE_URL}/packing-plans`),
  resetContainer: (id) =>
    request(`${API_BASE_URL}/containers/${id}/reset`, { method: "POST" }),
};

export const vision = {
  scan: (leftBlob, rightBlob, label) => {
    const form = new FormData();
    form.append("camera_left", leftBlob, "left.jpg");
    if (rightBlob) form.append("camera_right", rightBlob, "right.jpg");
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

export { API_BASE_URL, VISION_BASE_URL, PACKING_BASE_URL };
