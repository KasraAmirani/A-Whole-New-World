// src/main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Globe from 'three-globe';
import { feature } from 'topojson-client';
import { loadCities, loadWeather } from './api.js'; // /api/cities + /api/weather

const appEl = document.getElementById('app');
const canvas = document.getElementById('stage');
const fatalEl = document.getElementById('fatal');
const panelEl = document.getElementById('panel');
const panelInnerEl = document.getElementById('panel-inner');
const tooltipEl =
  document.getElementById('tooltip') ||
  document.getElementById('country-tooltip');

// search UI
const searchInput = document.getElementById('search-input');
const searchList = document.getElementById('search-results');
// favorites bar
const favBarEl = document.getElementById('favorites-bar');

// trip tray UI
const tripTrayEl = document.getElementById('trip-tray');
const tripStopsEl = document.getElementById('trip-stops');
const tripStatsEl = document.getElementById('trip-stats');
const tripClearBtn = document.getElementById('trip-clear');

/* ---------- TAGS + CITY MEDIA ---------- */

const TAG_DEFS = [
  { id: 'all',       label: 'All' },
  { id: 'history',   label: 'History' },
  { id: 'food',      label: 'Food' },
  { id: 'nightlife', label: 'Nightlife' },
  { id: 'nature',    label: 'Nature' }
];

/**
 * Per-city travel content for this prototype.
 * Photos must match actual files in /public/images/cities/.
 */
const CITY_MEDIA = {
  Dublin: {
    experiences: [
      {
        title: 'Temple Bar',
        tags: ['nightlife', 'food'],
        description: 'Classic cobbled quarter packed with pubs, live music and late-night energy.'
      },
      {
        title: 'Trinity College & Book of Kells',
        tags: ['history'],
        description: 'Walk through the historic campus and see the illuminated manuscript in the Old Library.'
      },
      {
        title: 'Guinness Storehouse',
        tags: ['history', 'food'],
        description: 'Seven floors of beer lore ending with a pint and 360° views over Dublin.'
      }
    ],
    photos: [
      { url: '/images/cities/dublin-1.jpg', tags: ['history'] },
      { url: '/images/cities/dublin-2.jpg', tags: ['nightlife', 'food'] }
    ]
  },
  Athens: {
    experiences: [
      {
        title: 'Acropolis & Parthenon',
        tags: ['history', 'nature'],
        description: 'Climb the rock for sunrise or sunset and walk through 2,500 years of history.'
      },
      {
        title: 'Plaka district',
        tags: ['food', 'history'],
        description: 'Labyrinth of old streets, tavernas, and little shops below the Acropolis.'
      },
      {
        title: 'National Archaeological Museum',
        tags: ['history'],
        description: 'One of the world’s great ancient collections – perfect for a slower afternoon.'
      }
    ],
    photos: [
      { url: '/images/cities/athens-1.jpg', tags: ['history', 'nature'] }
    ]
  },
  Copenhagen: {
    experiences: [
      {
        title: 'Nyhavn waterfront',
        tags: ['food', 'nightlife'],
        description: 'Colourful houses, cosy cafés and boats – great for golden hour.'
      },
      {
        title: 'Tivoli Gardens',
        tags: ['nightlife', 'nature'],
        description: 'Vintage amusement park, lights at night, concerts in summer.'
      },
      {
        title: 'Rosenborg Castle & King’s Garden',
        tags: ['history', 'nature'],
        description: 'Renaissance castle with crown jewels and a relaxing park around it.'
      }
    ],
    photos: [
      { url: '/images/cities/copenhagen-1.jpg', tags: ['history', 'nightlife'] }
    ]
  },
  Zagreb: {
    experiences: [
      {
        title: 'Ban Jelačić Square',
        tags: ['food', 'nightlife'],
        description: 'Central meeting point with cafés and easy access to all parts of the city.'
      },
      {
        title: 'Upper Town (Gornji Grad)',
        tags: ['history'],
        description: 'Medieval streets, St. Mark’s Church and views over the red rooftops.'
      },
      {
        title: 'Dolac Market',
        tags: ['food', 'nature'],
        description: 'Morning market with local produce, flowers and snacks.'
      }
    ],
    photos: [
      { url: '/images/cities/zagreb-1.jpg', tags: ['history', 'food'] }
    ]
  }
};

// Simple country overview text for the new country panel.
// (Later this can be replaced by live Wikimedia/Wikipedia summaries.)
const COUNTRY_INFO = {
  Ireland: {
    summary:
      'Ireland combines compact cities, coastal villages and quick access to green hills and sea. Dublin is the main hub for first-time trips.'
  },
  Greece: {
    summary:
      'Greece blends ancient history with island life and long evenings outside. Athens is the gateway to ruins, food and the Aegean.'
  },
  Denmark: {
    summary:
      'Denmark brings together calm design, bike culture and harborside life. Copenhagen is the natural first stop for exploring.'
  },
  Croatia: {
    summary:
      'Croatia mixes Central European architecture with Adriatic coastlines. Zagreb is a comfortable base before heading out to nature or the sea.'
  }
};

// current active filter for the open *city* panel
let currentTag = 'all';

/* ---------- favorites (localStorage) ---------- */

const FAV_KEY = 'travel-globe:favorites';

function makeCityKey(city) {
  return `${city.country}|${city.name}`;
}

function loadFavoriteSet() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr);
  } catch {
    return new Set();
  }
}

let favoriteCities = loadFavoriteSet();

function saveFavoriteSet() {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify([...favoriteCities]));
  } catch {
    // ignore
  }
}

function isFavorite(city) {
  return favoriteCities.has(makeCityKey(city));
}

/* ---------- favorites bar under search ---------- */

let allCities = []; // declared here so renderFavoriteBar & country panel can see it

