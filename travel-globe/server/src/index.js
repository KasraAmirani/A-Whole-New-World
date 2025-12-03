// server/src/index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import fetch from 'node-fetch';

const app = express();

const PORT = process.env.PORT || 8787;
const ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';
const GOOGLE_KEY = process.env.GOOGLE_MAPS_KEY;
// NEW: OpenWeather API key (optional – only for weather)
const OPENWEATHER_KEY = process.env.OPENWEATHER_KEY;

app.use(helmet());
app.use(cors({ origin: ORIGIN }));
app.use(express.json());
app.use(morgan('tiny'));
app.use('/api/', rateLimit({ windowMs: 60_000, max: 60 })); // 60 req/min

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
    </body>
  </html>`);
});

// --- health ---
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// --- prototype cities (driven by the globe frontend) ---
const cities = [
  // -------- IRELAND --------
  {
    country: 'Ireland',
    name: 'Dublin',
    lat: 53.3498,
    lng: -6.2603,
    pop: '~1.2M',
    summary:
      'Compact, social and easy to walk, with a mix of history, pubs and quick escapes to the sea or hills.',
    tags: ['historical', 'food', 'nightlife', 'nature'],
    experiences: {
      historical: [
        {
          title: 'Trinity College & the Book of Kells',
          detail:
            'Start early on campus, wander the quad, then visit the Old Library for a hit of Irish history and design.'
        },
        {
          title: 'Kilmainham Gaol & Dublin Castle',
          detail:
            'Get a sense of the independence story, then walk back through the old streets toward the Liffey.'
        }
      ],
      food: [
        {
          title: 'Modern Irish in the Docklands',
          detail:
            'Try seasonal menus along the Grand Canal Dock for a lighter, modern take on Irish food.'
        },
        {
          title: 'Pub comfort food',
          detail:
            'Seek out a smaller neighborhood pub away from Temple Bar for stew, soda bread and chat with locals.'
        }
      ],
      nightlife: [
        {
          title: 'Trad music in small pubs',
          detail:
            'Look for live traditional music sessions in the evenings; stand near the musicians, not the bar.'
        },
        {
          title: 'Riverside walk after dark',
          detail:
            'Walk the quays at sunset and cross the Ha’penny Bridge for classic city views.'
        }
      ],
      nature: [
        {
          title: 'Howth cliffs day trip',
          detail:
            'Short train ride from the city; walk the coastal path and end with seafood in the village.'
        },
        {
          title: 'Phoenix Park by bike',
          detail:
            'Rent a bike, look for the deer herds and escape the busy center for a few hours.'
        }
      ]
    }
  },
  {
    country: 'Ireland',
    name: 'Cork',
    lat: 51.8985,
    lng: -8.4756,
    pop: '~210K',
    summary:
      'Vibrant, compact city with a strong food scene and easy access to coastal and countryside escapes.',
    tags: ['historical', 'food', 'nightlife', 'nature'],
    experiences: {
      historical: [
        {
          title: 'English Market & St. Anne’s Shandon',
          detail:
            'Start with the market, then climb the Shandon tower to ring the bells and get city views.'
        }
      ],
      food: [
        {
          title: 'English Market tastings',
          detail:
            'Sample local cheeses, breads and produce inside the covered market.'
        }
      ],
      nightlife: [
        {
          title: 'Riverside pubs',
          detail:
            'Follow the quays and duck into smaller pubs with live music.'
        }
      ],
      nature: [
        {
          title: 'Day trip to Kinsale or Cobh',
          detail:
            'Colorful coastal towns a short train or bus ride away.'
        }
      ]
    }
  },
  {
    country: 'Ireland',
    name: 'Galway',
    lat: 53.2707,
    lng: -9.0568,
    pop: '~80K',
    summary:
      'Lively university city on the west coast, gateway to Connemara and the Aran Islands.',
    tags: ['historical', 'food', 'nightlife', 'nature'],
    experiences: {
      historical: [
        {
          title: 'Latin Quarter & old streets',
          detail:
            'Wander the medieval lanes between Eyre Square and the Spanish Arch.'
        }
      ],
      food: [
        {
          title: 'Seafood along the quay',
          detail:
            'Fresh fish and oysters are the headline here.'
        }
      ],
      nightlife: [
        {
          title: 'Pub music sessions',
          detail:
            'Small venues with trad music most nights of the week.'
        }
      ],
      nature: [
        {
          title: 'Day trip to Connemara',
          detail:
            'Rugged landscape of lakes, mountains and sea, reachable by tour or car.'
        }
      ]
    }
  },

  // -------- GREECE --------
  {
    country: 'Greece',
    name: 'Athens',
    lat: 37.9838,
    lng: 23.7275,
    pop: '~3.1M',
    summary:
      'Layered ancient history, dense neighborhoods and long evenings outside with food, drinks and city views.',
    tags: ['historical', 'food', 'nightlife', 'nature'],
    experiences: {
      historical: [
        {
          title: 'Acropolis & Parthenon at golden hour',
          detail:
            'Climb up in the late afternoon for cooler temperatures and sunset light over the city and sea.'
        },
        {
          title: 'Ancient Agora & Roman Agora',
          detail:
            'Walk the ruins where everyday life happened, not just the postcard sites.'
        }
      ],
      food: [
        {
          title: 'Tavernas in Plaka & Psyrri',
          detail:
            'Share meze, grilled meats and carafes of wine or ouzo while people-watching in the narrow streets.'
        },
        {
          title: 'Central Market (Varvakios)',
          detail:
            'See where locals actually shop, then find a small place nearby for lunch.'
        }
      ],
      nightlife: [
        {
          title: 'Rooftop bars with Acropolis views',
          detail:
            'End the day with a drink overlooking the lit-up Parthenon.'
        },
        {
          title: 'Gazi & Exarchia bars',
          detail:
            'Explore the different nightlife vibes between industrial Gazi and more alternative Exarchia.'
        }
      ],
      nature: [
        {
          title: 'Lycabettus Hill at sunset',
          detail:
            'Short hike or funicular ride for 360° views over Athens and the Saronic Gulf.'
        },
        {
          title: 'Day trip to Sounion',
          detail:
            'Visit the Temple of Poseidon and watch the sun drop into the Aegean.'
        }
      ]
    }
  },
  {
    country: 'Greece',
    name: 'Thessaloniki',
    lat: 40.6401,
    lng: 22.9444,
    pop: '~800K',
    summary:
      'Seafront city with Byzantine history, cafés and a big student population.',
    tags: ['historical', 'food', 'nightlife', 'nature'],
    experiences: {
      historical: [
        {
          title: 'White Tower & waterfront walk',
          detail:
            'Iconic tower and relaxed promenade along the Thermaic Gulf.'
        }
      ],
      food: [
        {
          title: 'Ladadika district',
          detail:
            'Packed with tavernas and meze spots in restored warehouses.'
        }
      ],
      nightlife: [
        {
          title: 'Student bars and late cafés',
          detail:
            'The city stays lively well into the night, especially in the center.'
        }
      ],
      nature: [
        {
          title: 'Day trips to Halkidiki',
          detail:
            'Beaches and pine forests about an hour away.'
        }
      ]
    }
  },
  {
    country: 'Greece',
    name: 'Heraklion',
    lat: 35.3387,
    lng: 25.1442,
    pop: '~175K',
    summary:
      'Busy Cretan port city and practical base for ruins, beaches and mountain villages.',
    tags: ['historical', 'food', 'nature'],
    experiences: {
      historical: [
        {
          title: 'Knossos Palace',
          detail:
            'Minoan ruins a short drive from the city.'
        }
      ],
      food: [
        {
          title: 'Cretan tavernas',
          detail:
            'Olive oil, herbs and local cheeses are the stars of the menu.'
        }
      ],
      nature: [
        {
          title: 'South coast and gorges',
          detail:
            'Use Heraklion as a base for day trips inland or to quieter beaches.'
        }
      ]
    }
  },

  // -------- DENMARK --------
  {
    country: 'Denmark',
    name: 'Copenhagen',
    lat: 55.6761,
    lng: 12.5683,
    pop: '~0.8M',
    summary:
      'Laid-back, design-forward city of bikes, harbors, and long cosy evenings.',
    tags: ['historical', 'food', 'nightlife', 'nature'],
    experiences: {
      historical: [
        {
          title: 'Rosenborg Castle & King’s Garden',
          detail:
            'Wander the garden first, then see the crown jewels and royal interiors.'
        },
        {
          title: 'Christianshavn canals',
          detail:
            'Explore old warehouses, churches and the quieter side streets by the water.'
        }
      ],
      food: [
        {
          title: 'Smørrebrød lunch',
          detail:
            'Try open-faced sandwiches in a classic lunch restaurant or modern café.'
        },
        {
          title: 'Street food by the water',
          detail:
            'Head to Reffen or similar markets for casual bites with harbor views.'
        }
      ],
      nightlife: [
        {
          title: 'Nyhavn & inner city bars',
          detail:
            'Have an early-evening drink by the colored houses, then move deeper into the city.'
        },
        {
          title: 'Meatpacking District (Kødbyen)',
          detail:
            'Packed with bars and restaurants in old industrial buildings.'
        }
      ],
      nature: [
        {
          title: 'Biking along the harbor',
          detail:
            'Rent a bike and follow the harbor promenades past swimming spots and modern architecture.'
        },
        {
          title: 'Day trip to Dyrehaven',
          detail:
            'Forest and deer park just north of the city, ideal for a relaxed half-day outside.'
        }
      ]
    }
  },
  {
    country: 'Denmark',
    name: 'Aarhus',
    lat: 56.1629,
    lng: 10.2039,
    pop: '~280K',
    summary:
      'Second city of Denmark with a big student population, museums and nearby beaches and forests.',
    tags: ['historical', 'food', 'nightlife', 'nature'],
    experiences: {
      historical: [
        {
          title: 'Den Gamle By open-air museum',
          detail:
            'Walk through recreated streets from different eras.'
        }
      ],
      food: [
        {
          title: 'Harborfront cafés',
          detail:
            'New development with relaxed places to eat and drink by the water.'
        }
      ],
      nightlife: [
        {
          title: 'Student bars in the Latin Quarter',
          detail:
            'Compact area of lanes and small venues.'
        }
      ],
      nature: [
        {
          title: 'Moesgaard forest & beach',
          detail:
            'Woodland paths and sea views just south of the city.'
        }
      ]
    }
  },
  {
    country: 'Denmark',
    name: 'Odense',
    lat: 55.4038,
    lng: 10.4024,
    pop: '~180K',
    summary:
      'Birthplace of Hans Christian Andersen, with a relaxed center and easy access to the countryside of Funen.',
    tags: ['historical', 'food', 'nature'],
    experiences: {
      historical: [
        {
          title: 'H. C. Andersen museum and old town',
          detail:
            'Colourful houses and exhibitions about the writer.'
        }
      ],
      food: [
        {
          title: 'Cafés along the river',
          detail:
            'Casual spots to sit outside on good days.'
        }
      ],
      nature: [
        {
          title: 'Funen countryside & coasts',
          detail:
            'Short drives bring you to small villages and coastal paths.'
        }
      ]
    }
  },

  // -------- CROATIA --------
  {
    country: 'Croatia',
    name: 'Zagreb',
    lat: 45.815,
    lng: 15.9819,
    pop: '~0.8M',
    summary:
      'Comfortable, café-heavy capital with Austro-Hungarian architecture and easy day trips to nature.',
    tags: ['historical', 'food', 'nightlife', 'nature'],
    experiences: {
      historical: [
        {
          title: 'Upper Town (Gornji Grad)',
          detail:
            'Ride the funicular, see St. Mark’s Church and wander the old streets and viewpoints.'
        },
        {
          title: 'Mirogoj Cemetery',
          detail:
            'Peaceful arcades and sculptures set in greenery just outside the center.'
        }
      ],
      food: [
        {
          title: 'Štrukli & local comfort food',
          detail:
            'Try baked štrukli and other comfort dishes in traditional restaurants.'
        },
        {
          title: 'Dolac Market food stalls',
          detail:
            'Combine a morning market visit with snacks and coffee at nearby cafés.'
        }
      ],
      nightlife: [
        {
          title: 'Tkalčićeva Street',
          detail:
            'Bar-lined pedestrian street that stays lively late into the evening.'
        },
        {
          title: 'Hidden courtyards in summer',
          detail:
            'Look for pop-up bars and events in inner courtyards during warm months.'
        }
      ],
      nature: [
        {
          title: 'Jarun Lake',
          detail:
            'Evening walks or bike rides around the lake, with bars that get busy in summer.'
        },
        {
          title: 'Day trip to Medvednica',
          detail:
            'Hiking above the city with views back over Zagreb.'
        }
      ]
    }
  },
  {
    country: 'Croatia',
    name: 'Split',
    lat: 43.5081,
    lng: 16.4402,
    pop: '~180K',
    summary:
      'Adriatic hub built into the remains of Diocletian’s Palace, with ferries to islands and beaches nearby.',
    tags: ['historical', 'food', 'nightlife', 'nature'],
    experiences: {
      historical: [
        {
          title: 'Diocletian’s Palace',
          detail:
            'Ancient Roman core that is now full of shops, cafés and apartments.'
        }
      ],
      food: [
        {
          title: 'Seafood on the Riva',
          detail:
            'Harborfront promenade lined with places for grilled fish and wine.'
        }
      ],
      nightlife: [
        {
          title: 'Old town bars',
          detail:
            'Streets and courtyards that fill up after sundown.'
        }
      ],
      nature: [
        {
          title: 'Marjan hill & beaches',
          detail:
            'Forest park with walking paths and swimming spots close to town.'
        }
      ]
    }
  },
  {
    country: 'Croatia',
    name: 'Dubrovnik',
    lat: 42.6507,
    lng: 18.0944,
    pop: '~40K',
    summary:
      'Fortified coastal city with dramatic walls and views over the Adriatic.',
    tags: ['historical', 'food', 'nature'],
    experiences: {
      historical: [
        {
          title: 'City walls walk',
          detail:
            'Loop around the old town for views of terracotta roofs and sea cliffs.'
        }
      ],
      food: [
        {
          title: 'Sea-view terraces',
          detail:
            'Restaurants and bars perched on the rocks outside the walls.'
        }
      ],
      nature: [
        {
          title: 'Lokrum Island',
          detail:
            'Short boat ride to a quiet island with walking paths and swimming spots.'
        }
      ]
    }
  }
];

// --- cities endpoint (used by the globe frontend) ---
app.get('/api/cities', (_req, res) => res.json(cities));

// --- server-side Google Geocoding proxy ---
app.get('/api/geocode', async (req, res) => {
  try {
    if (!GOOGLE_KEY) {
      return res.status(500).json({ error: 'GOOGLE_MAPS_KEY missing on server' });
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
      return res.status(404).json({ error: `Geocoding failed: ${data.status}` });
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
      return res.status(500).json({ error: 'OPENWEATHER_KEY missing on server' });
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
});
