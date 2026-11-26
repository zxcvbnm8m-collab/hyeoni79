export type District = '금암동' | '엄사면' | '두마면' | '신도안면';

export type VendorCategory =
  | '행정복지센터'
  | '아파트 관리사무소'
  | '마트·슈퍼'
  | '편의점'
  | '생활·문구';

export type VendorStatus = '영업중' | '재고확인' | '휴업';

export type ProductFilter = 'all' | 'bulkySticker' | 'foodTag' | 'volumeBag';

export type TravelMode = 'WALKING' | 'DRIVING';

export interface Vendor {
  id: string;
  name: string;
  category: VendorCategory;
  district: District;
  roadAddress: string;
  jibunAddress?: string;
  phone?: string;
  hours?: string;
  bulkySticker: boolean;
  foodTag: boolean;
  volumeBag: boolean;
  status: VendorStatus;
  notes?: string;
  lat?: number;
  lng?: number;
  placeId?: string;
  geocodedAt?: number;
  source: 'gyeryong_official' | 'google_places' | 'manual';
}

export interface VendorWithDistance extends Vendor {
  straightMeters?: number;
  routeMeters?: number;
  routeDurationMillis?: number;
}

export interface CitizenLocation {
  label: string;
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
}

export interface RouteSummary {
  vendorId: string;
  distanceMeters: number;
  durationMillis: number;
  travelMode: TravelMode;
}