function renderFavoriteBar() {
  if (!favBarEl || !allCities.length) return;

  const favorites = allCities.filter(c => favoriteCities.has(makeCityKey(c)));
  if (!favorites.length) {
    favBarEl.innerHTML = '';
    return;
  }

  favBarEl.innerHTML = favorites.map(c => `
    <button
      class="fav-chip"
      data-city="${c.name}"
      data-country="${c.country}"
      type="button"
    >
      ★ ${c.name}
    </button>
  `).join('');

  favBarEl.querySelectorAll('.fav-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-city');
      const country = btn.getAttribute('data-country');
      const city = allCities.find(
        c => c.name === name && c.country === country
      );
      if (city) {
        startFlyToCity(city);
      }
    });
  });
}

/* ---------- lightweight image preloader ---------- */

const IMAGE_CACHE = new Set();

function preloadCityImages() {
  const urls = Object.values(CITY_MEDIA)
    .flatMap(city => city.photos.map(p => p.url));
  urls.forEach(url => {
    if (!url || IMAGE_CACHE.has(url)) return;
    const img = new Image();
    img.src = url;
    IMAGE_CACHE.add(url);
  });
}

/* ---------- error helper ---------- */

function fatal(msg) {
  console.error(msg);
  if (fatalEl) {
    fatalEl.textContent =
      typeof msg === 'string' ? msg : (msg?.message || 'Unknown error');
    fatalEl.classList.add('show');
  }
  throw new Error(
    typeof msg === 'string' ? msg : (msg?.message || String(msg))
  );
}

/* ---------- three.js core ---------- */

if (!canvas) fatal('#stage canvas not found in index.html');

const renderer = new THREE.WebGLRenderer({ antialias: true, canvas });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
camera.position.set(0, 0, 280);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 120;
controls.maxDistance = 500;
controls.enablePan = false;

scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(5, 3, 1);
scene.add(dir);

/* ---------- faint star field ---------- */

function addStarField({ count = 1800, radius = 1400, size = 1.1, opacity = 1.0 } = {}) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    positions[i * 3 + 0] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    size,
    sizeAttenuation: true,
    color: 0xffffff,
    transparent: true,
    opacity,
    depthWrite: false
  });
  scene.add(new THREE.Points(geom, mat));
}
addStarField();

/* ---------- globe ---------- */

const globe = new Globe()
  .globeImageUrl('//cdn.jsdelivr.net/npm/three-globe/example/img/earth-night.jpg')
  .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
  .showAtmosphere(true)
  .atmosphereColor('#88aaff')
  .atmosphereAltitude(0.15);

scene.add(globe);
globe.rotateY(-Math.PI * 0.4);

const GLOBE_R = typeof globe.getGlobeRadius === 'function'
  ? globe.getGlobeRadius()
  : 100;
const POINT_ALT = 0.025; // same altitude for click targets

// invisible sphere used to get lat/lng under cursor
const pickerSphere = new THREE.Mesh(
  new THREE.SphereGeometry(GLOBE_R, 64, 64),
  new THREE.MeshBasicMaterial({ visible: false })
);
globe.add(pickerSphere);

/* ---------- marker textures (ring + inner disc) ---------- */

const markerTextures = {};         // { normal: Texture, fav: Texture }
const cityMarkers = new Map();     // key -> THREE.Sprite

const NORMAL_COLOR = '#ffd977';    // yellow
const FAV_COLOR    = '#eb2020ff';  // red

// base scale for city markers (we animate up to this size)
const CITY_MARKER_BASE_SCALE = GLOBE_R * 0.012;

function makeRingTexture(colorHex) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;

  const outerR = size * 0.48; // outer edge
  const ringInnerR = size * 0.34; // inner edge of ring
  const innerR = size * 0.22; // inner solid disc

  ctx.clearRect(0, 0, size, size);

  // outer filled circle
  ctx.fillStyle = colorHex;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fill();

  // punch out inner area to create ring gap
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx, cy, ringInnerR, 0, Math.PI * 2);
  ctx.fill();

  // reset and draw center disc with same color
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = colorHex;
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function getMarkerTexture(kind) {
  if (markerTextures[kind]) return markerTextures[kind];
  const color = kind === 'fav' ? FAV_COLOR : NORMAL_COLOR;
  markerTextures[kind] = makeRingTexture(color);
  return markerTextures[kind];
}

function createCityMarkerSprite(city) {
  const kind = isFavorite(city) ? 'fav' : 'normal';
  const tex = getMarkerTexture(kind);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: true
  });
  const sprite = new THREE.Sprite(mat);
  sprite.userData.city = city;
  sprite.userData.baseScale = CITY_MARKER_BASE_SCALE;

  // Start hidden: scale 0 + visible = false; they will pop in when country is selected
  sprite.scale.set(0, 0, 1);
  sprite.visible = false;

  return sprite;
}

function updateCityMarker(city) {
  const key = makeCityKey(city);
  const sprite = cityMarkers.get(key);
  if (!sprite) return;
  const kind = isFavorite(city) ? 'fav' : 'normal';
  sprite.material.map = getMarkerTexture(kind);
  sprite.material.needsUpdate = true;
}

/* ---------- inject extra CSS for panel text, tags, photos & country view ---------- */

