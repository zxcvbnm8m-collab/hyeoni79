import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdvancedMarker,
  type AdvancedMarkerProps,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { ExternalLink, Navigation } from 'lucide-react';
import { GYERYONG_CENTER } from '../data/gyeryongVendors';
import type {
  CitizenLocation,
  RouteSummary,
  TravelMode,
  VendorWithDistance,
} from '../types/vendor';
import { formatDistance, formatDurationMillis } from '../utils/geo';
import { isQuotaError, notifyQuotaExceeded } from '../utils/mapsGeocoder';

const Z_INDEX_SELECTED = 1000;
const Z_INDEX_HOVER = 999;

interface AdvancedMarkerWithRefProps extends AdvancedMarkerProps {
  onMarkerClick: (marker: google.maps.marker.AdvancedMarkerElement) => void;
}

const AdvancedMarkerWithRef: React.FC<AdvancedMarkerWithRefProps> = ({
  children,
  onMarkerClick,
  ...advancedMarkerProps
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <AdvancedMarker
      ref={markerRef}
      onClick={() => {
        if (marker) {
          onMarkerClick(marker);
        }
      }}
      {...advancedMarkerProps}
    >
      {children}
    </AdvancedMarker>
  );
};

interface RouteOverlayProps {
  origin: CitizenLocation | null;
  destination: VendorWithDistance | null;
  travelMode: TravelMode;
  onRouteComputed: (summary: RouteSummary | null) => void;
}

const RouteOverlay: React.FC<RouteOverlayProps> = ({
  origin,
  destination,
  travelMode,
  onRouteComputed,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (
      !map ||
      !routesLib ||
      !origin ||
      !destination ||
      typeof destination.lat !== 'number' ||
      typeof destination.lng !== 'number'
    ) {
      onRouteComputed(null);
      return;
    }

    let cancelled = false;

    const request = {
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      travelMode,
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    };

    const RouteCls = (routesLib as unknown as {
      Route?: {
        computeRoutes: (req: unknown) => Promise<{
          routes?: Array<{
            createPolylines: () => google.maps.Polyline[];
            viewport?: google.maps.LatLngBounds;
            distanceMeters?: number;
            durationMillis?: number;
          }>;
        }>;
      };
    }).Route;

    if (!RouteCls?.computeRoutes) {
      return;
    }

    RouteCls.computeRoutes(request)
      .then(({ routes }) => {
        if (cancelled) return;
        const primaryRoute = routes?.[0];
        if (!primaryRoute) {
          onRouteComputed(null);
          return;
        }

        const newPolylines = primaryRoute.createPolylines();
        newPolylines.forEach((polyline) => {
          polyline.setOptions({
            strokeColor: travelMode === 'WALKING' ? '#1E4D3B' : '#0B1F3A',
            strokeWeight: 5,
            strokeOpacity: 0.92,
          });
          polyline.setMap(map);
        });
        polylinesRef.current = newPolylines;

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport, {
            top: 48,
            right: 48,
            bottom: 48,
            left: 48,
          });
        }

        onRouteComputed({
          vendorId: destination.id,
          distanceMeters: primaryRoute.distanceMeters ?? destination.straightMeters ?? 0,
          durationMillis: primaryRoute.durationMillis ?? 0,
          travelMode,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (isQuotaError(err)) {
          notifyQuotaExceeded();
        }
        onRouteComputed(null);
      });

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [
    map,
    routesLib,
    origin?.lat,
    origin?.lng,
    destination?.id,
    destination?.lat,
    destination?.lng,
    travelMode,
    onRouteComputed,
  ]);

  return null;
};

interface VendorMapProps {
  vendors: VendorWithDistance[];
  top3Ids: string[];
  citizenLocation: CitizenLocation | null;
  selectedVendorId: string | null;
  travelMode: TravelMode;
  routeSummary: RouteSummary | null;
  onTravelModeChange: (mode: TravelMode) => void;
  onSelectVendor: (vendorId: string) => void;
  onRouteComputed: (summary: RouteSummary | null) => void;
}

