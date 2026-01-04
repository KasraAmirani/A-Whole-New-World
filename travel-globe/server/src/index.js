// server/src/index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();

const PORT = process.env.PORT || 8787;
const ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';
const GOOGLE_KEY = process.env.GOOGLE_MAPS_KEY;
const OPENWEATHER_KEY = process.env.OPENWEATHER_KEY;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POP_DATA_PATH = path.join(
  __dirname,
  '../data/ne_10m_populated_places.geojson'
);

/**
 * ISO_A2 codes for "Europe-ish" countries.
 */
const EUROPE_ISO2 = new Set([
  'AL', 'AD', 'AT', 'BY', 'BE', 'BA', 'BG', 'HR', 'CY',
  'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS',
  'IE', 'IT', 'LV', 'LI', 'LT', 'LU', 'MT', 'MD', 'MC',
  'ME', 'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'RU', 'SM',
  'RS', 'SK', 'SI', 'ES', 'SE', 'CH', 'UA', 'GB', 'VA',
  'TR', '-99',
]);

// ---------- Vacation-type city tags (Option A: server attaches `tags` to each city) ----------
// These tags are used by the frontend to show/hide city dots when filtering within a country.

function normCityKey(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const VACATION_TAG_CITY_NAMES ={
  beach: [
    "Stavanger","Gothenburg","Malmö","Liepāja","Klaipėda","İzmir","Athens",
    "Thessaloniki","Piraeus","Varna","Split","Rijeka","Naples","Marseille",
    "Barcelona","Lisbon","Porto","Varna","Klaipėda","Liepāja"
  ],

  nature: [
    "Oslo","Bergen","Stavanger","Stockholm","Tampere","Turku","Reykjavík",
    "Akureyri","Keflavík","Geneva","Zurich","Basel","Ljubljana","Maribor",
    "Podgorica","Peja","Dnipro","Novosibirsk","Miskolc","Prešov","Košice",
    "Graz","Linz","Cork","Limerick","Debrecen","Bălți","Gomel","Mogilev"
  ],

  culture: [
    "Moscow","Saint Petersburg","Tallinn","Tartu","Narva","Riga","Vilnius",
    "Kaunas","Minsk","Kyiv","Kharkiv","Chișinău","Tiraspol","Istanbul",
    "Ankara","Athens","Plovdiv","Sofia","Bucharest","Iași","Cluj-Napoca",
    "Warsaw","Łódź","Katowice","Belgrade","Niš","Novi Sad","Budapest",
    "Bratislava","Prague","Brno","Vienna","Rome","Paris","Madrid","Seville",
    "London","Dublin","Zagreb","Ljubljana"
  ],

  food: [
    "Gothenburg","Malmö","Riga","Vilnius","Istanbul","Thessaloniki","Athens",
    "Rome","Milan","Paris","Lyon","Barcelona","Lisbon","Porto","Vienna",
    "Brussels","Antwerp","Budapest","Naples","Marseille","Madrid","Valencia",
    "Cluj-Napoca","Debrecen","Tampere","Turku"
  ],

  design: [
    "Helsinki","Stockholm","Amsterdam","Rotterdam","The Hague","Milan",
    "Paris","Vienna","Prague","Barcelona","Berlin","Frankfurt","Stuttgart",
    "Zurich","Basel","Luxembourg","Brno","Linz","Graz"
  ],

  adventure: [
    "Bergen","Stavanger","Reykjavík","Akureyri","Peja","Split","Geneva",
    "Zurich","Naples","Tirana","Shkodër","Niš","Podgorica","Miskolc",
    "Ostrava","Košice","Prešov","Debrecen","Cluj-Napoca"
  ],

  family: [
    "Tampere","Gothenburg","Vienna","Ljubljana","Dublin","Stockholm",
    "Manchester","Birmingham","Bratislava","Debrecen","Turku","Helsinki",
    "Cork","Limerick","Oslo","Zurich","Kaunas","Tartu","Paris"
  ],

  romantic: [
    "Turku","Paris","Rome","Vienna","Prague","Barcelona","Lisbon","Porto",
    "Ljubljana","Budapest","Split","Braga","Maribor","Tallinn","Vilnius",
    "Riga","Florence"
  ]
}

// Precompute a normalized-name -> tags[] map
const CITY_TAG_LOOKUP = new Map();
for (const [tagId, names] of Object.entries(VACATION_TAG_CITY_NAMES)) {
  for (const n of names) {
    const key = normCityKey(n);
    if (!key) continue;
    const arr = CITY_TAG_LOOKUP.get(key) || [];
    if (!arr.includes(tagId)) arr.push(tagId);
    CITY_TAG_LOOKUP.set(key, arr);
  }
}

function tagsForCityName(cityName) {
  return CITY_TAG_LOOKUP.get(normCityKey(cityName)) || [];
}

// ---------- FALLBACK: your original 12 prototype cities ----------

const FALLBACK_CITIES = [
  // -------- IRELAND --------
  {
    country: 'Ireland',
    name: 'Dublin',
    lat: 53.3498,
    lng: -6.2603,
    pop: '~1.2M',
    summary:
      'Compact, social and easy to walk, with a mix of history, pubs and quick escapes to the sea or hills.'
  },
  {
    country: 'Ireland',
    name: 'Cork',
    lat: 51.8985,
    lng: -8.4756,
    pop: '~210K',
    summary:
      'Vibrant, compact city with a strong food scene and easy access to coastal and countryside escapes.'
  },
  {
    country: 'Ireland',
    name: 'Galway',
    lat: 53.2707,
    lng: -9.0568,
    pop: '~80K',
    summary:
      'Lively university city on the west coast, gateway to Connemara and the Aran Islands.'
  },

  // -------- GREECE --------
  {
    country: 'Greece',
    name: 'Athens',
    lat: 37.9838,
    lng: 23.7275,
    pop: '~3.1M',
    summary:
      'Layered ancient history, dense neighborhoods and long evenings outside with food, drinks and city views.'
  },
  {
    country: 'Greece',
    name: 'Thessaloniki',
    lat: 40.6401,
    lng: 22.9444,
    pop: '~800K',
    summary:
      'Seafront city with Byzantine history, cafés and a big student population.'
  },
  {
    country: 'Greece',
    name: 'Heraklion',
    lat: 35.3387,
    lng: 25.1442,
    pop: '~175K',
    summary:
      'Busy Cretan port city and practical base for ruins, beaches and mountain villages.'
  },

  // -------- DENMARK --------
  {
    country: 'Denmark',
    name: 'Copenhagen',
    lat: 55.6761,
    lng: 12.5683,
    pop: '~0.8M',
    summary:
      'Laid-back, design-forward city of bikes, harbors, and long cosy evenings.'
  },
  {
    country: 'Denmark',
    name: 'Aarhus',
    lat: 56.1629,
    lng: 10.2039,
    pop: '~280K',
    summary:
      'Second city of Denmark with a big student population, museums and nearby beaches and forests.'
  },
  {
    country: 'Denmark',
    name: 'Odense',
    lat: 55.4038,
    lng: 10.4024,
    pop: '~180K',
    summary:
      'Birthplace of Hans Christian Andersen, with a relaxed center and easy access to the countryside of Funen.'
  },

  // -------- CROATIA --------
  {
    country: 'Croatia',
    name: 'Zagreb',
    lat: 45.815,
    lng: 15.9819,
    pop: '~0.8M',
    summary:
      'Comfortable, café-heavy capital with Austro-Hungarian architecture and easy day trips to nature.'
  },
  {
    country: 'Croatia',
    name: 'Split',
    lat: 43.5081,
    lng: 16.4402,
    pop: '~180K',
    summary:
      'Adriatic hub built into the remains of Diocletian’s Palace, with ferries to islands and beaches nearby.'
  },
  {
    country: 'Croatia',
    name: 'Dubrovnik',
    lat: 42.6507,
    lng: 18.0944,
    pop: '~40K',
    summary:
      'Fortified coastal city with dramatic walls and views over the Adriatic.'
  }
];

// ---------- Natural Earth -> cities (3 per European country) ----------

function buildCitiesFromNaturalEarth() {
  try {
    const raw = fs.readFileSync(POP_DATA_PATH, 'utf8');
    const geojson = JSON.parse(raw);
    const features = geojson.features || [];

    // group by country
    const byCountry = new Map();

    for (const f of features) {
      const props = f.properties || {};
      const iso2 = String(props.ISO_A2 || props.iso_a2 || '').toUpperCase();
      if (!EUROPE_ISO2.has(iso2)) continue;

      // Country name we'll send to the frontend – try ADM0NAME first
      const countryName =
        props.ADM0NAME ||
        props.SOV0NAME ||
        props.NAME_EN ||
        props.NAME ||
        null;

      if (!countryName) continue;

      const geom = f.geometry;
      if (!geom || geom.type !== 'Point' || !Array.isArray(geom.coordinates)) {
        continue;
      }
      const [lng, lat] = geom.coordinates;
      if (typeof lat !== 'number' || typeof lng !== 'number') continue;

      const cityName =
        props.NAME_EN ||
        props.NAME ||
        props.NAMEASCII ||
        props.GN_ASCII ||
        null;

      if (!cityName) continue;

      const popMax = typeof props.POP_MAX === 'number' ? props.POP_MAX : null;

      if (!byCountry.has(countryName)) {
        byCountry.set(countryName, []);
      }

      byCountry.get(countryName).push({
        country: countryName,
        name: cityName,
        lat,
        lng,
        _popMax: popMax
      });
    }

    const result = [];

    for (const [countryName, cities] of byCountry.entries()) {
      // sort by population desc, nulls last
      cities.sort((a, b) => {
        const pa = a._popMax ?? -1;
        const pb = b._popMax ?? -1;
        return pb - pa;
      });

      const top3 = cities.slice(0, 3);

      for (const c of top3) {
        const pop = c._popMax;
        result.push({
          country: c.country,
          name: c.name,
          lat: c.lat,
          lng: c.lng,
          // simple formatted population, or null if unknown
          pop: pop ? `~${Math.round(pop).toLocaleString('en-US')}` : null,
          // optional generic summary – frontend already has a fallback string
          summary: null
        });
      }
    }

    console.log(
      `Loaded ${result.length} cities from Natural Earth populated-places (3 per European country)`
    );

    return result;
  } catch (err) {
    console.error(
      'Failed to load Natural Earth populated places – using fallback cities.',
      err.message
    );
    return null;
  }
}

// build the actual cities array used by /api/cities
const GENERATED_CITIES = buildCitiesFromNaturalEarth();
const cities = GENERATED_CITIES && GENERATED_CITIES.length
  ? GENERATED_CITIES
  : FALLBACK_CITIES;

// Attach vacation-type tags to each city (non-breaking: extra field)
const citiesWithTags = cities.map(c => ({
  ...c,
  tags: tagsForCityName(c.name)
}));

// ---------- middleware ----------

app.use(helmet());
app.use(cors({ origin: ORIGIN }));
app.use(express.json());
app.use(morgan('tiny'));
app.use('/api/', rateLimit({ windowMs: 60_000, max: 60 }));

// --- simple landing page at "/" ---
app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
  <html>
    <head>
      <meta charset="utf-8"/>
      <title>Travel Globe API</title>
      <style>
        body{font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:24px;line-height:1.45;background:#020617;color:#e5e7eb}
        a{color:#38bdf8;text-decoration:none}
        code{background:#020617;padding:2px 6px;border-radius:4px;border:1px solid #1f2937}
      </style>
    </head>
    <body>
      <h1>Travel Globe API</h1>
      <p>Backend for the Travel Globe prototype.</p>
      <p>Try:</p>
      <ul>
        <li><a href="/api/health">/api/health</a></li>
        <li><a href="/api/cities">/api/cities</a></li>
        <li><a href="/api/geocode?q=Dublin, Ireland">/api/geocode?q=Dublin, Ireland</a></li>
      </ul>
      <p>Allowed origin: <code>${ORIGIN}</code></p>
      <p>Geocoding key set: <code>${Boolean(GOOGLE_KEY)}</code></p>
      <p>Pop places file: <code>${POP_DATA_PATH}</code></p>
    </body>
  </html>`);
});

// --- health ---
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// --- cities endpoint (used by the globe frontend) ---
app.get('/api/cities', (_req, res) => {
  res.json(citiesWithTags);
});

// --- server-side Google Geocoding proxy ---
app.get('/api/geocode', async (req, res) => {
  try {
    if (!GOOGLE_KEY) {
      return res
        .status(500)
        .json({ error: 'GOOGLE_MAPS_KEY missing on server' });
    }
    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'Missing q parameter' });

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      q
    )}&key=${GOOGLE_KEY}`;
    const r = await fetch(url);
    if (!r.ok) return res.status(502).json({ error: `Upstream ${r.status}` });

    const data = await r.json();
    if (data.status !== 'OK' || !data.results?.length) {
      return res
        .status(404)
        .json({ error: `Geocoding failed: ${data.status}` });
    }
    const { lat, lng } = data.results[0].geometry.location;
    res.json({ lat, lng, formatted: data.results[0].formatted_address });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- OpenWeather current weather proxy (used by the frontend panel) ---
app.get('/api/weather', async (req, res) => {
  try {
    if (!OPENWEATHER_KEY) {
      return res
        .status(500)
        .json({ error: 'OPENWEATHER_KEY missing on server' });
    }

    const lat = String(req.query.lat ?? '').trim();
    const lng = String(req.query.lng ?? '').trim();
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lng)}&units=metric&appid=${OPENWEATHER_KEY}`;

    const r = await fetch(url);
    if (!r.ok) {
      console.error('Weather upstream error', r.status);
      return res.status(502).json({ error: 'Weather lookup failed' });
    }

    const data = await r.json();

    res.json({
      location: data.name ?? null,
      tempC: data.main?.temp ?? null,
      feelsLikeC: data.main?.feels_like ?? null,
      description: data.weather?.[0]?.description ?? null,
      icon: data.weather?.[0]?.icon ?? null,
      source: 'openweathermap'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`API ready on http://localhost:${PORT}`);
  console.log(`Allowed origin: ${ORIGIN}`);
  console.log(`Using ${citiesWithTags.length} cities (${GENERATED_CITIES ? 'Natural Earth' : 'fallback list'})`);
});