function ensurePanelExtraStyles() {
  if (document.getElementById('panel-extra-styles')) return;
  const style = document.createElement('style');
  style.id = 'panel-extra-styles';
  style.textContent = `
    .panel-text {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      font-size: 14px;
      line-height: 1.5;
    }
    .panel-text p {
      margin: 0 0 0.4rem;
      word-break: break-word;
      overflow-wrap: break-word;
    }
    .panel-section-title {
      margin: 0.8rem 0 0.35rem;
      font-size: 15px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      opacity: 0.9;
    }
    .panel-experiences {
      list-style: none;
      padding: 0;
      margin: 0 0 0.5rem;
    }
    .panel-experiences li {
      margin-bottom: 0.45rem;
    }
    .panel-experiences .exp-title {
      font-weight: 500;
      margin-bottom: 2px;
    }
    .panel-experiences .exp-desc {
      font-size: 13px;
      opacity: 0.85;
    }

    .tag-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0.6rem 0 0.4rem;
    }
    .tag-pill {
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, 0.6);
      background: rgba(15, 23, 42, 0.9);
      color: #e5e7eb;
      font-size: 11px;
      padding: 3px 9px;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .tag-pill.active {
      background: rgba(37, 99, 235, 0.9);
      border-color: rgba(191, 219, 254, 0.9);
    }

    .panel-header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .fav-btn {
      border: 0;
      padding: 6px 10px;
      border-radius: 999px;
      cursor: pointer;
      font-size: 12px;
      background: rgba(15,23,42,0.9);
      color: #e5e7eb;
      border: 1px solid rgba(148,163,184,0.75);
    }
    .fav-btn.fav-on {
      background: #facc15;
      color: #1f2937;
      border-color: #facc15;
    }

    /* trip planner toggle button in panel header (city view) */
    .trip-btn {
      border: 0;
      padding: 6px 10px;
      border-radius: 999px;
      cursor: pointer;
      font-size: 12px;
      background: rgba(15,23,42,0.9);
      color: #e5e7eb;
      border: 1px solid rgba(59,130,246,0.85);
    }
    .trip-btn.in-trip {
      background: rgba(34,197,94,0.18);
      color: #bbf7d0;
      border-color: rgba(34,197,94,0.9);
    }

    .panel-photos {
      display: grid;
      grid-template-columns: 1fr;
      gap: 4px;
      margin-top: 4px;
    }
    .panel-photo {
      position: relative;
      padding-top: 60%;
      overflow: hidden;
      border-radius: 4px;
      background: #020617;
    }
    .panel-photo img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      filter: brightness(1.05);
      transition: transform 0.25s ease, filter 0.25s ease;
    }
    .panel-photo img:hover {
      transform: scale(1.04);
      filter: brightness(1.2);
    }

    /* inline styles for the weather block inside the city panel */
    .weather-block {
      margin: 0.5rem 0 0.2rem;
      padding: 0.45rem 0.6rem;
      border-radius: 8px;
      border: 1px solid rgba(148, 163, 184, 0.55);
      background: radial-gradient(circle at top left, rgba(37, 99, 235, 0.25), rgba(15, 23, 42, 0.95));
      font-size: 12px;
    }
    .weather-label {
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 10px;
      opacity: 0.8;
      margin-bottom: 2px;
    }
    .weather-main {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .weather-icon {
      width: 28px;
      height: 28px;
      flex-shrink: 0;
    }
    .weather-icon img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .weather-body {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: baseline;
    }
    .weather-temp {
      font-size: 15px;
      font-weight: 600;
    }
    .weather-desc {
      opacity: 0.9;
    }
    .weather-meta {
      font-size: 11px;
      opacity: 0.8;
    }

    /* Country view: list of cities inside a country */
    .country-city-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0.4rem 0 0.2rem;
      padding: 0;
      list-style: none;
    }
    .country-city-btn {
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,0.7);
      background: rgba(15,23,42,0.95);
      color: #e5e7eb;
      font-size: 12px;
      padding: 4px 10px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .country-city-btn:hover {
      background: rgba(37, 99, 235, 0.9);
      border-color: rgba(191, 219, 254, 0.95);
    }
    .country-city-badge {
      font-size: 10px;
      opacity: 0.8;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
  `;
  document.head.appendChild(style);
}

/* ---------- panel content renderer (depends on currentTag) ---------- */

function renderCityContent(city) {
  const container = panelInnerEl.querySelector('#panel-content');
  if (!container) return;

  const media = CITY_MEDIA[city.name] || { experiences: [], photos: [] };
  const tag = currentTag;

  const experiences = media.experiences.filter(exp =>
    tag === 'all' || exp.tags?.includes(tag)
  );
  const photos = media.photos.filter(photo =>
    tag === 'all' || photo.tags?.includes(tag)
  );

  let html = '';

  if (experiences.length) {
    html += `
      <h3 class="panel-section-title">Things to do</h3>
      <ul class="panel-experiences">
        ${experiences.map(exp => `
          <li>
            <div class="exp-title">${exp.title}</div>
            ${exp.description ? `<div class="exp-desc">${exp.description}</div>` : ''}
          </li>
        `).join('')}
      </ul>
    `;
  }

  if (photos.length) {
    html += `
      <h3 class="panel-section-title">City snapshots</h3>
      <div class="panel-photos">
        ${photos.map(
          p => `
            <figure class="panel-photo">
              <img
                src="${p.url}"
                loading="lazy"
                decoding="async"
                alt="${city.name} photo"
              />
            </figure>
          `
        ).join('')}
      </div>
    `;
  }

  if (!html) {
    html = `<p>No content for this filter yet.</p>`;
  }

  container.innerHTML = html;
}

