import React, { useMemo, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  Download,
  FileJson,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Store,
  Trash2,
  Upload,
} from 'lucide-react';
import { DISTRICTS } from '../data/gyeryongVendors';
import type { District, ProductFilter, Vendor, VendorCategory } from '../types/vendor';
import { exportVendorsToCsv, parseGyeryongVendorCsv } from '../utils/csv';
import { resolveAddressCoords } from '../utils/mapsGeocoder';
import { PlacesDiscoveryModal } from './PlacesDiscoveryModal';

interface VendorManagementViewProps {
  vendors: Vendor[];
  onAddVendor: () => void;
  onEditVendor: (vendor: Vendor) => void;
  onDeleteVendor: (vendorId: string) => void;
  onUpdateVendor: (vendor: Vendor) => void;
  onImportVendors: (newVendors: Vendor[], replaceAll?: boolean) => void;
  onResetDefaults: () => void;
}

export const VendorManagementView: React.FC<VendorManagementViewProps> = ({
  vendors,
  onAddVendor,
  onEditVendor,
  onDeleteVendor,
  onUpdateVendor,
  onImportVendors,
  onResetDefaults,
}) => {
  const placesLib = useMapsLibrary('places');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [districtFilter, setDistrictFilter] = useState<District | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<VendorCategory | 'all'>('all');
  const [productFilter, setProductFilter] = useState<ProductFilter>('all');
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [geocodingId, setGeocodingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const stats = useMemo(() => {
    const total = vendors.length;
    const bulky = vendors.filter((v) => v.bulkySticker).length;
    const food = vendors.filter((v) => v.foodTag).length;
    const geocoded = vendors.filter(
      (v) => typeof v.lat === 'number' && typeof v.lng === 'number'
    ).length;
    return { total, bulky, food, geocoded };
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return vendors.filter((v) => {
      if (districtFilter !== 'all' && v.district !== districtFilter) return false;
      if (categoryFilter !== 'all' && v.category !== categoryFilter) return false;
      if (productFilter === 'bulkySticker' && !v.bulkySticker) return false;
      if (productFilter === 'foodTag' && !v.foodTag) return false;
      if (productFilter === 'volumeBag' && !v.volumeBag) return false;
      if (q) {
        const hay = `${v.name} ${v.roadAddress} ${v.district} ${v.category} ${v.phone || ''} ${v.notes || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [vendors, searchQuery, districtFilter, categoryFilter, productFilter]);

  const handleToggleItem = (
    vendor: Vendor,
    field: 'bulkySticker' | 'foodTag' | 'volumeBag'
  ) => {
    onUpdateVendor({ ...vendor, [field]: !vendor[field] });
  };

  const handleCycleStatus = (vendor: Vendor) => {
    const order: Vendor['status'][] = ['영업중', '재고확인', '휴업'];
    const next = order[(order.indexOf(vendor.status) + 1) % order.length];
    onUpdateVendor({ ...vendor, status: next });
  };

  const handleGeocodeRow = async (vendor: Vendor) => {
    setGeocodingId(vendor.id);
    setFeedbackMsg(null);
    try {
      const res = await resolveAddressCoords(vendor.roadAddress, placesLib);
      if (!res) {
        setFeedbackMsg(`"${vendor.name}"의 주소를 좌표로 변환하지 못했습니다.`);
        return;
      }
      onUpdateVendor({
        ...vendor,
        lat: res.lat,
        lng: res.lng,
        placeId: res.placeId || vendor.placeId,
        geocodedAt: Date.now(),
      });
      setFeedbackMsg(`"${vendor.name}"의 위치 좌표가 업데이트되었습니다.`);
    } finally {
      setGeocodingId(null);
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedbackMsg(null);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseGyeryongVendorCsv(buffer);
      if (parsed.length === 0) {
        setFeedbackMsg(
          'CSV 파일에서 유효한 판매소 데이터를 찾지 못했습니다. (상호명, 도로명주소 열 확인 필요)'
        );
        return;
      }
      onImportVendors(parsed, false);
      setFeedbackMsg(
        `CSV 파일에서 ${parsed.length}개 판매소를 불러왔습니다. 지도 좌표가 자동으로 확인됩니다.`
      );
    } catch {
      setFeedbackMsg('CSV 파일을 읽는 중 오류가 발생했습니다.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCsvExport = () => {
    const csv = exportVendorsToCsv(vendors);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `계룡시_폐기물_판매소_목록_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleJsonExport = () => {
    const json = JSON.stringify(vendors, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gyeryong_vendors_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* 4-column KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">전체 등록 판매소</div>
          <div className="mt-1.5 text-2xl font-bold text-[#0B1F3A] font-mono-tabular">
            {stats.total}개소
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">대형폐기물 스티커 취급</div>
          <div className="mt-1.5 text-2xl font-bold text-[#1E4D3B] font-mono-tabular">
            {stats.bulky}개소
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">음식물 납부필증 취급</div>
          <div className="mt-1.5 text-2xl font-bold text-[#0B1F3A] font-mono-tabular">
            {stats.food}개소
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">지도 좌표 확인 완료</div>
          <div className="mt-1.5 text-2xl font-bold text-[#9A7228] font-mono-tabular">
            {stats.geocoded} / {stats.total}
          </div>
        </div>
      </div>

      {/* Management Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="상호명, 도로명 주소, 연락처 검색..."
                aria-label="판매소 검색"
                className="w-full h-10 pl-9 pr-3 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:border-[#1E4D3B]"
              />
            </div>

            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value as District | 'all')}
              aria-label="행정구역 필터"
              className="h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E4D3B]"
            >
              <option value="all">계룡시 전체</option>
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as VendorCategory | 'all')}
              aria-label="업종 구분 필터"
              className="h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E4D3B]"
            >
              <option value="all">전체 업종</option>
              <option value="아파트 관리사무소">아파트 관리사무소</option>
              <option value="행정복지센터">행정복지센터</option>
              <option value="마트·슈퍼">마트·슈퍼</option>
              <option value="편의점">편의점</option>
              <option value="생활·문구">생활·문구</option>
            </select>

            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value as ProductFilter)}
              aria-label="취급 품목 필터"
              className="h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-[#1E4D3B]"
            >
              <option value="all">전체 취급 품목</option>
              <option value="bulkySticker">대형폐기물 스티커</option>
              <option value="foodTag">음식물 납부필증</option>
              <option value="volumeBag">종량제봉투</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setDiscoveryOpen(true)}
              className="h-10 px-3.5 text-xs sm:text-sm font-medium text-[#0B1F3A] bg-slate-100 hover:bg-slate-200 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Store className="w-4 h-4 text-[#1E4D3B]" aria-hidden="true" />
              Google 지도 매장 검색
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-10 px-3.5 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-4 h-4" aria-hidden="true" />
              CSV 가져오기
            </button>

            <button
              type="button"
              onClick={handleCsvExport}
              className="h-10 px-3.5 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              CSV 내보내기
            </button>

            <button
              type="button"
              onClick={handleJsonExport}
              className="h-10 px-3.5 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileJson className="w-4 h-4" aria-hidden="true" />
              JSON 내보내기
            </button>

            {confirmReset ? (
              <div className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-2.5 h-10">
                <span className="text-xs text-red-800 font-medium whitespace-nowrap">
                  초기화할까요?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onResetDefaults();
                    setConfirmReset(false);
                    setFeedbackMsg('계룡시청 기본 판매소 목록으로 초기화되었습니다.');
                  }}
                  className="text-xs font-semibold text-red-700 hover:underline px-1 cursor-pointer"
                >
                  확인
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="text-xs text-slate-600 hover:underline px-1 cursor-pointer"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="h-10 px-3 text-xs sm:text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                기본 목록 복원
              </button>
            )}

            <button
              type="button"
              onClick={onAddVendor}
              className="h-10 px-4 text-xs sm:text-sm font-semibold text-white bg-[#0B1F3A] hover:bg-[#14335C] rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              판매소 추가
            </button>
          </div>
        </div>

        {feedbackMsg && (
          <p className="text-xs font-medium text-[#1E4D3B]">{feedbackMsg}</p>
        )}
      </div>

      {/* High-density Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4 whitespace-nowrap">행정구역</th>
                <th className="py-3 px-4 whitespace-nowrap">판매소 상호</th>
                <th className="py-3 px-4 whitespace-nowrap">도로명 주소 / 연락처</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">대형폐기물 스티커</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">음식물 납부필증</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">종량제봉투</th>
                <th className="py-3 px-4 whitespace-nowrap">상태</th>
                <th className="py-3 px-4 whitespace-nowrap">위치 좌표</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredVendors.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 text-sm">
                    조건에 일치하는 판매소가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredVendors.map((v) => {
                  const hasCoords =
                    typeof v.lat === 'number' && typeof v.lng === 'number';
                  return (
                    <tr
                      key={v.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-600">
                        <div className="font-semibold text-slate-800">{v.district}</div>
                        <div>{v.category}</div>
                      </td>

                      <td className="py-3 px-4 min-w-[180px] max-w-[260px]">
                        <div className="font-semibold text-[#0B1F3A]">{v.name}</div>
                        {v.hours && (
                          <div className="text-xs text-slate-500 mt-0.5">{v.hours}</div>
                        )}
                        {v.notes && (
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate" title={v.notes}>
                            {v.notes}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 min-w-[240px]">
                        <div className="text-xs sm:text-sm text-slate-800">
                          {v.roadAddress}
                        </div>
                        {v.phone && (
                          <div className="text-xs text-slate-500 font-mono-tabular mt-0.5">
                            {v.phone}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleItem(v, 'bulkySticker')}
                          className={`px-2.5 py-1 text-xs font-semibold rounded border transition-colors cursor-pointer ${
                            v.bulkySticker
                              ? 'bg-emerald-50 text-[#1E4D3B] border-emerald-200'
                              : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600'
                          }`}
                        >
                          {v.bulkySticker ? '취급' : '미취급'}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleItem(v, 'foodTag')}
                          className={`px-2.5 py-1 text-xs font-semibold rounded border transition-colors cursor-pointer ${
                            v.foodTag
                              ? 'bg-emerald-50 text-[#1E4D3B] border-emerald-200'
                              : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600'
                          }`}
                        >
                          {v.foodTag ? '취급' : '미취급'}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleItem(v, 'volumeBag')}
                          className={`px-2.5 py-1 text-xs font-semibold rounded border transition-colors cursor-pointer ${
                            v.volumeBag
                              ? 'bg-slate-100 text-slate-800 border-slate-300'
                              : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600'
                          }`}
                        >
                          {v.volumeBag ? '취급' : '미취급'}
                        </button>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleCycleStatus(v)}
                          title="클릭하여 상태 변경"
                          className={`text-xs font-semibold cursor-pointer hover:underline ${
                            v.status === '영업중'
                              ? 'text-[#16A34A]'
                              : v.status === '재고확인'
                              ? 'text-[#D97706]'
                              : 'text-[#DC2626]'
                          }`}
                        >
                          {v.status}
                        </button>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-xs">
                        {hasCoords ? (
                          <span className="font-mono-tabular text-slate-600">
                            {v.lat?.toFixed(4)}, {v.lng?.toFixed(4)}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleGeocodeRow(v)}
                            disabled={geocodingId === v.id}
                            className="inline-flex items-center gap-1 text-[#1E4D3B] font-medium hover:underline cursor-pointer disabled:opacity-50"
                          >
                            <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                            {geocodingId === v.id ? '확인중...' : '좌표 조회'}
                          </button>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditVendor(v)}
                            aria-label={`${v.name} 수정`}
                            className="p-2 text-slate-500 hover:text-[#0B1F3A] rounded-md hover:bg-slate-100 cursor-pointer"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteVendor(v.id)}
                            aria-label={`${v.name} 삭제`}
                            className="p-2 text-slate-500 hover:text-red-700 rounded-md hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PlacesDiscoveryModal
        isOpen={discoveryOpen}
        existingVendors={vendors}
        onClose={() => setDiscoveryOpen(false)}
        onImportVendors={(newItems) => {
          onImportVendors(newItems, false);
          setFeedbackMsg(
            `Google 지도에서 선택한 ${newItems.length}개 매장이 판매소 목록에 추가되었습니다.`
          );
        }}
      />
    </div>
  );
};
