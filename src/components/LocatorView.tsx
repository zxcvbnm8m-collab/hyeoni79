import React, { useEffect, useMemo, useState } from 'react';
import { Clock, ExternalLink, MapPin, Navigation, Phone } from 'lucide-react';
import { DISTRICTS } from '../data/gyeryongVendors';
import type {
  CitizenLocation,
  District,
  ProductFilter,
  RouteSummary,
  TravelMode,
  Vendor,
  VendorWithDistance,
} from '../types/vendor';
import { formatDistance, formatDurationMillis } from '../utils/geo';
import { findNearestVendors } from '../utils/vendorSearch';
import { AddressSearchBar } from './AddressSearchBar';
import { VendorMap } from './VendorMap';

interface LocatorViewProps {
  vendors: Vendor[];
  citizenLocation: CitizenLocation | null;
  isGeocodingBatch: boolean;
  geocodedCount: number;
  onSelectLocation: (loc: CitizenLocation) => void;
  onClearLocation: () => void;
  onSwitchToManage: () => void;
}

export const LocatorView: React.FC<LocatorViewProps> = ({
  vendors,
  citizenLocation,
  isGeocodingBatch,
  geocodedCount,
  onSelectLocation,
  onClearLocation,
  onSwitchToManage,
}) => {
  const [productFilter, setProductFilter] = useState<ProductFilter>('all');
  const [districtFilter, setDistrictFilter] = useState<District | 'all'>('all');
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>('WALKING');
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);

  const { topRecommended, allRanked } = useMemo(
    () =>
      findNearestVendors(vendors, citizenLocation, {
        productFilter,
        districtFilter,
        limit: 3,
      }),
    [vendors, citizenLocation, productFilter, districtFilter]
  );

  const top3Ids = useMemo(
    () => topRecommended.map((v) => v.id),
    [topRecommended]
  );

  const otherRanked = useMemo(() => {
    if (!citizenLocation || topRecommended.length === 0) return allRanked;
    const topSet = new Set(top3Ids);
    return allRanked.filter((v) => !topSet.has(v.id));
  }, [citizenLocation, topRecommended.length, top3Ids, allRanked]);

  // Auto-select #1 nearest vendor when citizen location or filter changes
  useEffect(() => {
    if (citizenLocation && topRecommended.length > 0) {
      setSelectedVendorId(topRecommended[0].id);
    } else if (!citizenLocation && allRanked.length > 0) {
      if (!selectedVendorId || !allRanked.some((v) => v.id === selectedVendorId)) {
        setSelectedVendorId(allRanked[0].id);
      }
    } else if (allRanked.length === 0) {
      setSelectedVendorId(null);
    }
  }, [citizenLocation?.lat, citizenLocation?.lng, topRecommended, allRanked]);

  const productTabs: Array<{ id: ProductFilter; label: string }> = [
    { id: 'all', label: '전체 품목' },
    { id: 'bulkySticker', label: '대형폐기물 스티커' },
    { id: 'foodTag', label: '음식물 납부필증' },
    { id: 'volumeBag', label: '종량제봉투' },
  ];

  const renderHandledItems = (v: Vendor) => {
    const items: string[] = [];
    if (v.bulkySticker) items.push('대형폐기물 스티커');
    if (v.foodTag) items.push('음식물 납부필증');
    if (v.volumeBag) items.push('종량제봉투');
    return items.join(' · ') || '취급 품목 미지정';
  };

  const buildExternalMapUrl = (v: VendorWithDistance) => {
    const dest =
      typeof v.lat === 'number' && typeof v.lng === 'number'
        ? `${v.lat},${v.lng}`
        : encodeURIComponent(v.roadAddress);
    const originParam = citizenLocation
      ? `&origin=${citizenLocation.lat},${citizenLocation.lng}`
      : '';
    return `https://www.google.com/maps/dir/?api=1${originParam}&destination=${dest}&travelmode=${
      travelMode === 'WALKING' ? 'walking' : 'driving'
    }`;
  };

  return (
    <div className="space-y-4">
      <AddressSearchBar
        citizenLocation={citizenLocation}
        onSelectLocation={onSelectLocation}
        onClearLocation={onClearLocation}
      />

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="tablist"
            aria-label="취급 품목 필터"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            {productTabs.map((tab) => {
              const active = productFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setProductFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#0B1F3A] text-white font-semibold shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div
            role="tablist"
            aria-label="행정구역 필터"
            className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            <button
              type="button"
              onClick={() => setDistrictFilter('all')}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                districtFilter === 'all'
                  ? 'bg-white text-[#0B1F3A] font-semibold shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              계룡시 전체
            </button>
            {DISTRICTS.map((dist) => (
              <button
                key={dist}
                type="button"
                onClick={() => setDistrictFilter(dist)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  districtFilter === dist
                    ? 'bg-white text-[#0B1F3A] font-semibold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {dist}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between lg:justify-end gap-4 text-xs text-slate-600">
          {isGeocodingBatch && (
            <span className="tabular-nums text-[#1E4D3B] font-medium">
              판매소 위치 확인 중 ({geocodedCount}/{vendors.length})
            </span>
          )}
          <span className="tabular-nums">
            검색 결과 <strong className="text-[#0B1F3A]">{allRanked.length}</strong>개소
          </span>
          <button
            type="button"
            onClick={onSwitchToManage}
            className="text-[#1E4D3B] hover:underline font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            업소 리스트 관리
          </button>
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-[450px_1fr] gap-4 items-stretch lg:h-[680px]">
        {/* Left Ranked List with Top 3 Recommendation Section */}
        <section
          aria-label="가까운 판매소 추천 목록"
          className="bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden h-[560px] lg:h-full"
        >
          {citizenLocation && topRecommended.length > 0 ? (
            <div className="bg-[#F8FAFC] border-b border-slate-200 shrink-0">
              <div className="px-4 py-2.5 bg-[#0B1F3A] text-white flex items-center justify-between gap-2">
                <span className="text-xs font-bold tracking-wide">
                  가까운 추천 판매소 TOP 3
                </span>
                <span className="text-[11px] text-[#E2C27D] truncate max-w-[210px]">
                  기준: {citizenLocation.label}
                </span>
              </div>

              <div className="divide-y divide-slate-200">
                {topRecommended.map((vendor, idx) => {
                  const isSelected = vendor.id === selectedVendorId;
                  const hasRoute = routeSummary && routeSummary.vendorId === vendor.id;
                  const rankNum = idx + 1;
                  const rankAccent =
                    rankNum === 1
                      ? 'text-[#9A7228]'
                      : rankNum === 2
                      ? 'text-[#1E4D3B]'
                      : 'text-[#0B1F3A]';

                  return (
                    <div
                      key={vendor.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedVendorId(vendor.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedVendorId(vendor.id);
                        }
                      }}
                      className={`px-4 py-3 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#0B1F3A] ${
                        isSelected
                          ? 'bg-[#FDF9F0]'
                          : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className={`font-mono-tabular font-bold ${rankAccent}`}>
                              {String(rankNum).padStart(2, '0')}순위
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{vendor.district}</span>
                            <span aria-hidden="true">·</span>
                            <span>{vendor.category}</span>
                          </div>
                          <h2 className="text-sm font-bold text-[#0B1F3A] mt-0.5 truncate">
                            {vendor.name}
                          </h2>
                          <p className="text-xs text-slate-600 mt-0.5 truncate">
                            {vendor.roadAddress}
                          </p>
                          <p className="text-[11px] font-medium text-[#1E4D3B] mt-1 truncate">
                            {renderHandledItems(vendor)}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <div className={`text-sm font-bold font-mono-tabular ${rankAccent}`}>
                            {hasRoute
                              ? formatDistance(routeSummary.distanceMeters)
                              : formatDistance(vendor.straightMeters)}
                          </div>
                          <div className="text-[11px] text-slate-500 tabular-nums">
                            {hasRoute
                              ? `${
                                  routeSummary.travelMode === 'WALKING' ? '도보' : '차량'
                                } ${formatDurationMillis(routeSummary.durationMillis)}`
                              : '직선거리'}
                          </div>
                          <a
                            href={buildExternalMapUrl(vendor)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#0B1F3A] hover:underline"
                          >
                            길찾기
                            <ExternalLink className="w-3 h-3" aria-hidden="true" />
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="px-4 py-3 bg-[#0B1F3A]/5 border-b border-slate-200 shrink-0 text-xs text-slate-700">
              상단에 거주지 주소를 입력하시면 가장 가까운 판매소 3곳을 즉시 추천해 드립니다.
            </div>
          )}

          {/* Remaining Ranked Vendors */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {allRanked.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-medium text-slate-800">
                  조건에 맞는 판매소가 없습니다.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  품목 또는 행정구역 필터를 변경하거나 새 판매소를 등록해 주세요.
                </p>
              </div>
            ) : (
              otherRanked.map((vendor, index) => {
                const isSelected = vendor.id === selectedVendorId;
                const displayIndex = citizenLocation
                  ? topRecommended.length + index + 1
                  : index + 1;
                const rankLabel = String(displayIndex).padStart(2, '0');
                const hasRoute =
                  routeSummary && routeSummary.vendorId === vendor.id;

                return (
                  <div
                    key={vendor.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedVendorId(vendor.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedVendorId(vendor.id);
                      }
                    }}
                    className={`p-3.5 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#0B1F3A] ${
                      isSelected ? 'bg-slate-50' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-mono-tabular font-semibold text-[#0B1F3A]">
                            {rankLabel}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{vendor.district}</span>
                          <span aria-hidden="true">·</span>
                          <span>{vendor.category}</span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 mt-0.5 truncate">
                          {vendor.name}
                        </h3>
                      </div>

                      <div className="text-right shrink-0">
                        {citizenLocation && typeof vendor.straightMeters === 'number' ? (
                          <div>
                            <div className="text-sm font-bold text-[#1E4D3B] font-mono-tabular">
                              {hasRoute
                                ? formatDistance(routeSummary.distanceMeters)
                                : formatDistance(vendor.straightMeters)}
                            </div>
                            <div className="text-[11px] text-slate-500 tabular-nums">
                              {hasRoute
                                ? `${
                                    routeSummary.travelMode === 'WALKING' ? '도보' : '차량'
                                  } ${formatDurationMillis(routeSummary.durationMillis)}`
                                : '직선거리'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">
                            {typeof vendor.lat === 'number' ? '지도 표시' : '좌표 확인중'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-1.5 space-y-1 text-xs text-slate-600">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" aria-hidden="true" />
                        <span>{vendor.roadAddress}</span>
                      </div>
                      {(vendor.phone || vendor.hours) && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500">
                          {vendor.phone && (
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <Phone className="w-3 h-3" aria-hidden="true" />
                              {vendor.phone}
                            </span>
                          )}
                          {vendor.hours && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" aria-hidden="true" />
                              {vendor.hours}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                      <span className="text-slate-700 font-medium truncate">
                        {renderHandledItems(vendor)}
                      </span>
                      <a
                        href={buildExternalMapUrl(vendor)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[#1E4D3B] hover:underline font-medium shrink-0"
                      >
                        <Navigation className="w-3 h-3" aria-hidden="true" />
                        길찾기
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Right Interactive Google Map */}
        <section aria-label="판매소 위치 지도" className="h-[520px] lg:h-full">
          <VendorMap
            vendors={allRanked}
            top3Ids={top3Ids}
            citizenLocation={citizenLocation}
            selectedVendorId={selectedVendorId}
            travelMode={travelMode}
            routeSummary={routeSummary}
            onTravelModeChange={setTravelMode}
            onSelectVendor={setSelectedVendorId}
            onRouteComputed={setRouteSummary}
          />
        </section>
      </div>
    </div>
  );
};