// fetch + inject current weather into the open panel for this city
async function fetchAndRenderWeather(city) {
  const block = panelInnerEl.querySelector('#weather-block');
  if (!block) return;

  const bodyEl = block.querySelector('.weather-body');
  const iconEl = block.querySelector('.weather-icon');
  if (!bodyEl) return;

  // Reset state for this city
  bodyEl.textContent = 'Loading...';
  if (iconEl) iconEl.innerHTML = '';

  // If coordinates are missing, fail gracefully without breaking the panel
  if (typeof city.lat !== 'number' || typeof city.lng !== 'number') {
    bodyEl.textContent = 'No coordinates for weather.';
    return;
  }

  try {
    const data = await loadWeather(city.lat, city.lng);

    if (!data) {
      bodyEl.textContent = 'No weather data available.';
      if (iconEl) iconEl.innerHTML = '';
      return;
    }

    const parts = [];

    if (typeof data.tempC === 'number') {
      parts.push(`<span class="weather-temp">${Math.round(data.tempC)}°C</span>`);
    }

    let descText = null;
    if (data.description) {
      descText =
        data.description.charAt(0).toUpperCase() + data.description.slice(1);
      parts.push(`<span class="weather-desc">${descText}</span>`);
    }

    const meta = [];
    if (typeof data.feelsLikeC === 'number') {
      meta.push(`feels like ${Math.round(data.feelsLikeC)}°C`);
    }
    if (data.location && data.location !== city.name) {
      meta.push(`near ${data.location}`);
    }

    if (meta.length) {
      parts.push(`<span class="weather-meta">${meta.join(' · ')}</span>`);
    }

    // Set icon if available
    if (iconEl) {
      if (data.icon) {
        const iconUrl = `https://openweathermap.org/img/wn/${encodeURIComponent(
          data.icon
        )}@2x.png`;
        const alt = descText || 'Weather icon';
        iconEl.innerHTML = `
          <img
            src="${iconUrl}"
            alt="${alt}"
            loading="lazy"
            decoding="async"
          />
        `;
      } else {
        iconEl.innerHTML = '';
      }
    }

    if (!parts.length) {
      bodyEl.textContent = 'No weather data available.';
    } else {
      bodyEl.innerHTML = parts.join(' ');
    }
  } catch (e) {
    console.error('Weather error', e);
    bodyEl.textContent = 'Weather currently unavailable.';
    if (iconEl) iconEl.innerHTML = '';
  }
}

/* ---------- CITY PANEL (unchanged behaviour, just renamed mentally) ---------- */

function openCityPanel(city) {
  ensurePanelExtraStyles();
  currentTag = 'all'; // reset to all whenever you open a city

  const fav = isFavorite(city);
  const inTrip = cityInTrip(city); // current trip membership state

  panelInnerEl.innerHTML = `
    <div class="panel-header">
      <div>
        <h2 class="panel-title">${city.name}, ${city.country}</h2>
        <p class="muted">Population ${city.pop ?? ''}</p>
      </div>
      <div class="panel-header-actions">
        <button
          class="fav-btn ${fav ? 'fav-on' : ''}"
          id="fav-btn"
          type="button"
          aria-pressed="${fav}"
        >
          ${fav ? '★ Saved' : '☆ Save'}
        </button>
        <!-- trip planner toggle button in the panel header -->
        <button
          class="trip-btn ${inTrip ? 'in-trip' : ''}"
          id="trip-btn"
          type="button"
          aria-pressed="${inTrip}"
        >
          ${inTrip ? '✓ In trip' : '+ Add to trip'}
        </button>
        <button class="close-btn" id="close-btn" type="button">Close</button>
      </div>
    </div>
    <div class="panel-text">
      <p>${city.name} is a great starting point for exploring ${city.country}.</p>

      <!-- inline weather block; text is filled by fetchAndRenderWeather(city) -->
      <div id="weather-block" class="weather-block">
        <div class="weather-label">Current weather</div>
        <div class="weather-main">
          <div class="weather-icon" aria-hidden="true"></div>
          <div class="weather-body">Loading...</div>
        </div>
      </div>

      <div class="tag-row">
        ${TAG_DEFS.map(t => `
          <button
            class="tag-pill ${t.id === currentTag ? 'active' : ''}"
            data-tag="${t.id}"
            type="button"
          >
            ${t.label}
          </button>
        `).join('')}
      </div>

      <div id="panel-content"></div>
    </div>
  `;

  panelEl.classList.add('open');

  // kick off weather fetch (non-blocking)
  fetchAndRenderWeather(city);

  // close
  document
    .getElementById('close-btn')
    ?.addEventListener('click', () => panelEl.classList.remove('open'), {
      once: true
    });

  // favorites toggle
  const favBtn = document.getElementById('fav-btn');
  if (favBtn) {
    favBtn.addEventListener('click', () => {
      const key = makeCityKey(city);
      if (favoriteCities.has(key)) {
        favoriteCities.delete(key);
      } else {
        favoriteCities.add(key);
      }
      saveFavoriteSet();
      const nowFav = favoriteCities.has(key);
      favBtn.classList.toggle('fav-on', nowFav);
      favBtn.textContent = nowFav ? '★ Saved' : '☆ Save';
      favBtn.setAttribute('aria-pressed', nowFav ? 'true' : 'false');

      // update marker color (yellow ↔ red)
      updateCityMarker(city);
      // refresh favorites bar under search
      renderFavoriteBar();
    });
  }

  // trip planner toggle from the panel
  const tripBtn = document.getElementById('trip-btn');
  if (tripBtn) {
    tripBtn.addEventListener('click', () => {
      // use existing logic so arcs + tray stay in sync
      toggleCityInTrip(city);

      const nowInTrip = cityInTrip(city);
      tripBtn.classList.toggle('in-trip', nowInTrip);
      tripBtn.textContent = nowInTrip ? '✓ In trip' : '+ Add to trip';
      tripBtn.setAttribute('aria-pressed', nowInTrip ? 'true' : 'false');
    });
  }

  // tags click → switch filter + re-render content
  const tagRowEl = panelInnerEl.querySelector('.tag-row');
  if (tagRowEl) {
    tagRowEl.addEventListener('click', e => {
      const btn = e.target.closest('.tag-pill');
      if (!btn) return;
      const tagId = btn.getAttribute('data-tag') || 'all';
      currentTag = tagId;
      tagRowEl.querySelectorAll('.tag-pill').forEach(b => {
        b.classList.toggle('active', b === btn);
      });
      renderCityContent(city);
    });
  }

  // initial render (All)
  renderCityContent(city);
}

