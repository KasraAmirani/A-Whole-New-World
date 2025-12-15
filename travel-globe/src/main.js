// src/main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Globe from 'three-globe';
import { feature } from 'topojson-client';
import { loadCities, loadWeather } from './api.js'; // /api/cities + /api/weather
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

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

/* ---------- global overlays (instructions + loading) ---------- */

function ensureGlobalOverlays() {
  if (document.getElementById('global-overlay-styles')) return;

  const style = document.createElement('style');
  style.id = 'global-overlay-styles';
  style.textContent = `
    #globe-instructions {
      position: fixed;
      left: 16px;
      bottom: 12px;
      padding: 6px 12px;
      border-radius: 999px;
      background: rgba(11, 29, 74, 0.941);
      border: 1px solid rgba(148, 163, 184, 0.7);
      color: #e5e7eb;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
                   Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      pointer-events: none;
      z-index: 40;
      backdrop-filter: blur(10px);
      opacity: 0.9;
      white-space: nowrap;
    }

    #loading-overlay {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at top, rgba(15,23,42,0.96), rgba(2,6,23,0.99));
      z-index: 50;
      transition: opacity 0.3s ease, visibility 0.3s ease;
    }
    #loading-overlay.hidden {
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
    }
    #loading-overlay .loading-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 40px;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
                   Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      color: #e5e7eb;
    }
    #loading-overlay .loading-label {
      opacity: 0.8;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      font-size: 11px;
    }

    /* CSS Loaders "l11" loader */
    .loader {
      width: 50px;
      aspect-ratio: 1;
      box-shadow: 0 0 0 3px #fff inset;
      border-radius: 50%;
      position: relative;
      animation: l11 7s infinite;
    }
    .loader:before,
    .loader:after {
      content: "";
      position: absolute;
      top: calc(100% + 3px);
      left: calc(50% - 12.5px);
      box-shadow: inherit;
      width: 25px;
      aspect-ratio: 1;
      border-radius: 50%;
      transform-origin: 50% -28px;
      animation: l11 1.5s infinite;
    }
    .loader:after {
      animation-delay: -0.75s;
    }
    @keyframes l11 {
      100% {
        transform: rotate(360deg);
      }
    }
          /* --- Start gate additions --- */
    #loading-overlay .hero {
      text-align: center;
      max-width: 520px;
      padding: 0 18px;
      line-height: 1.35;
    }

    #loading-overlay .hero .tagline {
      font-size: 14px;
      letter-spacing: 0.02em;
      opacity: 0.92;
    }

    #loading-overlay .hero .brand {
      display: inline-block;
      margin-left: 6px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    #start-btn {
      border: 1px solid rgba(148, 163, 184, 0.75);
      background: rgba(11, 29, 74, 0.92);
      color: #e5e7eb;
      padding: 10px 16px;
      border-radius: 999px;
      cursor: pointer;
      font: 12px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
            Roboto, Helvetica, Arial, sans-serif;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      box-shadow: 0 12px 30px rgba(0,0,0,0.35);
      backdrop-filter: blur(10px);
      transform: translateY(2px);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease, background 0.2s ease;
    }

    #start-btn:hover {
      background: rgba(37, 99, 235, 0.30);
      transform: translateY(0px);
    }

    /* When app is ready, hide loader + show start button */
    #loading-overlay.ready .loader,
    #loading-overlay.ready .loading-label {
      display: none;
    }

    #loading-overlay.ready #start-btn {
      opacity: 1;
      pointer-events: auto;
    }

  `;
  document.head.appendChild(style);

  const loading = document.createElement('div');
  loading.id = 'loading-overlay';
  loading.innerHTML = `
    <div class="loading-inner">
      <div class="loader"></div>
      <div class="loading-label">Loading…</div>

      <div class="hero">
        <div class="tagline">
          Start planning your vacation with
          <span class="brand">A Whole New World</span>
        </div>
      </div>

      <button id="start-btn" type="button" disabled>Start</button>
    </div>
  `;

  document.body.appendChild(loading);

  const instr = document.createElement('div');
  instr.id = 'globe-instructions';
  instr.textContent = 'Drag to rotate · Scroll to zoom';
  document.body.appendChild(instr);
}

ensureGlobalOverlays();
const loadingOverlayEl = document.getElementById('loading-overlay');
function showStartGate() {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;

  overlay.classList.add('ready');

  const btn = overlay.querySelector('#start-btn');
  if (!btn) return;

  btn.disabled = false;
  btn.focus();

  const enterApp = () => overlay.classList.add('hidden');

  btn.addEventListener('click', enterApp, { once: true });

  // Optional: Enter key starts too
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Enter' && overlay && !overlay.classList.contains('hidden')) {
        enterApp();
      }
    },
    { once: true }
  );
}


/* ---------- TAGS + CITY MEDIA ---------- */

const TAG_DEFS = [
  { id: 'all',       label: 'All' },
  { id: 'history',   label: 'History' },
  { id: 'food',      label: 'Food' },
  { id: 'nightlife', label: 'Nightlife' },
  { id: 'nature',    label: 'Nature' }
];


/* ---------- COUNTRY-LEVEL CITY FILTERS (VACATION TYPES) ---------- */

/**
 * These filters control which *city dots* appear for the selected country.
 * They are independent from TAG_DEFS, which filters content *within a city panel*.
 *
 * Backend returns `city.tags: string[]` (e.g. ['beach','food']).
 */
const COUNTRY_FILTER_DEFS = [
  { id: 'all',       label: 'All' },
  { id: 'beach',     label: 'Beach' },
  { id: 'nature',    label: 'Nature' },
  { id: 'culture',   label: 'Culture' },
  { id: 'adventure', label: 'Adventure' },
  { id: 'food',      label: 'Food' },
  { id: 'design',    label: 'Design' },
  { id: 'family',    label: 'Family' },
  { id: 'romantic',  label: 'Romantic' }
];