export const VendorMap: React.FC<VendorMapProps> = ({
  vendors,
  top3Ids,
  citizenLocation,
  selectedVendorId,
  travelMode,
  routeSummary,
  onTravelModeChange,
  onSelectVendor,
  onRouteComputed,
}) => {
  const map = useMap();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [activeMarker, setActiveMarker] =
    useState<google.maps.marker.AdvancedMarkerElement | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  const top3IndexMap = useMemo(() => {
    const lookup: Record<string, number> = {};
    top3Ids.forEach((id, idx) => {
      lookup[id] = idx + 1; // 1, 2, 3
    });
    return lookup;
  }, [top3Ids]);

  const mappableVendors = useMemo(() => {
    return vendors
      .filter(
        (v): v is VendorWithDistance & { lat: number; lng: number } =>
          typeof v.lat === 'number' && typeof v.lng === 'number'
      )
      .sort((a, b) => b.lat - a.lat)
      .map((v, idx) => ({ vendor: v, baseZIndex: idx }));
  }, [vendors]);

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === selectedVendorId) || null,
    [vendors, selectedVendorId]
  );

  // Center map when citizen location is set without an active selected vendor
  useEffect(() => {
    if (!map || !citizenLocation) return;
    if (!selectedVendor || typeof selectedVendor.lat !== 'number') {
      map.panTo({ lat: citizenLocation.lat, lng: citizenLocation.lng });
      map.setZoom(14);
    }
  }, [map, citizenLocation, selectedVendor]);

  // Center on clicked vendor if no citizen route is active
  useEffect(() => {
    if (
      !map ||
      !selectedVendor ||
      typeof selectedVendor.lat !== 'number' ||
      typeof selectedVendor.lng !== 'number'
    ) {
      return;
    }
    if (!citizenLocation) {
      map.panTo({ lat: selectedVendor.lat, lng: selectedVendor.lng });
      map.setZoom(15);
    }
  }, [map, selectedVendor, citizenLocation]);

  const handleMarkerClick = useCallback(
    (vendorId: string, marker: google.maps.marker.AdvancedMarkerElement) => {
      onSelectVendor(vendorId);
      setActiveMarker(marker);
      setInfoOpen(true);
    },
    [onSelectVendor]
  );

  const buildGoogleMapsDirUrl = (vendor: VendorWithDistance) => {
    const dest =
      typeof vendor.lat === 'number' && typeof vendor.lng === 'number'
        ? `${vendor.lat},${vendor.lng}`
        : encodeURIComponent(vendor.roadAddress);
    const originParam = citizenLocation
      ? `&origin=${citizenLocation.lat},${citizenLocation.lng}`
      : '';
    const modeParam = travelMode === 'WALKING' ? 'walking' : 'driving';
    return `https://www.google.com/maps/dir/?api=1${originParam}&destination=${dest}&travelmode=${modeParam}`;
  };

  return (
    <div className="relative w-full h-full min-h-[520px] bg-slate-100 rounded-xl border border-slate-200 overflow-hidden">
      <GoogleMap
        mapId="DEMO_MAP_ID"
        defaultCenter={GYERYONG_CENTER}
        defaultZoom={13}
        gestureHandling="greedy"
        streetViewControl={false}
        mapTypeControl={false}
        fullscreenControl={true}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%' }}
        onClick={() => setInfoOpen(false)}
      >
        <RouteOverlay
          origin={citizenLocation}
          destination={selectedVendor}
          travelMode={travelMode}
          onRouteComputed={onRouteComputed}
        />

        {citizenLocation && (
          <AdvancedMarker
            position={{ lat: citizenLocation.lat, lng: citizenLocation.lng }}
            title={`내 주소: ${citizenLocation.address}`}
            zIndex={1200}
          >
            <Pin
              background="#0B1F3A"
              borderColor="#C59B47"
              glyphColor="#FFFFFF"
              glyphText="집"
              scale={1.2}
            />
          </AdvancedMarker>
        )}

        {mappableVendors.map(({ vendor, baseZIndex }) => {
          const isSelected = vendor.id === selectedVendorId;
          const topRank = top3IndexMap[vendor.id];
          const isHovered = vendor.id === hoveredId;

          let zIndex = baseZIndex;
          if (topRank) zIndex = 960 - topRank;
          if (isHovered) zIndex = Z_INDEX_HOVER;
          if (isSelected) zIndex = Z_INDEX_SELECTED;

          let pinBg = '#475569';
          let borderColor = '#FFFFFF';
          if (vendor.category === '행정복지센터') pinBg = '#1D4ED8';
          else if (vendor.category === '아파트 관리사무소') pinBg = '#0369A1';
          if (topRank === 1) {
            pinBg = '#B48A3E';
            borderColor = '#0B1F3A';
          } else if (topRank === 2) {
            pinBg = '#1E4D3B';
          } else if (topRank === 3) {
            pinBg = '#0F2942';
          } else if (isSelected) {
            pinBg = '#1E4D3B';
          }

          return (
            <AdvancedMarkerWithRef
              key={vendor.id}
              position={{ lat: vendor.lat, lng: vendor.lng }}
              title={topRank ? `[추천 ${topRank}순위] ${vendor.name}` : vendor.name}
              zIndex={zIndex}
              onMouseEnter={() => setHoveredId(vendor.id)}
              onMouseLeave={() => setHoveredId(null)}
              onMarkerClick={(marker) => handleMarkerClick(vendor.id, marker)}
            >
              <Pin
                background={pinBg}
                borderColor={borderColor}
                glyphColor="#FFFFFF"
                glyphText={topRank ? String(topRank) : undefined}
                scale={isSelected || topRank === 1 ? 1.18 : topRank ? 1.08 : 0.92}
              />
            </AdvancedMarkerWithRef>
          );
        })}

        {infoOpen && activeMarker && selectedVendor && (
          <InfoWindow
            anchor={activeMarker}
            pixelOffset={[0, -4]}
            onCloseClick={() => setInfoOpen(false)}
          >
            <div className="p-1 max-w-[260px] text-slate-900">
              <div className="text-xs text-slate-500 mb-0.5">
                {top3IndexMap[selectedVendor.id]
                  ? `추천 ${top3IndexMap[selectedVendor.id]}순위 · `
                  : ''}
                {selectedVendor.district} · {selectedVendor.category}
              </div>
              <h3 className="text-sm font-bold text-[#0B1F3A]">
                {selectedVendor.name}
              </h3>
              <p className="text-xs text-slate-700 mt-1">
                {selectedVendor.roadAddress}
              </p>
              {selectedVendor.phone && (
                <p className="text-xs text-slate-600 mt-0.5 tabular-nums">
                  {selectedVendor.phone}
                </p>
              )}
              <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-700 space-y-0.5">
                <div>
                  취급:{' '}
                  {[
                    selectedVendor.bulkySticker ? '대형폐기물 스티커' : null,
                    selectedVendor.foodTag ? '음식물 납부필증' : null,
                    selectedVendor.volumeBag ? '종량제봉투' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || '취급 품목 확인 필요'}
                </div>
                {routeSummary && routeSummary.vendorId === selectedVendor.id && (
                  <div className="font-semibold text-[#1E4D3B] tabular-nums">
                    실제 이동거리 {formatDistance(routeSummary.distanceMeters)} · 약{' '}
                    {formatDurationMillis(routeSummary.durationMillis)}
                  </div>
                )}
              </div>
              <a
                href={buildGoogleMapsDirUrl(selectedVendor)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#1E4D3B] hover:underline"
              >
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
                Google 지도 길찾기
              </a>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Travel mode & route telemetry overlay */}
      <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
        <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-lg p-1 shadow-sm flex items-center gap-1">
          <button
            type="button"
            onClick={() => onTravelModeChange('WALKING')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              travelMode === 'WALKING'
                ? 'bg-[#1E4D3B] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            도보 경로
          </button>
          <button
            type="button"
            onClick={() => onTravelModeChange('DRIVING')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              travelMode === 'DRIVING'
                ? 'bg-[#0B1F3A] text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            차량 경로
          </button>
        </div>

        {citizenLocation && selectedVendor && routeSummary?.vendorId === selectedVendor.id && (
          <div className="bg-white/95 backdrop-blur border border-slate-200 rounded-lg px-3 py-2 shadow-sm text-xs text-slate-800 flex items-center gap-2">
            <Navigation className="w-3.5 h-3.5 text-[#1E4D3B] shrink-0" aria-hidden="true" />
            <span className="font-semibold truncate max-w-[160px] text-[#0B1F3A]">
              {selectedVendor.name}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-[#1E4D3B] tabular-nums">
              {formatDistance(routeSummary.distanceMeters)}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold tabular-nums">
              {formatDurationMillis(routeSummary.durationMillis)}
            </span>
          </div>
        )}
      </div>

      {/* Map legend */}
      <div className="absolute bottom-3 left-3 z-10 bg-white/95 backdrop-blur border border-slate-200 rounded-lg px-3 py-2 shadow-sm text-[11px] text-slate-700 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#0B1F3A] inline-block" aria-hidden="true" />
          내 주소
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#B48A3E] inline-block" aria-hidden="true" />
          추천 1순위
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#1E4D3B] inline-block" aria-hidden="true" />
          추천 2순위·선택
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#1D4ED8] inline-block" aria-hidden="true" />
          행정복지센터
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#0369A1] inline-block" aria-hidden="true" />
          아파트 관리사무소
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#475569] inline-block" aria-hidden="true" />
          기타 판매소
        </span>
      </div>
    </div>
  );
};