/* ---------- COUNTRY PANEL (NEW) ---------- */

function openCountryPanel(countryFeature) {
  ensurePanelExtraStyles();
  currentTag = 'all';

  const countryName = countryFeature.properties?.name || 'Country';
  const info = COUNTRY_INFO[countryName] || {
    summary: `${countryName} is one of the prototype countries in this globe.`
  };

  const citiesInCountry = allCities.filter(c => c.country === countryName);

  panelInnerEl.innerHTML = `
    <div class="panel-header">
      <div>
        <h2 class="panel-title">${countryName}</h2>
        <p class="muted">Prototype country in this Travel Globe.</p>
      </div>
      <div class="panel-header-actions">
        <button class="close-btn" id="close-btn" type="button">Close</button>
      </div>
    </div>
    <div class="panel-text">
      <p>${info.summary}</p>

      ${
        citiesInCountry.length
          ? `
            <h3 class="panel-section-title">Cities in ${countryName}</h3>
            <ul class="country-city-list">
              ${citiesInCountry.map(c => `
                <li>
                  <button
                    class="country-city-btn"
                    data-city="${c.name}"
                    data-country="${c.country}"
                    type="button"
                  >
                    <span>${c.name}</span>
                    <span class="country-city-badge">Open city</span>
                  </button>
                </li>
              `).join('')}
            </ul>
          `
          : `<p>No cities configured for this country yet.</p>`
      }
    </div>
  `;

  panelEl.classList.add('open');

  document
    .getElementById('close-btn')
    ?.addEventListener('click', () => panelEl.classList.remove('open'), {
      once: true
    });

  // Wire up "Open city" buttons
  const listEl = panelInnerEl.querySelector('.country-city-list');
  if (listEl) {
    listEl.addEventListener('click', ev => {
      const btn = ev.target.closest('.country-city-btn');
      if (!btn) return;
      const name = btn.getAttribute('data-city');
      const country = btn.getAttribute('data-country');
      const city = allCities.find(
        c => c.name === name && c.country === country
      );
      if (city) {
        startFlyToCity(city);
      }
    });
  }
}

/* ---------- sizing ---------- */

function syncSize() {
  const w = appEl.clientWidth;
  const h = appEl.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(syncSize).observe(appEl);
window.addEventListener('resize', syncSize);
syncSize();

/* ---------- COUNTRY LAYER: 4 countries, outline + label ON HOVER/ACTIVE ---------- */

const KEEP_IDS = new Set([372, 300, 208, 191]); // Ireland, Greece, Denmark, Croatia

let countryFeatures = [];
let hoverCountry = null;
let activeCountry = null; // NEW: the country we have "opened"

function updateCountryStyles() {
  if (!countryFeatures.length) return;
  globe
    .polygonAltitude(d =>
      d === hoverCountry || d === activeCountry ? 0.02 : 0.01
    )
    .polygonCapColor(d => {
      if (d === activeCountry) return 'rgba(120,180,255,0.32)';
      return d === hoverCountry ? 'rgba(90,140,230,0.24)' : 'rgba(80,120,200,0.18)';
    })
    .polygonSideColor(() => 'rgba(100,150,255,0.22)')
    .polygonStrokeColor(d => {
      if (d === activeCountry) return 'rgba(255,255,255,0.95)';
      return d === hoverCountry
        ? 'rgba(220,235,255,0.9)'
        : 'rgba(180,200,255,0.45)';
    });
}

function setupCountries(geoFeatures) {
  countryFeatures = geoFeatures.filter(f => KEEP_IDS.has(Number(f.id)));
  globe.polygonsData(countryFeatures);
  if (typeof globe.polygonsTransitionDuration === 'function') {
    globe.polygonsTransitionDuration(0);
  }
  updateCountryStyles();
}

/* ---------- GeoJSON point-in-polygon to detect hovered country ---------- */

function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];   // [lon, lat]
    const [xj, yj] = ring[j];
    const intersect =
      ((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function polygonContains(rings, lat, lng) {
  if (!rings.length) return false;
  if (!pointInRing(lng, lat, rings[0])) return false; // outer ring
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lng, lat, rings[i])) return false; // holes
  }
  return true;
}

function countryContainsLatLng(feature, lat, lng) {
  const geom = feature.geometry;
  if (!geom) return false;
  const coords = geom.coordinates;
  if (geom.type === 'Polygon') {
    return polygonContains(coords, lat, lng);
  }
  if (geom.type === 'MultiPolygon') {
    return coords.some(rings => polygonContains(rings, lat, lng));
  }
  return false;
}

function pickCountryFromLatLng(lat, lng) {
  if (!countryFeatures.length) return null;
  for (const feat of countryFeatures) {
    if (countryContainsLatLng(feat, lat, lng)) return feat;
  }
  return null;
}

/* ---------- tooltip ---------- */

function showCountryTooltip(country, clientX, clientY) {
  if (!tooltipEl) return;
  if (!country) {
    tooltipEl.classList.remove('show');
    return;
  }
  const name = country.properties?.name || '';
  tooltipEl.textContent = name;
  tooltipEl.style.left = `${clientX}px`;
  tooltipEl.style.top = `${clientY}px`;
  tooltipEl.classList.add('show');
}

/* ---------- CLICK TARGETS + VISIBLE CITY MARKERS ---------- */

const hitGeometry = new THREE.SphereGeometry(GLOBE_R * 0.012, 16, 16);
const hitMaterial = new THREE.MeshBasicMaterial({
  color: 0xffff66,
  wireframe: true,
  transparent: true,
  opacity: 0.35,
  visible: false // press "h" to toggle if you ever want debug
});
const clickTargets = [];

