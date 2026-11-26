import React, { useCallback, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { LocateFixed, MapPin, Search, X } from 'lucide-react';
import { GYERYONG_QUICK_PRESETS } from '../data/gyeryongVendors';
import { useAutocompleteSuggestions } from '../hooks/useAutocompleteSuggestions';
import type { CitizenLocation } from '../types/vendor';
import { isQuotaError, notifyQuotaExceeded, resolveAddressCoords } from '../utils/mapsGeocoder';

interface AddressSearchBarProps {
  citizenLocation: CitizenLocation | null;
  onSelectLocation: (location: CitizenLocation) => void;
  onClearLocation: () => void;
}

const DEFENSE_BANNER_SRC = '/src/assets/images/gyeryong_defense_banner_1795669450013.jpg';

export const AddressSearchBar: React.FC<AddressSearchBarProps> = ({
  citizenLocation,
  onSelectLocation,
  onClearLocation,
}) => {
  const placesLib = useMapsLibrary('places');
  const [inputValue, setInputValue] = useState(citizenLocation?.address || '');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { suggestions, isLoading: isSuggestLoading, resetSession } =
    useAutocompleteSuggestions(inputValue);

  const handleSuggestionClick = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      if (!suggestion.placePrediction) return;
      setErrorMsg(null);
      setIsSearching(true);
      setDropdownOpen(false);

      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['id', 'location', 'formattedAddress', 'displayName'],
        });

        resetSession();

        if (!place.location) {
          setErrorMsg('선택한 장소의 위치 좌표를 확인할 수 없습니다.');
          return;
        }

        const formatted =
          place.formattedAddress ||
          place.displayName ||
          suggestion.placePrediction.text.text;

        setInputValue(formatted);
        onSelectLocation({
          label: place.displayName || formatted,
          address: formatted,
          lat: place.location.lat(),
          lng: place.location.lng(),
          placeId: place.id,
        });
      } catch (err) {
        if (isQuotaError(err)) {
          notifyQuotaExceeded();
        } else {
          setErrorMsg('주소 정보를 불러오는 중 오류가 발생했습니다.');
        }
      } finally {
        setIsSearching(false);
      }
    },
    [onSelectLocation, resetSession]
  );

  const handleManualSearch = useCallback(
    async (queryText: string, customLabel?: string) => {
      const trimmed = queryText.trim();
      if (!trimmed) {
        setErrorMsg('거주지 도로명 또는 지번 주소를 입력해 주세요.');
        return;
      }

      setErrorMsg(null);
      setDropdownOpen(false);
      setIsSearching(true);

      try {
        const result = await resolveAddressCoords(trimmed, placesLib);
        resetSession();

        if (!result) {
          setErrorMsg(
            '입력하신 주소를 찾을 수 없습니다. 예: 충남 계룡시 엄사면 번영로 47'
          );
          return;
        }

        setInputValue(result.formattedAddress);
        onSelectLocation({
          label: customLabel || trimmed,
          address: result.formattedAddress,
          lat: result.lat,
          lng: result.lng,
          placeId: result.placeId,
        });
      } finally {
        setIsSearching(false);
      }
    },
    [onSelectLocation, placesLib, resetSession]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleManualSearch(inputValue);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg('이 브라우저에서는 위치 정보 기능을 지원하지 않습니다.');
      return;
    }

    setErrorMsg(null);
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setInputValue(`현재 위치 (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
        onSelectLocation({
          label: '내 현재 위치',
          address: `위도 ${lat.toFixed(5)}, 경도 ${lng.toFixed(5)}`,
          lat,
          lng,
        });
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
        setErrorMsg(
          '현재 위치 권한이 허용되지 않았습니다. 아래 주소를 직접 입력해 주세요.'
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleClear = () => {
    setInputValue('');
    setErrorMsg(null);
    setDropdownOpen(false);
    resetSession();
    onClearLocation();
  };

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl border border-[#B48A3E]/35 bg-gradient-to-br from-[#0B1F3A] via-[#102A4C] to-[#13382E] text-white"
    >
      {/* Background image layer clipped independently so autocomplete dropdown is never clipped */}
      <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
        {!bannerError && (
          <img
            src={DEFENSE_BANNER_SRC}
            alt="국방수도 계룡시 전경"
            referrerPolicy="no-referrer"
            onError={() => setBannerError(true)}
            className="w-full h-full object-cover object-center opacity-40"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0B1F3A]/95 via-[#0B1F3A]/85 to-[#0B1F3A]/75" />
      </div>

      <div className="relative z-10 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-xs font-semibold text-[#E2C27D] tracking-wide">
              대한민국 국방수도 계룡시 · 생활폐기물 지정판매소 통합 조회
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight text-balance mt-1">
              거주지 주소 기반 가까운 판매소 3곳 즉시 추천
            </h1>
            <p className="text-xs sm:text-sm text-slate-200 mt-1 max-w-2xl">
              살고 계신 도로명·지번 주소를 입력하시면 대형폐기물 스티커와 음식물 납부필증 판매소 중 가장 가까운 3곳과 이동 경로를 바로 안내합니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {GYERYONG_QUICK_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setInputValue(preset.query);
                  void handleManualSearch(preset.query, preset.label);
                }}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-100 bg-white/10 hover:bg-white/20 border border-white/15 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="relative flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setDropdownOpen(true);
                setErrorMsg(null);
              }}
              onFocus={() => setDropdownOpen(true)}
              placeholder="예: 충남 계룡시 금암동 장안로 46, 엄사면 번영로 47, 두마면 사계로..."
              aria-label="거주지 주소 입력"
              className="w-full h-11 pl-10 pr-10 text-sm text-slate-900 bg-white border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C59B47] transition-colors"
            />
            {inputValue && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="입력 주소 지우기"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {dropdownOpen && (suggestions.length > 0 || isSuggestLoading) && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-lg shadow-xl z-30 max-h-64 overflow-y-auto">
                {isSuggestLoading && suggestions.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-slate-500">
                    주소 자동완성 검색 중...
                  </div>
                ) : (
                  <ul>
                    {suggestions.map((suggestion, idx) => {
                      const text = suggestion.placePrediction?.text.text;
                      if (!text) return null;
                      return (
                        <li key={`${text}-${idx}`}>
                          <button
                            type="button"
                            onClick={() => void handleSuggestionClick(suggestion)}
                            className="w-full text-left px-4 py-2.5 text-sm text-slate-800 hover:bg-slate-50 flex items-center gap-2.5 border-b border-slate-100 last:border-b-0 cursor-pointer"
                          >
                            <MapPin className="w-4 h-4 text-[#1E4D3B] shrink-0" aria-hidden="true" />
                            <span className="truncate">{text}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={isLocating || isSearching}
              className="h-11 px-3.5 text-xs sm:text-sm font-medium text-white bg-white/10 border border-white/25 hover:bg-white/20 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <LocateFixed className="w-4 h-4 text-[#E2C27D]" aria-hidden="true" />
              {isLocating ? '확인 중...' : '현재 위치'}
            </button>

            <button
              type="submit"
              disabled={isSearching}
              className="h-11 px-5 text-xs sm:text-sm font-bold text-[#0B1F3A] bg-[#C59B47] hover:bg-[#D4AE5F] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              {isSearching ? '추천 계산 중...' : '가까운 3곳 찾기'}
            </button>
          </div>
        </form>

        {errorMsg && (
          <p role="alert" className="mt-2.5 text-xs font-medium text-amber-200">
            {errorMsg}
          </p>
        )}
      </div>
    </div>
  );
};
