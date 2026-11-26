import React, { useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Plus, Search, X } from 'lucide-react';
import { GYERYONG_CENTER } from '../data/gyeryongVendors';
import type { Vendor } from '../types/vendor';
import { inferDistrictFromAddress } from '../utils/geo';
import { isQuotaError, notifyQuotaExceeded } from '../utils/mapsGeocoder';

interface PlacesDiscoveryModalProps {
  isOpen: boolean;
  existingVendors: Vendor[];
  onClose: () => void;
  onImportVendors: (newVendors: Vendor[]) => void;
}

interface DiscoveredPlace {
  placeId: string;
  name: string;
  address: string;
  phone?: string;
  lat: number;
  lng: number;
  alreadyExists: boolean;
}

const PRESET_QUERIES = [
  '계룡시 엄사면 편의점',
  '계룡시 금암동 편의점',
  '계룡시 두마면 마트',
  '계룡시 신도안면 마트',
];

export const PlacesDiscoveryModal: React.FC<PlacesDiscoveryModalProps> = ({
  isOpen,
  existingVendors,
  onClose,
  onImportVendors,
}) => {
  const placesLib = useMapsLibrary('places');
  const [query, setQuery] = useState('계룡시 편의점');
  const [results, setResults] = useState<DiscoveredPlace[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const runSearch = async (searchQuery: string) => {
    if (!placesLib?.Place) {
      setErrorMsg('Google Maps Places 라이브러리가 아직 준비되지 않았습니다.');
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);
    try {
      const { places } = await placesLib.Place.searchByText({
        textQuery: searchQuery.includes('계룡')
          ? searchQuery
          : `충청남도 계룡시 ${searchQuery}`,
        fields: [
          'id',
          'displayName',
          'formattedAddress',
          'location',
          'nationalPhoneNumber',
        ],
        language: 'ko',
        region: 'KR',
        locationBias: {
          center: GYERYONG_CENTER,
          radius: 10000,
        },
        maxResultCount: 12,
      });

      const mapped: DiscoveredPlace[] = (places || [])
        .filter((p) => p.location && p.displayName)
        .map((p) => {
          const name = p.displayName || '';
          const address = p.formattedAddress || '';
          const alreadyExists = existingVendors.some(
            (v) => v.placeId === p.id || v.name === name
          );
          return {
            placeId: p.id,
            name,
            address,
            phone: p.nationalPhoneNumber || undefined,
            lat: p.location!.lat(),
            lng: p.location!.lng(),
            alreadyExists,
          };
        });

      setResults(mapped);
      const nextSel: Record<string, boolean> = {};
      mapped.forEach((m) => {
        if (!m.alreadyExists) nextSel[m.placeId] = true;
      });
      setSelectedIds(nextSel);

      if (mapped.length === 0) {
        setErrorMsg('검색된 계룡시 매장이 없습니다.');
      }
    } catch (err) {
      if (isQuotaError(err)) {
        notifyQuotaExceeded();
      } else {
        setErrorMsg('Google 지도 매장 검색 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportSelected = () => {
    const chosen = results.filter((r) => selectedIds[r.placeId] && !r.alreadyExists);
    if (chosen.length === 0) return;

    const newVendors: Vendor[] = chosen.map((r) => {
      const isConvenience =
        r.name.includes('GS25') ||
        r.name.includes('CU') ||
        r.name.includes('세븐일레븐') ||
        r.name.includes('이마트24');

      return {
        id: `gp-${r.placeId}`,
        name: r.name,
        category: isConvenience ? '편의점' : '마트·슈퍼',
        district: inferDistrictFromAddress(r.address),
        roadAddress: r.address.replace(/^대한민국\s*/, ''),
        phone: r.phone,
        hours: isConvenience ? '24시간 운영' : undefined,
        bulkySticker: false,
        foodTag: true,
        volumeBag: true,
        status: '영업중',
        notes: 'Google 지도 검색을 통해 추가됨 (취급 품목 확인 필요)',
        lat: r.lat,
        lng: r.lng,
        placeId: r.placeId,
        geocodedAt: Date.now(),
        source: 'google_places',
      };
    });

    onImportVendors(newVendors);
    onClose();
  };

  const selectedCount = results.filter(
    (r) => selectedIds[r.placeId] && !r.alreadyExists
  ).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="places-discovery-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-xl">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div>
            <h2 id="places-discovery-title" className="text-base font-bold text-[#0F2942]">
              Google 지도에서 계룡시 매장 불러오기
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              계룡시 관내 실제 마트·편의점을 검색하여 판매소 목록에 추가할 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 border-b border-slate-100 space-y-3 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runSearch(query);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="예: 계룡시 엄사면 마트, 계룡시 금암동 편의점"
                className="w-full h-10 pl-9 pr-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F766E]"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="h-10 px-4 text-sm font-semibold text-white bg-[#0F766E] hover:bg-[#0D625B] rounded-lg whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              {isLoading ? '검색 중...' : '매장 검색'}
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {PRESET_QUERIES.map((pq) => (
              <button
                key={pq}
                type="button"
                onClick={() => {
                  setQuery(pq);
                  void runSearch(pq);
                }}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
              >
                {pq}
              </button>
            ))}
          </div>

          {errorMsg && (
            <p role="alert" className="text-xs font-medium text-red-700">
              {errorMsg}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {results.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              검색어를 입력하거나 상단 추천 검색어를 클릭해 매장을 불러오세요.
            </div>
          ) : (
            results.map((item) => (
              <label
                key={item.placeId}
                className={`flex items-start gap-3 px-5 py-3.5 text-sm ${
                  item.alreadyExists
                    ? 'bg-slate-50 opacity-60 cursor-not-allowed'
                    : 'hover:bg-slate-50 cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={item.alreadyExists}
                  checked={Boolean(selectedIds[item.placeId])}
                  onChange={(e) =>
                    setSelectedIds((prev) => ({
                      ...prev,
                      [item.placeId]: e.target.checked,
                    }))
                  }
                  className="mt-1 w-4 h-4 accent-[#0F766E]"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{item.name}</span>
                    {item.alreadyExists && (
                      <span className="text-xs text-slate-500">이미 등록됨</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{item.address}</p>
                  {item.phone && (
                    <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                      {item.phone}
                    </p>
                  )}
                </div>
              </label>
            ))
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-600 tabular-nums">
            선택된 신규 매장 {selectedCount}개
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleImportSelected}
              disabled={selectedCount === 0}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#0F2942] hover:bg-[#163A5C] rounded-lg inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              목록에 추가 ({selectedCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
