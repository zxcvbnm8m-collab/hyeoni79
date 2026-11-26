import type {
  CitizenLocation,
  District,
  ProductFilter,
  Vendor,
  VendorWithDistance,
} from '../types/vendor';
import { haversineDistanceMeters } from './geo';

export interface VendorSearchOptions {
  productFilter?: ProductFilter;
  districtFilter?: District | 'all';
  limit?: number;
}

export interface VendorRecommendationResult {
  topRecommended: VendorWithDistance[];
  allRanked: VendorWithDistance[];
  totalMatched: number;
}

/**
 * Filters active Gyeryong-si vendors and computes Haversine proximity
 * from the citizen's residential coordinates, returning the top N (default 3)
 * closest recommendations plus the full distance-sorted list.
 */
export function findNearestVendors(
  vendors: Vendor[],
  origin: CitizenLocation | null,
  options: VendorSearchOptions = {}
): VendorRecommendationResult {
  const {
    productFilter = 'all',
    districtFilter = 'all',
    limit = 3,
  } = options;

  const filtered = vendors.filter((vendor) => {
    if (vendor.status === '휴업') return false;
    if (districtFilter !== 'all' && vendor.district !== districtFilter) return false;
    if (productFilter === 'bulkySticker' && !vendor.bulkySticker) return false;
    if (productFilter === 'foodTag' && !vendor.foodTag) return false;
    if (productFilter === 'volumeBag' && !vendor.volumeBag) return false;
    return true;
  });

  const withDistances: VendorWithDistance[] = filtered.map((vendor) => {
    if (
      origin &&
      typeof vendor.lat === 'number' &&
      typeof vendor.lng === 'number'
    ) {
      return {
        ...vendor,
        straightMeters: haversineDistanceMeters(
          { lat: origin.lat, lng: origin.lng },
          { lat: vendor.lat, lng: vendor.lng }
        ),
      };
    }
    return { ...vendor };
  });

  if (origin) {
    withDistances.sort((a, b) => {
      const distA = a.straightMeters ?? Number.POSITIVE_INFINITY;
      const distB = b.straightMeters ?? Number.POSITIVE_INFINITY;
      return distA - distB;
    });
  }

  const topRecommended = origin
    ? withDistances
        .filter((v) => typeof v.straightMeters === 'number')
        .slice(0, limit)
    : [];

  return {
    topRecommended,
    allRanked: withDistances,
    totalMatched: withDistances.length,
  };
}