function setupClickTargets(cities) {
  clickTargets.length = 0;
  cityMarkers.clear();

  globe
    .objectsData(cities)
    .objectLat('lat')
    .objectLng('lng')
    .objectAltitude(POINT_ALT)
    .objectThreeObject(d => {
      const group = new THREE.Group();

      // invisible hit sphere for raycasting
      const hit = new THREE.Mesh(hitGeometry, hitMaterial);
      hit.userData.city = d;
      group.add(hit);
      clickTargets.push(hit);

      // visible marker sprite (ring + disc)
      const sprite = createCityMarkerSprite(d);
      group.add(sprite);
      cityMarkers.set(makeCityKey(d), sprite);

      group.userData.city = d;
      return group;
    });

  // soft country-first: hide all markers until a country is selected
  updateCityMarkersVisibility();
}

/* ---------- world → lat/lng ---------- */

function worldToLatLng(world) {
  const local = world.clone();
  globe.worldToLocal(local);

  if (typeof globe.toGeoCoords === 'function') {
    const { lat, lng } = globe.toGeoCoords({
      x: local.x,
      y: local.y,
      z: local.z
    });
    return { lat, lng };
  }

  const x = local.x, y = local.y, z = local.z;
  const r = Math.sqrt(x * x + y * y + z * z);
  const lat = THREE.MathUtils.radToDeg(Math.asin(y / r));
  const lon = THREE.MathUtils.radToDeg(Math.atan2(z, -x)); // note -x
  return { lat, lng: lon };
}

/* ---------- Trip plan state & helpers ---------- */

const tripPlan = []; // array of city objects, in order of selection

// helper to check if a city is currently in the trip
function cityInTrip(city) {
  const key = makeCityKey(city);
  return tripPlan.some(c => makeCityKey(c) === key);
}

function toggleCityInTrip(city) {
  const key = makeCityKey(city);
  const idx = tripPlan.findIndex(c => makeCityKey(c) === key);
  if (idx === -1) {
    tripPlan.push(city);
  } else {
    tripPlan.splice(idx, 1);
  }
  recomputeTripUIAndArcs();
}

function deg2rad(d) {
  return d * Math.PI / 180;
}

