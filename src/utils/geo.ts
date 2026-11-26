export interface LatLngLiteral {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_METERS = 6371000;

export function haversineDistanceMeters(a: LatLngLiteral, b: LatLngLiteral): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

export function formatDistance(meters?: number): string {
  if (meters === undefined || !Number.isFinite(meters)) return '-';
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatDurationMillis(millis?: number): string {
  if (millis === undefined || !Number.isFinite(millis)) return '-';
  const totalMinutes = Math.max(1, Math.round(millis / 60000));
  if (totalMinutes < 60) {
    return `${totalMinutes}분`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}시간` : `${hours}시간 ${minutes}분`;
}

export function inferDistrictFromAddress(address: string): '금암동' | '엄사면' | '두마면' | '신도안면' {
  if (address.includes('엄사')) return '엄사면';
  if (address.includes('두마') || address.includes('두계') || address.includes('왕대') || address.includes('농소')) {
    return '두마면';
  }
  if (address.includes('신도안') || address.includes('남선') || address.includes('부남') || address.includes('정장')) {
    return '신도안면';
  }
  return '금암동';
}
