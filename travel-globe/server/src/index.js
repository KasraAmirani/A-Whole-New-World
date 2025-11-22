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
      <p>Server is running on <code>http://localhost:${PORT}</code></p>
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

// --- your 4 prototype cities with tags & experiences (no external links) ---
const cities = [
  {
    country: 'Ireland',
    name: 'Dublin',
    lat: 53.3498,
    lng: -6.2603,
    pop: '~1.2M',
    summary:
      'A compact, walkable capital mixing Georgian streets, pub culture and easy day trips to the sea and hills.',
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
          title: 'Acropolis & Parthenon at opening time',
          detail:
            'Go at opening to avoid the biggest crowds and heat; walk down via the Ancient Agora and Plaka.'
        },
        {
          title: 'Acropolis Museum',
          detail:
            'Pair it with your Acropolis visit – calm, well-curated and great to escape the midday sun.'
        }
      ],
      food: [
        {
          title: 'Tavernas in Plaka & Psiri',
          detail:
            'Share lots of small plates: grilled octopus, fava, salads and local wine. Eat late, like locals.'
        },
        {
          title: 'Central Market exploration',
          detail:
            'Browse spice shops and small bakeries around the market for sweet and savory snacks.'
        }
      ],
      nightlife: [
        {
          title: 'Rooftop bars with Acropolis view',
          detail:
            'Find a terrace near Monastiraki for golden-hour drinks and blue-hour city lights.'
        },
        {
          title: 'Gazi district',
          detail:
            'Nightlife area with bars and clubs; good if you want a louder, later night out.'
        }
      ],
      nature: [
        {
          title: 'Mount Lycabettus',
          detail:
            'Hike or take the funicular up for sunset; stay to watch the city lights switch on below.'
        },
        {
          title: 'Coastal tram to the sea',
          detail:
            'Ride out toward the Athenian Riviera and walk a stretch of the coast for a breeze and a swim in season.'
        }
      ]
    }
  },
  {
    country: 'Denmark',
    name: 'Copenhagen',
    lat: 55.6761,
    lng: 12.5683,
    pop: '~0.8M',
    summary:
      'A bike-first, waterfront city with design museums, cozy cafés and relaxed parks and canals.',
    tags: ['historical', 'food', 'nightlife', 'nature'],
    experiences: {
      historical: [
        {
          title: 'Rosenborg Castle & King’s Garden',
          detail:
            'Stroll through the gardens to the castle, then explore the crown jewels and interiors.'
        },
        {
          title: 'Christiansborg & old harbor',
          detail:
            'Combine a visit to Christiansborg Palace with a walk along the older harborside streets.'
        }
      ],
      food: [
        {
          title: 'Smørrebrød lunch',
          detail:
            'Find a traditional spot for open-faced sandwiches piled with fish, meat or veggie toppings.'
        },
        {
          title: 'Coffee & pastries',
          detail:
            'Cafés double as hangout spots; try cardamom buns or cinnamon rolls between explorations.'
        }
      ],
      nightlife: [
        {
          title: 'Canal-side bars in Nyhavn / Christianshavn',
          detail:
            'Sit by the water in warmer months; be ready for high prices but very relaxed vibes.'
        },
        {
          title: 'Craft beer & wine bars',
          detail:
            'Look for small natural-wine bars or microbreweries dotted across Nørrebro and Vesterbro.'
        }
      ],
      nature: [
        {
          title: 'Bike tour of lakes & parks',
          detail:
            'Follow the city lakes, then loop through parks like Fælledparken for a green circuit on two wheels.'
        },
        {
          title: 'Harbour baths',
          detail:
            'In summer, swim in designated harbor baths for a quick, very local reset.'
        }
      ]
    }
  },
  {
    country: 'Croatia',
    name: 'Zagreb',
    lat: 45.8150,
    lng: 15.9819,
    pop: '~0.8M',
    summary:
      'Central European feel with café culture, small museums and easy escapes to hills and lakes nearby.',
    tags: ['historical', 'food', 'nightlife', 'nature'],
    experiences: {
      historical: [
        {
          title: 'Upper Town walk',
          detail:
            'Ride the funicular or walk up to the old town for St. Mark’s Church, narrow streets and city views.'
        },
        {
          title: 'Museum stop (e.g. Broken Relationships)',
          detail:
            'Mix in at least one small museum for a deeper, more personal sense of the city.'
        }
      ],
      food: [
        {
          title: 'Dolac Market & nearby eateries',
          detail:
            'Browse the produce market in the morning, then grab lunch at one of the nearby restaurants.'
        },
        {
          title: 'Café culture along Ilica and Tkalčićeva',
          detail:
            'Sit outside with coffee or a drink and people-watch; this is a big part of local daily life.'
        }
      ],
      nightlife: [
        {
          title: 'Bars in the Lower Town',
          detail:
            'Explore side streets for smaller bars and live music; many spots feel more like living rooms than clubs.'
        }
      ],
      nature: [
        {
          title: 'Maksimir Park',
          detail:
            'Large park with lakes and walking paths; great for a slow morning or evening walk.'
        },
        {
          title: 'Day trip to Medvednica',
          detail:
            'Head into the nearby hills for hiking and views back over the city on clear days.'
        }
      ]
    }
  }
];

app.get('/api/cities', (_req, res) => res.json(cities));

// --- server-side Google Geocoding proxy (still here if you want it later) ---
app.get('/api/geocode', async (req, res) => {
  try {
    if (!GOOGLE_KEY) {
      return res.status(500).json({ error: 'GOOGLE_MAPS_KEY missing on server' });
    }
    const q = String(req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'Missing q parameter' });

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${GOOGLE_KEY}`;
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

app.listen(PORT, () => {
  console.log(`API ready on http://localhost:${PORT}`);
  console.log(`Allowed origin: ${ORIGIN}`);
});