function distanceKm(a, b) {
  const R = 6371; // Earth radius in km
  const dLat = deg2rad(b.lat - a.lat);
  const dLon = deg2rad(b.lng - a.lng);
  const lat1 = deg2rad(a.lat);
  const lat2 = deg2rad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const x =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

function formatHours(hours) {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h <= 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function recomputeTripStats() {
  if (!tripStatsEl) return;

  if (tripPlan.length === 0) {
    tripStatsEl.textContent = 'Click a city to start a trip.';
    return;
  }

  if (tripPlan.length === 1) {
    tripStatsEl.textContent = 'Select another city to see route.';
    return;
  }

  let totalKm = 0;
  for (let i = 0; i < tripPlan.length - 1; i++) {
    totalKm += distanceKm(tripPlan[i], tripPlan[i + 1]);
  }

  const legs = tripPlan.length - 1;
  const cruiseSpeed = 800; // km/h
  const layoverHours = 0.6; // rough overhead per leg
  const flightHours = totalKm / cruiseSpeed + legs * layoverHours;

  tripStatsEl.textContent =
    `${tripPlan.length} stops · ${totalKm.toFixed(0)} km · ~${formatHours(flightHours)}`;
}

function recomputeTripArcs() {
  if (tripPlan.length < 2) {
    globe.arcsData([]);
    return;
  }

  const arcs = [];
  for (let i = 0; i < tripPlan.length - 1; i++) {
    const a = tripPlan[i];
    const b = tripPlan[i + 1];
    arcs.push({
      startLat: a.lat,
      startLng: a.lng,
      endLat: b.lat,
      endLng: b.lng,
      color: ['rgba(255,220,120,0.95)', 'rgba(248,113,113,0.98)']
    });
  }

  globe
    .arcsData(arcs)
    .arcStartLat('startLat')
    .arcStartLng('startLng')
    .arcEndLat('endLat')
    .arcEndLng('endLng')
    .arcColor('color')
    .arcAltitude(0.15)
    .arcStroke(0.45)
    .arcDashLength(0.7)
    .arcDashGap(0.15)
    .arcDashAnimateTime(1300);
}

function renderTripList() {
  if (!tripStopsEl) return;
  tripStopsEl.innerHTML = '';

  tripPlan.forEach((city, idx) => {
    const li = document.createElement('li');
    li.className = 'trip-stop';
    li.dataset.key = makeCityKey(city);
    li.innerHTML = `
      <span class="trip-index">${idx + 1}</span>
      <div class="trip-main">
        <span class="city">${city.name}</span>
        <span class="country">${city.country}</span>
      </div>
      <button class="trip-remove" type="button" title="Remove">×</button>
    `;
    tripStopsEl.appendChild(li);
  });
}

function recomputeTripUIAndArcs() {
  if (!tripTrayEl) return;

  if (tripPlan.length === 0) {
    tripTrayEl.classList.remove('open');
    if (tripStopsEl) tripStopsEl.innerHTML = '';
    globe.arcsData([]);
    recomputeTripStats();
    return;
  }

  renderTripList();
  recomputeTripStats();
  recomputeTripArcs();
  tripTrayEl.classList.add('open');
}

// Trip tray interactions
if (tripClearBtn) {
  tripClearBtn.addEventListener('click', () => {
    tripPlan.length = 0;
    recomputeTripUIAndArcs();
  });
}

if (tripStopsEl) {
  tripStopsEl.addEventListener('click', ev => {
    const li = ev.target.closest('li.trip-stop');
    if (!li) return;
    const key = li.dataset.key;
    const idx = tripPlan.findIndex(c => makeCityKey(c) === key);
    if (idx === -1) return;

    const city = tripPlan[idx];

    // remove button
    if (ev.target.closest('.trip-remove')) {
      tripPlan.splice(idx, 1);
      recomputeTripUIAndArcs();
      return;
    }

    // click pill itself → fly to city + open city panel
    const mesh = findCityMesh(city);
    if (mesh) startFlyToCityMesh(mesh);
    openCityPanel(city);
  });
}

/* ---------- smooth fly-to camera animation ---------- */

let flyState = null;

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// NEW: a "back" easing that overshoots a bit before settling
function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function startFlyToCityMesh(mesh) {
  const cityWorld = mesh.getWorldPosition(new THREE.Vector3());
  const dir = cityWorld.clone().normalize();

  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();

  const radius = camera.position.length();
  const endPos = dir.multiplyScalar(radius * 0.5); // slight zoom-in
  const endTarget = new THREE.Vector3(0, 0, 0);

  flyState = {
    startPos,
    startTarget,
    endPos,
    endTarget,
    startTime: performance.now(),
    duration: 1200
  };

  controls.enabled = false;
}

// NEW: fly to a country center (we approximate using that country’s first city)
function startFlyToCountry(countryFeature) {
  const countryName = countryFeature.properties?.name;
  const city = allCities.find(c => c.country === countryName);
  if (!city) return;

  const mesh = findCityMesh(city);
  if (mesh) {
    startFlyToCityMesh(mesh);
  }
}

function updateFly() {
  if (!flyState) return;
  const now = performance.now();
  const t = (now - flyState.startTime) / flyState.duration;
  const k = t >= 1 ? 1 : easeInOutCubic(Math.min(Math.max(t, 0), 1));

  const curPos = flyState.startPos.clone().lerp(flyState.endPos, k);
  const curTarget = flyState.startTarget.clone().lerp(flyState.endTarget, k);

  camera.position.copy(curPos);
  controls.target.copy(curTarget);

  if (t >= 1) {
    flyState = null;
    controls.enabled = true;
  }
}

/* ---------- search helpers ---------- */

let searchIndex = [];

function buildSearchIndex(cities) {
  return cities.map(c => ({
    key: `${c.name}, ${c.country}`,
    city: c
  }));
}

function findCityMesh(city) {
  return (
    clickTargets.find(m => {
      const c = m.userData.city;
      return c && c.name === city.name && c.country === city.country;
    }) || null
  );
}

// Helper: find country feature for a given city
function findCountryFeatureForCity(city) {
  if (!countryFeatures.length) return null;
  return countryFeatures.find(
    f => f.properties?.name === city.country
  ) || null;
}

// Helper: set active country based on a city (used for search/favs)
function setActiveCountryForCity(city) {
  const feat = findCountryFeatureForCity(city);
  if (!feat) return;
  activeCountry = feat;
  updateCountryStyles();
  revealCountryCitiesWithAnimation(feat);
}

function startFlyToCity(city) {
  // soft country-first: when we go straight to a city (search/fav),
  // set its country active and reveal its markers.
  setActiveCountryForCity(city);

  const mesh = findCityMesh(city);
  if (mesh) {
    openCityPanel(city);
    startFlyToCityMesh(mesh);
  } else {
    openCityPanel(city);
  }
}

function refreshSearchResults(query) {
  if (!searchInput || !searchList) return;
  const q = query.trim().toLowerCase();
  if (!q) {
    searchList.innerHTML = '';
    searchList.classList.remove('open');
    return;
  }
  const matches = searchIndex
    .filter(item => item.key.toLowerCase().includes(q))
    .slice(0, 8);

  if (!matches.length) {
    searchList.innerHTML = '';
    searchList.classList.remove('open');
    return;
  }

  searchList.innerHTML = matches.map(item => `
    <li data-key="${item.key}">
      <span class="city">${item.city.name}</span>
      <span class="country">${item.city.country}</span>
    </li>
  `).join('');
  searchList.classList.add('open');
}

function wireSearch(cities) {
  if (!searchInput || !searchList) return;
  searchIndex = buildSearchIndex(cities);

  searchInput.addEventListener('input', e => {
    refreshSearchResults(e.target.value || '');
  });

  searchInput.addEventListener('focus', e => {
    if (e.target.value) refreshSearchResults(e.target.value);
  });

  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      searchList.classList.remove('open');
      searchList.innerHTML = '';
    }
  });

  searchList.addEventListener('click', e => {
    const li = e.target.closest('li');
    if (!li) return;
    const key = li.getAttribute('data-key');
    const match = searchIndex.find(i => i.key === key);
    if (!match) return;

    searchList.classList.remove('open');
    searchList.innerHTML = '';
    searchInput.blur();
    startFlyToCity(match.city);
  });
}

/* ---------- CITY MARKER VISIBILITY + POP-IN ANIMATION ---------- */

// Map of cityKey -> { start: number, duration: number }
const cityAppearAnimations = new Map();

function startCityMarkerAppear(city, delayMs = 0) {
  const key = makeCityKey(city);
  const sprite = cityMarkers.get(key);
  if (!sprite) return;
  const baseScale = sprite.userData.baseScale || CITY_MARKER_BASE_SCALE;

  sprite.visible = true;
  // start tiny; we'll grow it
  sprite.scale.set(0, 0, 1);

  cityAppearAnimations.set(key, {
    start: performance.now(),
    duration: 15000,
    baseScale,
    delay: delayMs
  });
}


