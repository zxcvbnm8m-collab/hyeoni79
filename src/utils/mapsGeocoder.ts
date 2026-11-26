export interface GeocodeResult {
  lat: number;
  lng: number;
  placeId?: string;
  formattedAddress: string;
}

export function isQuotaError(err: unknown): boolean {
  const text = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  const upper = text.toUpperCase();
  return (
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('OVER_QUERY_LIMIT') ||
    upper.includes('OVER_DAILY_LIMIT') ||
    upper.includes('QUOTA') ||
    upper.includes('429')
  );
}

export function notifyQuotaExceeded(): void {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
}

/**
 * Resolves an address string into coordinates using the server-side Geocoding
 * REST proxy first, falling back to the Places API (New) JS SDK Place.searchByText
 * if needed. Returns null when no matching location is found.
 */
export async function resolveAddressCoords(
  address: string,
  placesLib?: google.maps.PlacesLibrary | null
): Promise<GeocodeResult | null> {
  const query = address.trim();
  if (!query) return null;

  try {
    const res = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: query }),
    });

    if (res.status === 429) {
      notifyQuotaExceeded();
      return null;
    }

    if (res.ok) {
      const data = (await res.json()) as {
        lat?: number;
        lng?: number;
        placeId?: string;
        formattedAddress?: string;
        fallbackToClientSdk?: boolean;
        quotaExceeded?: boolean;
      };

      if (data.quotaExceeded) {
        notifyQuotaExceeded();
        return null;
      }

      if (typeof data.lat === 'number' && typeof data.lng === 'number') {
        return {
          lat: data.lat,
          lng: data.lng,
          placeId: data.placeId,
          formattedAddress: data.formattedAddress || query,
        };
      }

      if (!data.fallbackToClientSdk) {
        return null;
      }
    } else if (res.status === 404) {
      // Try client Places Text Search fallback for Korean landmark/building queries
    }
  } catch (err) {
    if (isQuotaError(err)) {
      notifyQuotaExceeded();
      return null;
    }
  }

  // Fallback via official Places API (New) JS SDK Place.searchByText
  if (!placesLib?.Place) {
    return null;
  }

  try {
    const { places } = await placesLib.Place.searchByText({
      textQuery: query.includes('계룡') ? query : `충청남도 계룡시 ${query}`,
      fields: ['id', 'location', 'formattedAddress', 'displayName'],
      language: 'ko',
      region: 'KR',
      locationBias: {
        center: { lat: 36.2745, lng: 127.2486 },
        radius: 15000,
      },
      maxResultCount: 1,
    });

    const first = places?.[0];
    if (!first?.location) {
      return null;
    }

    return {
      lat: first.location.lat(),
      lng: first.location.lng(),
      placeId: first.id,
      formattedAddress: first.formattedAddress || first.displayName || query,
    };
  } catch (err) {
    if (isQuotaError(err)) {
      notifyQuotaExceeded();
    }
    return null;
  }
}
