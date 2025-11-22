// src/api.js
const API = import.meta.env.VITE_API_BASE || 'http://localhost:8787';

export async function loadCities() {
  const res = await fetch(`${API}/api/cities`);
  if (!res.ok) throw new Error(`Failed to load cities (${res.status})`);
  return res.json();
}

export async function geocodeViaServer(query) {
  const res = await fetch(`${API}/api/geocode?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  return res.json(); // { lat, lng, formatted }
}