// Hide markers for all other countries; pop in markers for the selected country
function revealCountryCitiesWithAnimation(countryFeature) {
  const countryName = countryFeature.properties?.name;
  if (!countryName) return;

  const citiesInCountry = allCities.filter(c => c.country === countryName);

  // Hide all markers & stop animations for cities not in this country
  for (const [key, sprite] of cityMarkers.entries()) {
    const city = sprite.userData.city;
    const inCountry = city && city.country === countryName;
    if (!inCountry) {
      sprite.visible = false;
      cityAppearAnimations.delete(key);
    }
  }

  // For markers in this country:
  citiesInCountry.forEach((city, idx) => {
    const key = makeCityKey(city);
    const sprite = cityMarkers.get(key);
    if (!sprite) return;

    const baseScale = sprite.userData.baseScale || CITY_MARKER_BASE_SCALE;

    // 🔑 If the marker is already visible, don't restart the pop-in animation
    if (sprite.visible) {
      // Just ensure it's at its final scale and not in the animation map
      sprite.scale.set(baseScale, baseScale, 1);
      cityAppearAnimations.delete(key);
      return;
    }

    // Otherwise, this is the first time showing it → animate with a staggered delay
    const baseDelay = 80;              // ms between dots
    const jitter = Math.random() * 60; // small randomness so it's not too rigid
    const delayMs = idx * baseDelay + jitter;
    startCityMarkerAppear(city, delayMs);
  });
}


// When we change activeCountry, call this if we just want visibility update
function updateCityMarkersVisibility() {
  if (!activeCountry) {
    // No active country → nothing visible (soft country-first)
    for (const sprite of cityMarkers.values()) {
      sprite.visible = false;
    }
    return;
  }
  revealCountryCitiesWithAnimation(activeCountry);
}

function updateCityAppearAnimations() {
  if (!cityAppearAnimations.size) return;
  const now = performance.now();

  for (const [key, anim] of cityAppearAnimations.entries()) {
    const sprite = cityMarkers.get(key);
    if (!sprite) {
      cityAppearAnimations.delete(key);
      continue;
    }

    const delay = anim.delay || 0;
    const elapsed = now - anim.start - delay;

    // Not started yet → keep it invisible/tiny
    if (elapsed <= 0) {
      sprite.scale.set(0, 0, 1);
      continue;
    }

    const tRaw = elapsed / anim.duration;
    const t = Math.min(1, Math.max(0, tRaw));

    // Use our "back" easing for a little overshoot
    const eased = easeOutBack(t);
    // Keep a minimum size so it doesn't feel too tiny at start
    const factor = 0.2 + 0.8 * eased; // 0.2 → ~1.16 → 1.0

    const s = anim.baseScale * factor;
    sprite.scale.set(s, s, 1);

    if (t >= 1) {
      cityAppearAnimations.delete(key);
      sprite.scale.set(anim.baseScale, anim.baseScale, 1);
    }
  }
}


/* ---------- picking ---------- */

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function setFromEvent(ev) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
}

// Handle click: prefer city if we clicked a marker; otherwise treat as country click
renderer.domElement.addEventListener('click', ev => {
  setFromEvent(ev);

  // 1) Check if we hit a city click target
  const hitCity = raycaster.intersectObjects(clickTargets, true)[0];
  const city = hitCity?.object?.userData?.city;
  if (city) {
    // Soft country-first: clicking a city dot is allowed, but
    // sets its country active & reveals markers.
    setActiveCountryForCity(city);
    startFlyToCity(city);
    return;
  }

  // 2) Otherwise, see if we clicked on the globe sphere → country
  const hitSphere = raycaster.intersectObject(pickerSphere, true)[0];
  if (!hitSphere) return;

  const { lat, lng } = worldToLatLng(hitSphere.point);
  const country = pickCountryFromLatLng(lat, lng);
  if (!country) return;

  // Set active country, fly to it, show its panel and reveal markers
  activeCountry = country;
  updateCountryStyles();
  revealCountryCitiesWithAnimation(country);
  startFlyToCountry(country);
  openCountryPanel(country);
});

// pointer move: city hover cursor + country hover label
renderer.domElement.addEventListener('pointermove', ev => {
  setFromEvent(ev);

  // 1) city hover for cursor
  const hitCity = raycaster.intersectObjects(clickTargets, true)[0];
  renderer.domElement.style.cursor = hitCity ? 'pointer' : 'grab';

  // 2) country hover for tooltip
  const hitSphere = raycaster.intersectObject(pickerSphere, true)[0];
  if (!hitSphere) {
    if (hoverCountry) {
      hoverCountry = null;
      updateCountryStyles();
      showCountryTooltip(null);
    }
    return;
  }

  const { lat, lng } = worldToLatLng(hitSphere.point);
  const newHover = pickCountryFromLatLng(lat, lng);

  if (newHover !== hoverCountry) {
    hoverCountry = newHover;
    updateCountryStyles();
  }
  showCountryTooltip(newHover, ev.clientX, ev.clientY);
});

renderer.domElement.addEventListener('mouseleave', () => {
  hoverCountry = null;
  updateCountryStyles();
  showCountryTooltip(null);
});

/* ---------- boot ---------- */

(async function boot() {
  try {
    const cities = await loadCities();
    allCities = cities;

    const topo = await fetch(
      'https://unpkg.com/world-atlas@2/countries-110m.json'
    ).then(r => r.json());
    const world = feature(topo, topo.objects.countries);

    setupCountries(world.features); // only 4 countries, outlined
    setupClickTargets(cities);      // markers + click meshes (initially hidden)
    wireSearch(cities);             // search

    // preload city images in the background
    if ('requestIdleCallback' in window) {
      requestIdleCallback(preloadCityImages);
    } else {
      setTimeout(preloadCityImages, 0);
    }

    // initialise trip tray message
    recomputeTripUIAndArcs();

    // initial favorites bar from localStorage
    renderFavoriteBar();

    function tick() {
      requestAnimationFrame(tick);
      updateFly();
      updateCityAppearAnimations(); // NEW: animate city markers popping in
      controls.update();
      renderer.render(scene, camera);
    }
    tick();
  } catch (e) {
    if (!fatalEl?.classList.contains('show')) fatal(e);
  }
})();
