import React, { useCallback, useEffect, useRef, useState } from 'react';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';
import { INITIAL_GYERYONG_VENDORS } from './data/gyeryongVendors';
import { DisposalGuideView } from './components/DisposalGuideView';
import { Header, type ActiveTab } from './components/Header';
import { LocatorView } from './components/LocatorView';
import { VendorFormModal } from './components/VendorFormModal';
import { VendorManagementView } from './components/VendorManagementView';
import type { CitizenLocation, Vendor } from './types/vendor';
import { resolveAddressCoords } from './utils/mapsGeocoder';

const STORAGE_KEY = 'gyeryong_waste_vendors_v1';

interface BatchGeocoderProps {
  vendors: Vendor[];
  onBatchResolved: (updates: Record<string, { lat: number; lng: number; placeId?: string }>) => void;
  onStatusChange: (isRunning: boolean) => void;
}

const BatchGeocoder: React.FC<BatchGeocoderProps> = ({
  vendors,
  onBatchResolved,
  onStatusChange,
}) => {
  const placesLib = useMapsLibrary('places');
  const attemptedRef = useRef<Record<string, boolean>>({});
  const isRunningRef = useRef(false);

  useEffect(() => {
    if (!placesLib || isRunningRef.current) return;

    const missing = vendors.filter(
      (v) =>
        (typeof v.lat !== 'number' || typeof v.lng !== 'number') &&
        !attemptedRef.current[v.id]
    );

    if (missing.length === 0) {
      onStatusChange(false);
      return;
    }

    let cancelled = false;
    isRunningRef.current = true;
    onStatusChange(true);

    const run = async () => {
      const batchUpdates: Record<string, { lat: number; lng: number; placeId?: string }> = {};
      for (const vendor of missing) {
        if (cancelled) break;
        attemptedRef.current[vendor.id] = true;
        const result = await resolveAddressCoords(vendor.roadAddress, placesLib);
        if (result) {
          batchUpdates[vendor.id] = {
            lat: result.lat,
            lng: result.lng,
            placeId: result.placeId,
          };
        }
        // Gentle spacing to protect API quota
        await new Promise((r) => setTimeout(r, 120));
      }

      if (!cancelled && Object.keys(batchUpdates).length > 0) {
        onBatchResolved(batchUpdates);
      }
      isRunningRef.current = false;
      if (!cancelled) {
        onStatusChange(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
      isRunningRef.current = false;
    };
  }, [vendors, placesLib, onBatchResolved, onStatusChange]);

  return null;
};

export default function App() {
  const [apiKey, setApiKey] = useState<string>(
    () => (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || ''
  );
  const [configLoaded, setConfigLoaded] = useState<boolean>(
    () => Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
  );
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const [activeTab, setActiveTab] = useState<ActiveTab>('locator');
  const [vendors, setVendors] = useState<Vendor[]>(INITIAL_GYERYONG_VENDORS);
  const [citizenLocation, setCitizenLocation] = useState<CitizenLocation | null>(null);
  const [isGeocodingBatch, setIsGeocodingBatch] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  // Listen for Tier 1 & Tier 2 Google Maps quota events
  useEffect(() => {
    const handler = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  // Load API key from backend config endpoint if not statically defined
  useEffect(() => {
    if (apiKey) {
      setConfigLoaded(true);
      return;
    }
    fetch('/api/maps-config')
      .then((res) => (res.ok ? res.json() : { apiKey: '' }))
      .then((data: { apiKey?: string }) => {
        if (data.apiKey) setApiKey(data.apiKey);
      })
      .catch(() => {})
      .finally(() => setConfigLoaded(true));
  }, [apiKey]);

  // Load persisted vendors from Express API with localStorage fallback
  useEffect(() => {
    let active = true;
    const loadVendors = async () => {
      try {
        const res = await fetch('/api/vendors');
        if (res.ok) {
          const data = (await res.json()) as { vendors?: Vendor[] };
          if (active && Array.isArray(data.vendors) && data.vendors.length > 0) {
            setVendors(data.vendors);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.vendors));
            return;
          }
        }
      } catch {
        // Fallback to localStorage below
      }

      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw && active) {
          const parsed = JSON.parse(raw) as Vendor[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setVendors(parsed);
          }
        }
      } catch {
        // Use initial seed
      }
    };

    void loadVendors();
    return () => {
      active = false;
    };
  }, []);

  const persistVendors = useCallback((nextVendors: Vendor[]) => {
    setVendors(nextVendors);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextVendors));
    } catch {
      // Ignore storage quota errors
    }
    void fetch('/api/vendors', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendors: nextVendors }),
    }).catch(() => {});
  }, []);

  const handleBatchResolved = useCallback(
    (updates: Record<string, { lat: number; lng: number; placeId?: string }>) => {
      setVendors((prev) => {
        const next = prev.map((v) => {
          const hit = updates[v.id];
          if (!hit) return v;
          return {
            ...v,
            lat: hit.lat,
            lng: hit.lng,
            placeId: v.placeId || hit.placeId,
            geocodedAt: Date.now(),
          };
        });
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        void fetch('/api/vendors', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vendors: next }),
        }).catch(() => {});
        return next;
      });
    },
    []
  );

  const handleSaveVendor = useCallback(
    (saved: Vendor) => {
      const exists = vendors.some((v) => v.id === saved.id);
      const next = exists
        ? vendors.map((v) => (v.id === saved.id ? saved : v))
        : [saved, ...vendors];
      persistVendors(next);
    },
    [vendors, persistVendors]
  );

  const handleDeleteVendor = useCallback(
    (vendorId: string) => {
      persistVendors(vendors.filter((v) => v.id !== vendorId));
    },
    [vendors, persistVendors]
  );

  const handleUpdateVendor = useCallback(
    (updated: Vendor) => {
      persistVendors(vendors.map((v) => (v.id === updated.id ? updated : v)));
    },
    [vendors, persistVendors]
  );

  const handleImportVendors = useCallback(
    (incoming: Vendor[], replaceAll = false) => {
      if (replaceAll) {
        persistVendors(incoming);
        return;
      }
      const existingNames = new Set(vendors.map((v) => `${v.name}::${v.roadAddress}`));
      const uniqueIncoming = incoming.filter(
        (item) => !existingNames.has(`${item.name}::${item.roadAddress}`)
      );
      persistVendors([...uniqueIncoming, ...vendors]);
    },
    [vendors, persistVendors]
  );

  const handleResetDefaults = useCallback(async () => {
    try {
      const res = await fetch('/api/vendors/reset', { method: 'POST' });
      if (res.ok) {
        const data = (await res.json()) as { vendors?: Vendor[] };
        if (Array.isArray(data.vendors)) {
          setVendors(data.vendors);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data.vendors));
          return;
        }
      }
    } catch {
      // fallback
    }
    persistVendors(INITIAL_GYERYONG_VENDORS);
  }, [persistVendors]);

  const geocodedCount = vendors.filter(
    (v) => typeof v.lat === 'number' && typeof v.lng === 'number'
  ).length;

  const content = (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenAddVendor={() => {
          setEditingVendor(null);
          setModalOpen(true);
        }}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {activeTab === 'locator' && (
          <LocatorView
            vendors={vendors}
            citizenLocation={citizenLocation}
            isGeocodingBatch={isGeocodingBatch}
            geocodedCount={geocodedCount}
            onSelectLocation={setCitizenLocation}
            onClearLocation={() => setCitizenLocation(null)}
            onSwitchToManage={() => setActiveTab('manage')}
          />
        )}

        {activeTab === 'manage' && (
          <VendorManagementView
            vendors={vendors}
            onAddVendor={() => {
              setEditingVendor(null);
              setModalOpen(true);
            }}
            onEditVendor={(vendor) => {
              setEditingVendor(vendor);
              setModalOpen(true);
            }}
            onDeleteVendor={handleDeleteVendor}
            onUpdateVendor={handleUpdateVendor}
            onImportVendors={handleImportVendors}
            onResetDefaults={() => void handleResetDefaults()}
          />
        )}

        {activeTab === 'guide' && <DisposalGuideView />}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-8">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
          <span>
            대한민국 국방수도 충청남도 계룡시 · 대형폐기물 스티커 및 음식물 납부필증 지정판매소 안내
          </span>
          <a
            href="https://www.gyeryong.go.kr/clean/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0B1F3A] font-medium hover:text-[#1E4D3B] hover:underline"
          >
            계룡시청 대형폐기물 온라인 신청 바로가기
          </a>
        </div>
      </footer>

      <VendorFormModal
        isOpen={modalOpen}
        editingVendor={editingVendor}
        onClose={() => {
          setModalOpen(false);
          setEditingVendor(null);
        }}
        onSave={handleSaveVendor}
      />
    </div>
  );

  if (!configLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-600">
        지도 서비스를 불러오는 중입니다...
      </div>
    );
  }

  return (
    <APIProvider
      apiKey={apiKey}
      language="ko"
      region="KR"
      libraries={['places', 'marker', 'routes']}
    >
      <BatchGeocoder
        vendors={vendors}
        onBatchResolved={handleBatchResolved}
        onStatusChange={setIsGeocodingBatch}
      />
      {content}
    </APIProvider>
  );
}
