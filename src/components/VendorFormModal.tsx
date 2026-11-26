import React, { useEffect, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin, X } from 'lucide-react';
import { DISTRICTS } from '../data/gyeryongVendors';
import type {
  District,
  Vendor,
  VendorCategory,
  VendorStatus,
} from '../types/vendor';
import { inferDistrictFromAddress } from '../utils/geo';
import { resolveAddressCoords } from '../utils/mapsGeocoder';

interface VendorFormModalProps {
  isOpen: boolean;
  editingVendor: Vendor | null;
  onClose: () => void;
  onSave: (vendor: Vendor) => void;
}

const CATEGORIES: VendorCategory[] = [
  '마트·슈퍼',
  '편의점',
  '아파트 관리사무소',
  '행정복지센터',
  '생활·문구',
];

const STATUSES: VendorStatus[] = ['영업중', '재고확인', '휴업'];

export const VendorFormModal: React.FC<VendorFormModalProps> = ({
  isOpen,
  editingVendor,
  onClose,
  onSave,
}) => {
  const placesLib = useMapsLibrary('places');

  const [name, setName] = useState('');
  const [category, setCategory] = useState<VendorCategory>('마트·슈퍼');
  const [district, setDistrict] = useState<District>('금암동');
  const [roadAddress, setRoadAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [hours, setHours] = useState('');
  const [bulkySticker, setBulkySticker] = useState(true);
  const [foodTag, setFoodTag] = useState(true);
  const [volumeBag, setVolumeBag] = useState(true);
  const [status, setStatus] = useState<VendorStatus>('영업중');
  const [notes, setNotes] = useState('');
  const [lat, setLat] = useState<number | undefined>(undefined);
  const [lng, setLng] = useState<number | undefined>(undefined);
  const [placeId, setPlaceId] = useState<string | undefined>(undefined);
  const [isCheckingGeo, setIsCheckingGeo] = useState(false);
  const [geoStatusMsg, setGeoStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (editingVendor) {
      setName(editingVendor.name);
      setCategory(editingVendor.category);
      setDistrict(editingVendor.district);
      setRoadAddress(editingVendor.roadAddress);
      setPhone(editingVendor.phone || '');
      setHours(editingVendor.hours || '');
      setBulkySticker(editingVendor.bulkySticker);
      setFoodTag(editingVendor.foodTag);
      setVolumeBag(editingVendor.volumeBag);
      setStatus(editingVendor.status);
      setNotes(editingVendor.notes || '');
      setLat(editingVendor.lat);
      setLng(editingVendor.lng);
      setPlaceId(editingVendor.placeId);
      setGeoStatusMsg(
        typeof editingVendor.lat === 'number'
          ? `좌표 확인됨 (${editingVendor.lat.toFixed(5)}, ${editingVendor.lng?.toFixed(5)})`
          : null
      );
    } else {
      setName('');
      setCategory('마트·슈퍼');
      setDistrict('금암동');
      setRoadAddress('충청남도 계룡시 ');
      setPhone('');
      setHours('');
      setBulkySticker(false);
      setFoodTag(true);
      setVolumeBag(true);
      setStatus('영업중');
      setNotes('');
      setLat(undefined);
      setLng(undefined);
      setPlaceId(undefined);
      setGeoStatusMsg(null);
    }
    setErrorMsg(null);
  }, [isOpen, editingVendor]);

  if (!isOpen) return null;

  const handleVerifyAddress = async () => {
    if (!roadAddress.trim()) {
      setErrorMsg('도로명 주소를 먼저 입력해 주세요.');
      return;
    }
    setErrorMsg(null);
    setIsCheckingGeo(true);
    setGeoStatusMsg('좌표 확인 중...');
    try {
      const res = await resolveAddressCoords(roadAddress, placesLib);
      if (!res) {
        setGeoStatusMsg('좌표를 찾지 못했습니다. 도로명 주소를 확인해 주세요.');
        return;
      }
      setLat(res.lat);
      setLng(res.lng);
      setPlaceId(res.placeId);
      setDistrict(inferDistrictFromAddress(res.formattedAddress || roadAddress));
      setGeoStatusMsg(`좌표 확인 완료 (${res.lat.toFixed(5)}, ${res.lng.toFixed(5)})`);
    } finally {
      setIsCheckingGeo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !roadAddress.trim()) {
      setErrorMsg('상호명과 도로명 주소는 필수입니다.');
      return;
    }

    let resolvedLat = lat;
    let resolvedLng = lng;
    let resolvedPlaceId = placeId;

    if (typeof resolvedLat !== 'number' || typeof resolvedLng !== 'number') {
      setIsCheckingGeo(true);
      const res = await resolveAddressCoords(roadAddress, placesLib);
      setIsCheckingGeo(false);
      if (res) {
        resolvedLat = res.lat;
        resolvedLng = res.lng;
        resolvedPlaceId = res.placeId;
      }
    }

    onSave({
      id: editingVendor?.id || `vendor-${Date.now()}`,
      name: name.trim(),
      category,
      district,
      roadAddress: roadAddress.trim(),
      phone: phone.trim() || undefined,
      hours: hours.trim() || undefined,
      bulkySticker,
      foodTag,
      volumeBag,
      status,
      notes: notes.trim() || undefined,
      lat: resolvedLat,
      lng: resolvedLng,
      placeId: resolvedPlaceId,
      geocodedAt: typeof resolvedLat === 'number' ? Date.now() : undefined,
      source: editingVendor?.source || 'manual',
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[1px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vendor-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 id="vendor-modal-title" className="text-base font-bold text-[#0F2942]">
            {editingVendor ? '판매소 정보 수정' : '신규 판매소 등록'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                판매소 상호명 *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 금암행복마트"
                className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F766E]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                행정구역
              </label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value as District)}
                className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#0F766E]"
              >
                {DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                업종 구분
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as VendorCategory)}
                className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#0F766E]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              도로명 주소 *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={roadAddress}
                onChange={(e) => {
                  setRoadAddress(e.target.value);
                  setLat(undefined);
                  setLng(undefined);
                }}
                placeholder="충청남도 계룡시 ..."
                className="flex-1 h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F766E]"
                required
              />
              <button
                type="button"
                onClick={() => void handleVerifyAddress()}
                disabled={isCheckingGeo}
                className="h-10 px-3 text-xs font-semibold text-[#0F2942] bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                <MapPin className="w-3.5 h-3.5 text-[#0F766E]" aria-hidden="true" />
                좌표 확인
              </button>
            </div>
            {geoStatusMsg && (
              <p className="text-[11px] text-slate-600 mt-1 font-mono-tabular">
                {geoStatusMsg}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                전화번호
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="042-840-0000"
                className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F766E]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                영업시간
              </label>
              <input
                type="text"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="예: 09:00 ~ 22:00"
                className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F766E]"
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-2">
              취급 품목
            </span>
            <div className="flex flex-wrap gap-4 text-sm text-slate-800">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bulkySticker}
                  onChange={(e) => setBulkySticker(e.target.checked)}
                  className="w-4 h-4 accent-[#0F766E]"
                />
                대형폐기물 스티커
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={foodTag}
                  onChange={(e) => setFoodTag(e.target.checked)}
                  className="w-4 h-4 accent-[#0F766E]"
                />
                음식물 납부필증
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={volumeBag}
                  onChange={(e) => setVolumeBag(e.target.checked)}
                  className="w-4 h-4 accent-[#0F766E]"
                />
                종량제봉투
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                운영 상태
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as VendorStatus)}
                className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#0F766E]"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                안내 비고
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="특이사항 입력"
                className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-[#0F766E]"
              />
            </div>
          </div>

          {errorMsg && (
            <p role="alert" className="text-xs font-medium text-red-700">
              {errorMsg}
            </p>
          )}

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isCheckingGeo}
              className="px-4 py-2 text-sm font-semibold text-white bg-[#0F2942] hover:bg-[#163A5C] rounded-lg cursor-pointer disabled:opacity-60"
            >
              {isCheckingGeo ? '저장 중...' : editingVendor ? '수정 저장' : '판매소 등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