// active country-level filters (controls visible city markers)
let countryFilterCountry = null;        // string country name currently shown in the country panel
let activeCountryFilters = new Set();   // Set<tagId>, excluding 'all' (empty == all)

/**
 * Per-city travel content for this prototype.
 * Photos must match actual files in /public/images/cities/.
 */
const CITY_MEDIA = {
  // -------- IRELAND --------
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
  Cork: {
    experiences: [
      {
        title: 'English Market',
        tags: ['food'],
        description: 'Covered market with local produce, snacks and an easy first taste of the city.'
      },
      {
        title: 'Shandon bells',
        tags: ['history'],
        description: 'Climb the tower, ring the bells and get rooftop views over Cork.'
      }
    ],
    photos: []
  },
  Galway: {
    experiences: [
      {
        title: 'Latin Quarter walk',
        tags: ['nightlife', 'history'],
        description: 'Colourful streets, pubs and buskers between Eyre Square and the Spanish Arch.'
      },
      {
        title: 'Seafood by the quay',
        tags: ['food'],
        description: 'Casual places for fish and oysters looking out to the water.'
      }
    ],
    photos: []
  },

  // -------- GREECE --------
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
  Thessaloniki: {
    experiences: [
      {
        title: 'White Tower & waterfront',
        tags: ['history', 'nature'],
        description: 'Walk the promenade, visit the tower and watch the sunset over the bay.'
      },
      {
        title: 'Ladadika evenings',
        tags: ['food', 'nightlife'],
        description: 'Tavernas and meze spots in converted warehouses near the port.'
      }
    ],
    photos: []
  },
  Heraklion: {
    experiences: [
      {
        title: 'Knossos Palace',
        tags: ['history'],
        description: 'Minoan ruins just outside the city – easy half-day trip.'
      },
      {
        title: 'Cretan tavernas',
        tags: ['food'],
        description: 'Olive oil, herbs and simple local dishes in back-street spots.'
      }
    ],
    photos: []
  },

  // -------- DENMARK --------
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
  Aarhus: {
    experiences: [
      {
        title: 'Den Gamle By',
        tags: ['history'],
        description: 'Open-air museum with recreated streets from different eras.'
      },
      {
        title: 'Harbourfront',
        tags: ['food', 'nature'],
        description: 'Modern waterfront area with cafés, sea views and places to swim in summer.'
      }
    ],
    photos: []
  },
  Odense: {
    experiences: [
      {
        title: 'H. C. Andersen quarter',
        tags: ['history'],
        description: 'Museums and colourful old houses around the writer’s childhood streets.'
      },
      {
        title: 'River path cafés',
        tags: ['food', 'nature'],
        description: 'Easy walks and bike rides with relaxed stops by the water.'
      }
    ],
    photos: []
  },

  // -------- CROATIA --------
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
  },
  Split: {
    experiences: [
      {
        title: 'Diocletian’s Palace',
        tags: ['history'],
        description: 'Roman palace now filled with shops, cafés and apartments.'
      },
      {
        title: 'Riva promenade',
        tags: ['food', 'nightlife'],
        description: 'Palm-lined waterfront for slow walks, drinks and people-watching.'
      }
    ],
    photos: []
  },
  Dubrovnik: {
    experiences: [
      {
        title: 'City walls walk',
        tags: ['history', 'nature'],
        description: 'Loop around the fortifications for views of roofs, sea and cliffs.'
      },
      {
        title: 'Lokrum Island',
        tags: ['nature'],
        description: 'Quick boat ride to a quieter island with paths and swimming spots.'
      }
    ],
    photos: []
  }
};

/* ---------- Simple country overview text ---------- */

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

// --- Controls tuning GUI (lil-gui) ---
const controlsGUI = new GUI({ title: 'Controls' });

// A small state object so we can clamp/format values nicely
const ctrlState = {
  rotateSpeed: controls.rotateSpeed ?? 1,
  zoomSpeed: controls.zoomSpeed ?? 1,
  enableDamping: controls.enableDamping ?? true,
  dampingFactor: controls.dampingFactor ?? 0.05,
  minDistance: controls.minDistance ?? 120,
  maxDistance: controls.maxDistance ?? 500,
  enablePan: controls.enablePan ?? false,
  autoRotate: controls.autoRotate ?? false,
  autoRotateSpeed: controls.autoRotateSpeed ?? 2.0,
  resetView: () => {
    controls.reset(); // resets to initial state captured by OrbitControls
  }
};

// Rotation / drag feel
controlsGUI
  .add(ctrlState, 'rotateSpeed', 0.1, 3.0, 0.05)
  .name('Drag sensitivity')
  .onChange(v => (controls.rotateSpeed = v));

// Scroll zoom feel
controlsGUI
  .add(ctrlState, 'zoomSpeed', 0.1, 3.0, 0.05)
  .name('Zoom sensitivity')
  .onChange(v => (controls.zoomSpeed = v));

// Damping (inertia)
controlsGUI
  .add(ctrlState, 'enableDamping')
  .name('Inertia')
  .onChange(v => (controls.enableDamping = v));

controlsGUI
  .add(ctrlState, 'dampingFactor', 0.0, 0.2, 0.005)
  .name('Inertia amount')
  .onChange(v => (controls.dampingFactor = v));

// Distance limits
controlsGUI
  .add(ctrlState, 'minDistance', 50, 400, 1)
  .name('Min zoom')
  .onChange(v => (controls.minDistance = v));

