import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import type { Request, Response } from 'express';
import { INITIAL_GYERYONG_VENDORS } from './src/data/gyeryongVendors.ts';
import type { Vendor } from './src/types/vendor.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(__dirname, 'data');
const VENDORS_FILE = path.join(DATA_DIR, 'vendors.json');
const GEOCODE_CACHE_FILE = path.join(DATA_DIR, 'geocode-cache.json');
const SEED_META_FILE = path.join(DATA_DIR, 'seed-meta.json');
const CURRENT_SEED_VERSION = '2026-11-apt-300';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 consecutive calendar days per GMP ToS

interface GeocodeCacheEntry {
  lat: number;
  lng: number;
  placeId?: string;
  formattedAddress?: string;
  cachedAt: number;
}

function getMapsApiKey(): string {
  return (
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    ''
  ).trim();
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readGeocodeCache(): Record<string, GeocodeCacheEntry> {
  ensureDataDir();
  if (!fs.existsSync(GEOCODE_CACHE_FILE)) return {};
  try {
    const raw = fs.readFileSync(GEOCODE_CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, GeocodeCacheEntry>;
    const now = Date.now();
    const valid: Record<string, GeocodeCacheEntry> = {};
    for (const [k, entry] of Object.entries(parsed)) {
      if (entry && typeof entry.cachedAt === 'number' && now - entry.cachedAt < CACHE_TTL_MS) {
        valid[k] = entry;
      }
    }
    return valid;
  } catch {
    return {};
  }
}

function writeGeocodeCache(cache: Record<string, GeocodeCacheEntry>): void {
  ensureDataDir();
  fs.writeFileSync(GEOCODE_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
}

function readSeedVersion(): string | null {
  if (!fs.existsSync(SEED_META_FILE)) return null;
  try {
    const raw = fs.readFileSync(SEED_META_FILE, 'utf8');
    const parsed = JSON.parse(raw) as { seedVersion?: string };
    return typeof parsed.seedVersion === 'string' ? parsed.seedVersion : null;
  } catch {
    return null;
  }
}

function writeSeedVersion(version: string): void {
  ensureDataDir();
  fs.writeFileSync(SEED_META_FILE, JSON.stringify({ seedVersion: version }, null, 2), 'utf8');
}

function readVendors(): Vendor[] {
  ensureDataDir();
  let vendors: Vendor[] = INITIAL_GYERYONG_VENDORS;
  if (fs.existsSync(VENDORS_FILE)) {
    try {
      const raw = fs.readFileSync(VENDORS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        vendors = parsed as Vendor[];
      }
    } catch {
      vendors = INITIAL_GYERYONG_VENDORS;
    }

    if (readSeedVersion() !== CURRENT_SEED_VERSION) {
      const existingIds = new Set(vendors.map((v) => v.id));
      const newOfficialSeeds = INITIAL_GYERYONG_VENDORS.filter((v) => !existingIds.has(v.id));
      if (newOfficialSeeds.length > 0) {
        vendors = [...vendors, ...newOfficialSeeds];
        fs.writeFileSync(VENDORS_FILE, JSON.stringify(vendors, null, 2), 'utf8');
      }
      writeSeedVersion(CURRENT_SEED_VERSION);
    }
  } else {
    fs.writeFileSync(VENDORS_FILE, JSON.stringify(INITIAL_GYERYONG_VENDORS, null, 2), 'utf8');
    writeSeedVersion(CURRENT_SEED_VERSION);
  }

  const cache = readGeocodeCache();
  const now = Date.now();
  return vendors.map((v) => {
    const isCoordFresh =
      typeof v.lat === 'number' &&
      typeof v.lng === 'number' &&
      typeof v.geocodedAt === 'number' &&
      now - v.geocodedAt < CACHE_TTL_MS;

    if (isCoordFresh) return v;

    const cached = cache[v.roadAddress];
    if (cached) {
      return {
        ...v,
        lat: cached.lat,
        lng: cached.lng,
        placeId: v.placeId || cached.placeId,
        geocodedAt: cached.cachedAt,
      };
    }

    return {
      ...v,
      lat: undefined,
      lng: undefined,
      geocodedAt: undefined,
    };
  });
}

function writeVendors(vendors: Vendor[]): void {
  ensureDataDir();
  fs.writeFileSync(VENDORS_FILE, JSON.stringify(vendors, null, 2), 'utf8');

  const cache = readGeocodeCache();
  const now = Date.now();
  let cacheChanged = false;
  for (const v of vendors) {
    if (typeof v.lat === 'number' && typeof v.lng === 'number' && v.roadAddress) {
      cache[v.roadAddress] = {
        lat: v.lat,
        lng: v.lng,
        placeId: v.placeId,
        cachedAt: v.geocodedAt || now,
      };
      cacheChanged = true;
    }
  }
  if (cacheChanged) {
    writeGeocodeCache(cache);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/maps-config', (_req: Request, res: Response) => {
    res.json({ apiKey: getMapsApiKey() });
  });

  app.get('/api/vendors', (_req: Request, res: Response) => {
    res.json({ vendors: readVendors() });
  });

  app.put('/api/vendors', (req: Request, res: Response) => {
    const { vendors } = req.body as { vendors?: unknown };
    if (!Array.isArray(vendors)) {
      res.status(400).json({ error: 'vendors array is required' });
      return;
    }
    writeVendors(vendors as Vendor[]);
    res.json({ vendors: readVendors() });
  });

  app.post('/api/vendors/reset', (_req: Request, res: Response) => {
    writeVendors(INITIAL_GYERYONG_VENDORS);
    res.json({ vendors: readVendors() });
  });

  app.post('/api/geocode', async (req: Request, res: Response) => {
    const { address } = req.body as { address?: string };
    if (!address || typeof address !== 'string' || !address.trim()) {
      res.status(400).json({ error: 'address is required' });
      return;
    }

    const queryAddress = address.trim();
    const cache = readGeocodeCache();
    const cached = cache[queryAddress];
    if (cached) {
      res.json({
        lat: cached.lat,
        lng: cached.lng,
        placeId: cached.placeId,
        formattedAddress: cached.formattedAddress || queryAddress,
        cached: true,
      });
      return;
    }

    const apiKey = getMapsApiKey();
    if (!apiKey) {
      res.json({ fallbackToClientSdk: true, error: 'Missing server Maps API key' });
      return;
    }

    try {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      url.searchParams.set('address', queryAddress);
      url.searchParams.set('language', 'ko');
      url.searchParams.set('region', 'kr');
      url.searchParams.set('components', 'country:KR');
      url.searchParams.set('key', apiKey);

      const headers: Record<string, string> = {};
      const referer = req.headers.referer || req.headers.origin || process.env.APP_URL;
      if (typeof referer === 'string' && referer.length > 0) {
        headers['Referer'] = referer;
      }

      const response = await fetch(url.toString(), { headers });
      if (response.status === 429) {
        res.status(429).json({ error: 'RESOURCE_EXHAUSTED', quotaExceeded: true });
        return;
      }

      const data = (await response.json()) as {
        status: string;
        error_message?: string;
        results?: Array<{
          place_id?: string;
          formatted_address?: string;
          geometry?: { location?: { lat: number; lng: number } };
        }>;
      };

      if (data.status === 'OVER_QUERY_LIMIT' || data.status === 'OVER_DAILY_LIMIT') {
        res.status(429).json({ error: 'OVER_QUERY_LIMIT', quotaExceeded: true });
        return;
      }

      if (data.status === 'REQUEST_DENIED') {
        res.json({
          fallbackToClientSdk: true,
          error: data.error_message || 'REQUEST_DENIED',
        });
        return;
      }

      const top = data.results?.[0];
      const loc = top?.geometry?.location;
      if (data.status !== 'OK' || !loc) {
        res.status(404).json({ error: 'ZERO_RESULTS', status: data.status });
        return;
      }

      const entry: GeocodeCacheEntry = {
        lat: loc.lat,
        lng: loc.lng,
        placeId: top?.place_id,
        formattedAddress: top?.formatted_address || queryAddress,
        cachedAt: Date.now(),
      };
      cache[queryAddress] = entry;
      writeGeocodeCache(cache);

      res.json({
        lat: entry.lat,
        lng: entry.lng,
        placeId: entry.placeId,
        formattedAddress: entry.formattedAddress,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Geocoding proxy failed',
      });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