controlsGUI
  .add(ctrlState, 'maxDistance', 200, 1200, 1)
  .name('Max zoom')
  .onChange(v => (controls.maxDistance = v));

// Optional extras
controlsGUI
  .add(ctrlState, 'enablePan')
  .name('Enable pan')
  .onChange(v => (controls.enablePan = v));

controlsGUI
  .add(ctrlState, 'autoRotate')
  .name('Auto rotate')
  .onChange(v => (controls.autoRotate = v));

controlsGUI
  .add(ctrlState, 'autoRotateSpeed', 0.1, 10.0, 0.1)
  .name('Auto rotate speed')
  .onChange(v => (controls.autoRotateSpeed = v));

controlsGUI.add(ctrlState, 'resetView').name('Reset view');

// (Optional) start closed
controlsGUI.close();


controls.enableDamping = true;
// controls.dampingFactor = 0.07;
controls.minDistance = 120;
controls.maxDistance = 500;
controls.enablePan = false;

// store the “home” view for fly-back animation
const INITIAL_CAMERA_POS = camera.position.clone();
const INITIAL_CAMERA_TARGET = controls.target.clone();
// base distance we consider the "level"
const BASE_CAMERA_RADIUS = INITIAL_CAMERA_POS.length();

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
  .globeImageUrl('/textures/8k_earth_daymap.jpg')
  .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
  .showAtmosphere(false); // we use our own shader-based atmosphere

scene.add(globe);
globe.rotateY(-Math.PI * 0.4);

const GLOBE_R = typeof globe.getGlobeRadius === 'function'
  ? globe.getGlobeRadius()
  : 100;
const POINT_ALT = 0.025; // same altitude for click targets

// ---------- Custom atmosphere shader ----------

const atmosphereMaterial = new THREE.ShaderMaterial({
  uniforms: {
    glowColor: { value: new THREE.Color(0x60a5fa) } // tweak this colour if you like
  },
  vertexShader: `
    varying vec3 vNormal;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    uniform vec3 glowColor;
    void main() {
      float intensity = pow(1.0 - abs(vNormal.z), 3.0);
      gl_FragColor = vec4(glowColor * intensity, intensity);
    }
  `,
  side: THREE.BackSide,
  blending: THREE.AdditiveBlending,
  transparent: true,
  depthWrite: false
});

const atmosphereMesh = new THREE.Mesh(
  new THREE.SphereGeometry(GLOBE_R * 1.06, 64, 64),
  atmosphereMaterial
);
globe.add(atmosphereMesh);

// invisible sphere used to get lat/lng under cursor
const pickerSphere = new THREE.Mesh(
  new THREE.SphereGeometry(GLOBE_R, 64, 64),
  new THREE.MeshBasicMaterial({ visible: false })
);
globe.add(pickerSphere);

/* ---------- idle auto-rotate ---------- */

let lastInteractionTime = performance.now();
const IDLE_TIMEOUT_MS = 5000; // 5 seconds
const IDLE_ROT_SPEED = THREE.MathUtils.degToRad(5);
let lastFrameTime = performance.now();

function markUserInteraction() {
  lastInteractionTime = performance.now();
}

['pointerdown', 'pointermove', 'wheel', 'keydown'].forEach(evt =>
  window.addEventListener(evt, markUserInteraction, { passive: true })
);

function updateAutoRotate(dtSec) {
  const now = performance.now();
  const idleFor = now - lastInteractionTime;

  // only consider auto-rotate after some idle time
  if (idleFor < IDLE_TIMEOUT_MS) return;

  // never spin while a fly animation is running
  if (flyState) return;

  // optional: don't spin when a country/city panel is open
  if (panelEl && panelEl.classList.contains('open')) return;

  // slowly spin the globe around its Y axis (from current view)
  globe.rotation.y += IDLE_ROT_SPEED * dtSec;
}

/* ---------- marker textures (ring + inner disc) ---------- */

const markerTextures = {};         // { normal: Texture, fav: Texture, selected: Texture }
const cityMarkers = new Map();     // key -> THREE.Sprite

const NORMAL_COLOR   = '#ffd977';    // yellow
const FAV_COLOR      = '#eb2020ff';  // red
const SELECTED_COLOR = '#2ef138ff';    // soft indigo for active city

// which city is currently selected (for panel / fly-to)
let selectedCityKey = null;

// base scale for city markers (we animate up to this size)
const CITY_MARKER_BASE_SCALE = GLOBE_R * 0.012;

function makeRingTexture(colorHex) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;

  const outerR = size * 0.48;
  const ringInnerR = size * 0.34;
  const innerR = size * 0.22;

  ctx.clearRect(0, 0, size, size);

  ctx.fillStyle = colorHex;
  ctx.beginPath();
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx, cy, ringInnerR, 0, Math.PI * 2);
  ctx.fill();

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
  let color;
  if (kind === 'fav') {
    color = FAV_COLOR;
  } else if (kind === 'selected') {
    color = SELECTED_COLOR;
  } else {
    color = NORMAL_COLOR;
  }
  markerTextures[kind] = makeRingTexture(color);
  return markerTextures[kind];
}

function getMarkerKind(city) {
  const key = makeCityKey(city);
  if (key === selectedCityKey) return 'selected';
  if (isFavorite(city)) return 'fav';
  return 'normal';
}

function createCityMarkerSprite(city) {
  const kind = getMarkerKind(city);
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
  const kind = getMarkerKind(city);
  sprite.material.map = getMarkerTexture(kind);
  sprite.material.needsUpdate = true;
}

// set the selected city → adjust textures
function setSelectedCity(cityOrNull) {
  const newKey = cityOrNull ? makeCityKey(cityOrNull) : null;
  if (newKey === selectedCityKey) return;

  const prevKey = selectedCityKey;
  selectedCityKey = newKey;

  if (prevKey && cityMarkers.has(prevKey)) {
    const sprite = cityMarkers.get(prevKey);
    const city = sprite.userData.city;
    const kind = getMarkerKind(city);
    sprite.material.map = getMarkerTexture(kind);
    sprite.material.needsUpdate = true;
  }

  if (newKey && cityMarkers.has(newKey)) {
    const sprite = cityMarkers.get(newKey);
    const city = sprite.userData.city;
    const kind = getMarkerKind(city);
    sprite.material.map = getMarkerTexture(kind);
    sprite.material.needsUpdate = true;
  }
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
      min-width: 0;
    }

    .panel-text p {
      margin: 0 0 0.4rem;
      word-break: break-word;
      overflow-wrap: break-word;
    }

    .panel-section-title {
      margin: 0.9rem 0 0.35rem;
      font-size: 15px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      opacity: 0.9;
    }

    /* Make header robust on small widths */
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 8px;
      flex-wrap: wrap;     /* KEY: allow wrapping */
      min-width: 0;
    }

    .panel-header-main {
      display: flex;
      align-items: center;
      gap: 10px;          /* fixed invalid "10 px" */
      min-width: 0;
      flex: 1 1 auto;
    }

    .panel-header-main > div {
      min-width: 0;       /* allow title to wrap */
    }

    .panel-title {
      overflow-wrap: anywhere;
      word-break: break-word;
    }

    .panel-header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
      flex-wrap: wrap;     /* KEY: prevent overflow */
      justify-content: flex-end;
    }

    .panel-back-btn {
      border: 1px solid rgba(148,163,184,0.7);
      padding: 4px 9px;
      border-radius: 999px;
      transform: translateX(-10px);
      background: rgba(15,23,42,0.95);
      color: #e5e7eb;
      cursor: pointer;
      font-size: 13px;     /* fixed invalid "13 px" */
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      flex: 0 0 auto;
    }

    .panel-back-btn:hover {
      background: rgba(37, 64, 175, 0.95);
      border-color: rgba(191, 219, 254, 0.95);
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

    .fav-btn {
      border: 0;
      padding: 6px 10px;
      border-radius: 999px;
      cursor: pointer;
      font-size: 12px;
      background: rgba(15,23,42,0.9);
      color: #e5e7eb;
      border: 1px solid rgba(148,163,184,0.75);
      white-space: nowrap;
    }

    .fav-btn.fav-on {
      background: #facc15;
      color: #1f2937;
      border-color: #facc15;
    }

    .trip-btn {
      border: 0;
      padding: 6px 10px;
      border-radius: 999px;
      cursor: pointer;
      font-size: 12px;
      background: rgba(15,23,42,0.9);
      color: #e5e7eb;
      border: 1px solid rgba(59,130,246,0.85);
      white-space: nowrap;
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
      min-width: 0;
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
      max-width: 100%;
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
      white-space: nowrap;
    }
  `;
  document.head.appendChild(style);
}


/* ---------- panel content renderer ---------- */

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

  bodyEl.textContent = 'Loading...';
  if (iconEl) iconEl.innerHTML = '';

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

/* ---------- smooth fly-to camera animation ---------- */

let flyState = null;

function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

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

// fly to a country center (approximate using that country’s first city)
function startFlyToCountry(countryFeature) {
  const countryName = countryFeature.properties?.name;
  const city = allCities.find(c => c.country === countryName);
  if (!city) return;

  const mesh = findCityMesh(city);
  if (mesh) {
    startFlyToCityMesh(mesh);
  }
}

// fly camera back to "level" at current direction
function startFlyHome() {
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();

  // Direction we are currently looking at
  const dir = startPos.clone().normalize();

  const endPos = dir.multiplyScalar(BASE_CAMERA_RADIUS);
  const endTarget = INITIAL_CAMERA_TARGET.clone();

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

/* ---------- helper: reset country + markers when closing ---------- */

function resetCountrySelection() {
  // clear active + hover country so polygons go back to normal
  activeCountry = null;
  hoverCountry = null;
  updateCountryStyles();
  showCountryTooltip(null);
  setSelectedCity(null);


  // clear country-level filter state
  countryFilterCountry = null;
  activeCountryFilters.clear();

  // hide all city markers and stop their animations
  if (cityAppearAnimations) {
    cityAppearAnimations.clear();
  }
  for (const sprite of cityMarkers.values()) {
    sprite.visible = false;
    sprite.scale.set(0, 0, 1);
  }
}

/* ---------- helper: shared close button wiring ---------- */

function wirePanelCloseWithFlyHome() {
  const closeBtn = document.getElementById('close-btn');
  if (!closeBtn) return;
  closeBtn.addEventListener('click', () => {
    panelEl.classList.remove('open');
    // clear active country + hide dots + clear selection
    resetCountrySelection();
    // then fly back to the initial view level in current direction
    startFlyHome();
  }, { once: true });
}

/* ---------- CITY PANEL ---------- */

function openCityPanel(city) {
  ensurePanelExtraStyles();
  currentTag = 'all';

  const fav = isFavorite(city);
  const inTrip = cityInTrip(city);

  panelInnerEl.innerHTML = `
    <div class="panel-header">
      <div class="panel-header-main">
        <button
          class="panel-back-btn"
          id="back-btn"
          type="button"
          aria-label="Back to country"
        >
          ←
        </button>
        <div>
          <h2 class="panel-title">${city.name}, ${city.country}</h2>
          <p class="muted">Population ${city.pop ?? ''}</p>
        </div>
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
      <p>${city.summary || `${city.name} is a great starting point for exploring ${city.country}.`}</p>

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

  // shared close handler → reset + fly home
  wirePanelCloseWithFlyHome();

    // NEW: back button → go from city back to its country
  const backBtn = document.getElementById('back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const countryFeature = findCountryFeatureForCity(city);
      if (!countryFeature) return;

      // clear selected city so dot color goes back to normal
      setSelectedCity(null);

      // open the country panel for this city’s country
      openCountryPanel(countryFeature);
    });
  }



  // kick off weather fetch (non-blocking)
  fetchAndRenderWeather(city);

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

      updateCityMarker(city);
      renderFavoriteBar();
    });
  }

  // trip planner toggle from the panel
  const tripBtn = document.getElementById('trip-btn');
  if (tripBtn) {
    tripBtn.addEventListener('click', () => {
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

  renderCityContent(city);
}

/* ---------- COUNTRY PANEL ---------- */

/* ---------- COUNTRY FILTERING (CITY DOT VISIBILITY) ---------- */

function getCityTags(city) {
  return Array.isArray(city?.tags) ? city.tags : [];
}

function cityMatchesAnyActiveFilter(city) {
  if (!activeCountryFilters || activeCountryFilters.size === 0) return true; // "All"
  const tags = getCityTags(city);
  for (const f of activeCountryFilters) {
    if (tags.includes(f)) return true;
  }
  return false;
}

function getCitiesInCountryByName(countryName) {
  const countryNorm = normalizeCountryName(countryName);
  return allCities.filter(c => normalizeCountryName(c.country) === countryNorm);
}

/**
 * Visible cities for the active country:
 * - if no filters: all cities in that country (current behavior)
 * - if filters: show cities that match ANY selected filter
 * - always keep favorites + selected city visible if they belong to the country
 */
function getVisibleCitiesForCountryName(countryName) {
  const allInCountry = getCitiesInCountryByName(countryName);

  let visible = allInCountry;
  if (activeCountryFilters && activeCountryFilters.size > 0) {
    visible = allInCountry.filter(cityMatchesAnyActiveFilter);

    // Always keep favorites visible (within the country)
    const favExtra = allInCountry.filter(c => isFavorite(c));
    const merged = new Map();
    [...visible, ...favExtra].forEach(c => merged.set(makeCityKey(c), c));

    // Always keep selected city visible (within the country)
    if (selectedCityKey) {
      const sel = allInCountry.find(c => makeCityKey(c) === selectedCityKey);
      if (sel) merged.set(makeCityKey(sel), sel);
    }

    visible = [...merged.values()];
  }

  return { allInCountry, visible };
}

function renderCountryCityList(countryName) {
  const listEl = panelInnerEl.querySelector('#country-city-list');
  const countEl = panelInnerEl.querySelector('#country-city-count');
  if (!listEl) return;

  const { allInCountry, visible } = getVisibleCitiesForCountryName(countryName);

  if (countEl) {
    if (!allInCountry.length) {
      countEl.textContent = '';
    } else if (!activeCountryFilters.size) {
      countEl.textContent = `Showing ${visible.length} cities`;
    } else {
      countEl.textContent = `Showing ${visible.length} of ${allInCountry.length} cities`;
    }
  }

  if (!visible.length) {
    listEl.innerHTML = `<li><p class="muted" style="margin:0.3rem 0 0;">No cities match these filters.</p></li>`;
    return;
  }

  listEl.innerHTML = visible.map(c => `
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
  `).join('');
}

function syncCountryFilterUI() {
  const row = panelInnerEl.querySelector('#country-filter-row');
  if (!row) return;
  row.querySelectorAll('.tag-pill').forEach(btn => {
    const id = btn.getAttribute('data-filter') || 'all';
    const active =
      (id === 'all' && activeCountryFilters.size === 0) ||
      (id !== 'all' && activeCountryFilters.has(id));
    btn.classList.toggle('active', active);
  });
}

/**
 * Apply country filters to both:
 * - visible city markers on the globe
 * - the city list in the country panel
 */
function applyCountryFilters(countryFeature) {
  if (!countryFeature) return;
  const countryName = countryFeature.properties?.name || 'Country';

  // Update markers on the globe
  revealCountryCitiesWithAnimation(countryFeature);

  // Update the country panel list/count if it's open
  if (panelEl && panelEl.classList.contains('open')) {
    renderCountryCityList(countryName);
    syncCountryFilterUI();
  }
}

function openCountryPanel(countryFeature) {
  ensurePanelExtraStyles();
  currentTag = 'all';

  const countryName = countryFeature.properties?.name || 'Country';

  // Reset filters only when switching to a different country
  if (countryFilterCountry !== countryName) {
    countryFilterCountry = countryName;
    activeCountryFilters.clear();
  }

  const info = COUNTRY_INFO[countryName] || {
    summary: `${countryName} is one of the European countries in this globe.`
  };

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

      <h3 class="panel-section-title">Filters</h3>
      <div class="tag-row" id="country-filter-row">
        ${COUNTRY_FILTER_DEFS.map(f => `
          <button
            class="tag-pill"
            data-filter="${f.id}"
            type="button"
          >
            ${f.label}
          </button>
        `).join('')}
      </div>

      <p class="muted" id="country-city-count" style="margin:0 0 0.35rem;"></p>

      <h3 class="panel-section-title">Cities in ${countryName}</h3>
      <ul class="country-city-list" id="country-city-list"></ul>
    </div>
  `;

  panelEl.classList.add('open');

  // shared close handler → reset + fly home
  wirePanelCloseWithFlyHome();

  // Filter clicks (delegated)
  const filterRow = panelInnerEl.querySelector('#country-filter-row');
  if (filterRow) {
    filterRow.addEventListener('click', ev => {
      const btn = ev.target.closest('.tag-pill');
      if (!btn) return;
      const id = btn.getAttribute('data-filter') || 'all';

      if (id === 'all') {
        activeCountryFilters.clear();
      } else {
        if (activeCountryFilters.has(id)) {
          activeCountryFilters.delete(id);
        } else {
          activeCountryFilters.add(id);
        }
      }

      // Apply to globe + list
      applyCountryFilters(countryFeature);
    });
  }

  // "Open city" buttons (delegated)
  const listEl = panelInnerEl.querySelector('#country-city-list');
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

  // Initial render + sync UI
  renderCountryCityList(countryName);
  syncCountryFilterUI();

  // Ensure markers match current filters
  applyCountryFilters(countryFeature);
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
positionTripTray();
syncSize();

/* ---------- COUNTRY LAYER ---------- */

// List of country names as they appear in world-atlas / Natural Earth
// (we include a few aliases to be safe).
const EUROPE_COUNTRY_NAMES = new Set([
  'Albania',
  'Andorra',
  'Austria',
  'Belarus',
  'Belgium',
  'Bosnia and Herzegovina',
  'Bulgaria',
  'Croatia',
  'Cyprus',
  'Czechia',
  'Czech Republic',
  'Denmark',
  'Estonia',
  'Finland',
  'France',
  'Germany',
  'Greece',
  'Hungary',
  'Iceland',
  'Ireland',
  'Italy',
  'Kosovo',
  'Latvia',
  'Liechtenstein',
  'Lithuania',
  'Luxembourg',
  'Malta',
  'Moldova',
  'Monaco',
  'Montenegro',
  'Netherlands',
  'North Macedonia',
  'Macedonia',
  'Norway',
  'Poland',
  'Portugal',
  'Romania',
  'Russia',
  'Russian Federation',
  'San Marino',
  'Serbia',
  'Slovakia',
  'Slovenia',
  'Spain',
  'Sweden',
  'Switzerland',
  'Ukraine',
  'United Kingdom',
  'UK',
  'Vatican',
  'Holy See',
  'Vatican City',
  // optionally treat these as “in scope”:
  'Turkey'
]);

function normalizeCountryName(name) {
  if (!name) return '';
  const n = name.trim();

  // North Macedonia ↔ Macedonia
  if (/^north macedonia$/i.test(n)) return 'Macedonia';
  if (/^macedonia$/i.test(n))       return 'Macedonia';

  return n;
}


function isEuropeanCountryFeature(f) {
  const name = f.properties?.name;
  if (!name) return false;
  return EUROPE_COUNTRY_NAMES.has(name);
}


let countryFeatures = [];
let hoverCountry = null;
let activeCountry = null;

/*
 * POLYGON COLOURS
 */
function updateCountryStyles() {
  if (!countryFeatures.length) return;
  globe
    .polygonAltitude(d =>
      d === hoverCountry || d === activeCountry ? 0.015 : 0.007
    )
    .polygonCapColor(d => {
      if (d === activeCountry) return 'rgba(129, 140, 248, 0.60)';
      return d === hoverCountry
        ? 'rgba(59, 130, 246, 0.45)'
        : 'rgba(56, 189, 248, 0.30)';
    })
    .polygonSideColor(() => 'rgba(96, 165, 250, 0.6)')
    .polygonStrokeColor(d => {
      if (d === activeCountry) return 'rgba(248, 250, 252, 1.0)';
      return d === hoverCountry
        ? 'rgba(191, 219, 254, 0.98)'
        : 'rgba(125, 211, 252, 0.90)';
    });
}

function setupCountries(geoFeatures) {
  // Only keep European countries
  countryFeatures = geoFeatures.filter(isEuropeanCountryFeature);

  globe.polygonsData(countryFeatures);
  if (typeof globe.polygonsTransitionDuration === 'function') {
    globe.polygonsTransitionDuration(0);
  }
  updateCountryStyles();

  console.log('Loaded European countries:', countryFeatures.map(f => f.properties?.name));
}

/* ---------- GeoJSON point-in-polygon ---------- */

function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
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
  if (!pointInRing(lng, lat, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lng, lat, rings[i])) return false;
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

function showCityTooltip(city, clientX, clientY) {
  if (!tooltipEl) return;
  if (!city) {
    tooltipEl.classList.remove('show');
    return;
  }
  const label = `${city.name}, ${city.country}`;
  tooltipEl.textContent = label;
  tooltipEl.style.left = `${clientX}px`;
  tooltipEl.style.top = `${clientY}px`;
  tooltipEl.classList.add('show');
}

/* ---------- CLICK TARGETS + CITY MARKERS ---------- */

const hitGeometry = new THREE.SphereGeometry(GLOBE_R * 0.012, 16, 16);
const hitMaterial = new THREE.MeshBasicMaterial({
  color: 0xffff66,
  wireframe: true,
  transparent: true,
  opacity: 0.35,
  visible: false
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

      const hit = new THREE.Mesh(hitGeometry, hitMaterial);
      hit.userData.city = d;
      group.add(hit);
      clickTargets.push(hit);

      const sprite = createCityMarkerSprite(d);
      group.add(sprite);
      cityMarkers.set(makeCityKey(d), sprite);

      group.userData.city = d;
      return group;
    });

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
  const lon = THREE.MathUtils.radToDeg(Math.atan2(z, -x));
  return { lat, lng: lon };
}

/* ---------- Trip plan state & helpers ---------- */

const tripPlan = [];

// positions tray so it is bottom-center BUT avoids:
// - the right panel (when open)
// - the bottom-left hint pill (#globe-instructions)
function positionTripTray() {
  if (!tripTrayEl) return;

  const MARGIN = 18;
  const GAP_TO_PANEL = 14;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Default safe horizontal bounds
  let leftLimit = MARGIN;
  let rightLimit = vw - MARGIN;

  // If the side panel is open, don't let tray overlap it
  const panelOpen = panelEl && panelEl.classList.contains('open');
  if (panelOpen) {
    const pr = panelEl.getBoundingClientRect();
    rightLimit = Math.min(rightLimit, pr.left - GAP_TO_PANEL);
  }

  // Max width we are allowed to use
  let maxW = Math.min(720, rightLimit - leftLimit);
  maxW = Math.max(280, maxW); // keep it usable

  // Clamp tray center so it fits
  const desiredCenter = vw / 2;
  const minCenter = leftLimit + maxW / 2;
  const maxCenter = rightLimit - maxW / 2;
  const centerX = Math.min(Math.max(desiredCenter, minCenter), maxCenter);

  // Apply layout to your existing tray element
  tripTrayEl.style.left = `${centerX}px`;
  tripTrayEl.style.transform = 'translateX(-50%)';
  tripTrayEl.style.maxWidth = `${maxW}px`;

  // Base bottom
  let bottomPx = 18;
  tripTrayEl.style.bottom = `${bottomPx}px`;

  // If tray isn't open, don't bother resolving overlaps
  if (!tripTrayEl.classList.contains('open')) return;

  // Next frame: measure actual tray + hint and avoid overlap precisely
  requestAnimationFrame(() => {
    const hint = document.getElementById('globe-instructions');
    if (!hint) return;

    const trayRect = tripTrayEl.getBoundingClientRect();
    const hintRect = hint.getBoundingClientRect();

    const overlapsX = !(trayRect.right < hintRect.left || trayRect.left > hintRect.right);
    const overlapsY = !(trayRect.bottom < hintRect.top || trayRect.top > hintRect.bottom);

    if (overlapsX && overlapsY) {
      // raise tray just enough so it clears the hint
      const needed = (trayRect.bottom - hintRect.top) + 10;
      bottomPx = Math.min(vh - 80, bottomPx + needed); // cap so it doesn't go crazy
      tripTrayEl.style.bottom = `${bottomPx}px`;
    }
  });
}

function cityInTrip(city) {
  const key = makeCityKey(city);
  return tripPlan.some(c => makeCityKey(c) === key);
}

function toggleCityInTrip(city) {
  const key = makeCityKey(city);
  const idx = tripPlan.findIndex(c => makeCityKey(c) === key);
  if (idx === -1) tripPlan.push(city);
  else tripPlan.splice(idx, 1);

  recomputeTripUIAndArcs();
}

function deg2rad(d) {
  return d * Math.PI / 180;
}

function distanceKm(a, b) {
  const R = 6371;
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
    tripStatsEl.textContent = 'Open a city panel and add it to your trip.';
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
  const cruiseSpeed = 800;
  const layoverHours = 0.6;
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
      <span class="trip-main">
        <span class="city">${city.name}</span>
        <span class="country">${city.country}</span>
      </span>
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
    positionTripTray();
    return;
  }

  renderTripList();
  recomputeTripStats();
  recomputeTripArcs();

  tripTrayEl.classList.add('open');
  positionTripTray();
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

    if (ev.target.closest('.trip-remove')) {
      tripPlan.splice(idx, 1);
      recomputeTripUIAndArcs();
      return;
    }

    const mesh = findCityMesh(city);
    if (mesh) startFlyToCityMesh(mesh);
    startFlyToCity(city);
  });
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

function findCountryFeatureForCity(city) {
  if (!countryFeatures.length) return null;
  const cityCountry = normalizeCountryName(city.country);
  return (
    countryFeatures.find(f =>
      normalizeCountryName(f.properties?.name) === cityCountry
    ) || null
  );
}


function setActiveCountryForCity(city) {
  const feat = findCountryFeatureForCity(city);
  if (!feat) return;
  activeCountry = feat;
  updateCountryStyles();
  revealCountryCitiesWithAnimation(feat);
}

function startFlyToCity(city) {
  setActiveCountryForCity(city);
  setSelectedCity(city);

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

const cityAppearAnimations = new Map();

function startCityMarkerAppear(city, delayMs = 0) {
  const key = makeCityKey(city);
  const sprite = cityMarkers.get(key);
  if (!sprite) return;
  const baseScale = sprite.userData.baseScale || CITY_MARKER_BASE_SCALE;

  sprite.visible = true;
  sprite.scale.set(0, 0, 1);

  cityAppearAnimations.set(key, {
    start: performance.now(),
    duration: 1500,
    baseScale,
    delay: delayMs
  });
}

function revealCountryCitiesWithAnimation(countryFeature) {
  const countryName = countryFeature.properties?.name || 'Country';
  const countryNorm = normalizeCountryName(countryName);
  if (!countryName) return;

  const { allInCountry, visible } = getVisibleCitiesForCountryName(countryName);

  const visibleKeys = new Set(visible.map(makeCityKey));

  // Hide everything that's not part of this country OR filtered out
  for (const [key, sprite] of cityMarkers.entries()) {
    const city = sprite.userData.city;
    const inCountry = city && normalizeCountryName(city.country) === countryNorm;

    if (!inCountry || !visibleKeys.has(key)) {
      sprite.visible = false;
      cityAppearAnimations.delete(key);
    }
  }

  // Show/animate visible cities
  visible.forEach((city, idx) => {
    const key = makeCityKey(city);
    const sprite = cityMarkers.get(key);
    if (!sprite) return;

    const baseScale = sprite.userData.baseScale || CITY_MARKER_BASE_SCALE;

    if (sprite.visible) {
      sprite.scale.set(baseScale, baseScale, 1);
      cityAppearAnimations.delete(key);
      return;
    }

    const baseDelay = 80;
    const jitter = Math.random() * 60;
    const delayMs = idx * baseDelay + jitter;
    startCityMarkerAppear(city, delayMs);
  });
}

function updateCityMarkersVisibility() {
  if (!activeCountry) {
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

    if (elapsed <= 0) {
      sprite.scale.set(0, 0, 1);
      continue;
    }

    const tRaw = elapsed / anim.duration;
    const t = Math.min(1, Math.max(0, tRaw));

    const eased = easeOutBack(t);
    const factor = 0.2 + 0.8 * eased;

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

// find a city under the current ray (only if its sprite is visible)
function pickCityUnderPointer() {
  const hits = raycaster.intersectObjects(clickTargets, true);
  for (const h of hits) {
    const mesh = h.object;
    const city = mesh.userData.city;
    if (!city) continue;
    const key = makeCityKey(city);
    const sprite = cityMarkers.get(key);
    if (!sprite || !sprite.visible) continue;
    return { city, point: h.point };
  }
  return null;
}
// --- prevent "click" from firing after a drag-rotate ---
const CLICK_MOVE_THRESHOLD_PX = 8;               // tweak if needed
const CLICK_MOVE_THRESHOLD_PX2 = CLICK_MOVE_THRESHOLD_PX * CLICK_MOVE_THRESHOLD_PX;

let pointerDownPos = null;
let didDragMove = false;
let suppressClicksUntil = 0;

renderer.domElement.addEventListener('pointerdown', (ev) => {
  // only left mouse / primary pointer
  if (ev.button !== undefined && ev.button !== 0) return;

  pointerDownPos = { x: ev.clientX, y: ev.clientY };
  didDragMove = false;
}, { passive: true });

renderer.domElement.addEventListener('pointermove', (ev) => {
  if (!pointerDownPos) return;

  const dx = ev.clientX - pointerDownPos.x;
  const dy = ev.clientY - pointerDownPos.y;

  if ((dx * dx + dy * dy) > CLICK_MOVE_THRESHOLD_PX2) {
    didDragMove = true;
  }
}, { passive: true });

// use window so we still catch the release even if the pointer leaves the canvas
window.addEventListener('pointerup', () => {
  if (!pointerDownPos) return;

  if (didDragMove) {
    // block the click that happens right after a drag ends
    suppressClicksUntil = performance.now() + 250; // ms
  }

  pointerDownPos = null;
  didDragMove = false;
}, { passive: true });

// CLICK: cities are now clickable when a country is active
renderer.domElement.addEventListener('click', ev => {
  if (performance.now() < suppressClicksUntil) return;
  setFromEvent(ev);

  // if we have an active country, try clicking a city first
  if (activeCountry) {
    const hitCity = pickCityUnderPointer();
    if (hitCity) {
      startFlyToCity(hitCity.city);
      return;
    }
  }

  // Otherwise, pick country by globe hit
  const hitSphere = raycaster.intersectObject(pickerSphere, true)[0];
  if (!hitSphere) return;

  const { lat, lng } = worldToLatLng(hitSphere.point);
  const country = pickCountryFromLatLng(lat, lng);
  if (!country) return;

  activeCountry = country;
  updateCountryStyles();
  revealCountryCitiesWithAnimation(country);
  startFlyToCountry(country);
  openCountryPanel(country);
});

// pointer move:
// - when NO country is active → hover shows country name (old behaviour)
// - when a country is active → hover shows CITY names over dots
renderer.domElement.addEventListener('pointermove', ev => {
  setFromEvent(ev);

  // If a country is active, prioritise city hover
  if (activeCountry) {
    const hitCity = pickCityUnderPointer();
    if (hitCity) {
      renderer.domElement.style.cursor = 'pointer';
      showCityTooltip(hitCity.city, ev.clientX, ev.clientY);
      return;
    }

    // No city under cursor while focused on a country
    showCityTooltip(null);
    renderer.domElement.style.cursor = 'grab';
    return;
  }

  // Default: hover countries like before
  const hitSphere = raycaster.intersectObject(pickerSphere, true)[0];
  if (!hitSphere) {
    if (hoverCountry) {
      hoverCountry = null;
      updateCountryStyles();
      showCountryTooltip(null);
    }
    renderer.domElement.style.cursor = 'grab';
    return;
  }

  const { lat, lng } = worldToLatLng(hitSphere.point);
  const newHover = pickCountryFromLatLng(lat, lng);

  if (newHover !== hoverCountry) {
    hoverCountry = newHover;
    updateCountryStyles();
  }

  renderer.domElement.style.cursor = newHover ? 'pointer' : 'grab';
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

    setupCountries(world.features);
    setupClickTargets(cities);
    wireSearch(cities);

    if ('requestIdleCallback' in window) {
      requestIdleCallback(preloadCityImages);
    } else {
      setTimeout(preloadCityImages, 0);
    }

    recomputeTripUIAndArcs();
    renderFavoriteBar();

    function tick() {
      requestAnimationFrame(tick);

      const now = performance.now();
      const dtSec = (now - lastFrameTime) / 1000;
      lastFrameTime = now;

      updateFly();
      updateCityAppearAnimations();
      updateAutoRotate(dtSec);
      controls.update();
      renderer.render(scene, camera);
    }
    tick();
  } catch (e) {
    if (!fatalEl?.classList.contains('show')) fatal(e);
  } finally {
    showStartGate();
  }
})();
