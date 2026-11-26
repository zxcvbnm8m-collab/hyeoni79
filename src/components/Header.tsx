import React, { useState } from 'react';

export type ActiveTab = 'locator' | 'manage' | 'guide';

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenAddVendor: () => void;
}

const GYERYONG_EMBLEM_SRC = '/src/assets/images/gyeryong_official_symbol.png';

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenAddVendor,
}) => {
  const [logoError, setLogoError] = useState(false);

  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'locator', label: '가까운 판매소 찾기' },
    { id: 'manage', label: '판매소 업소 관리' },
    { id: 'guide', label: '배출·수수료 안내' },
  ];

  return (
    <header className="bg-[#0B1F3A] text-white border-b border-[#B48A3E]/40 sticky top-0 z-40">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Top-left Official Gyeryong-si Logo + Single-line Wordmark */}
        <button
          type="button"
          onClick={() => onTabChange('locator')}
          className="flex items-center gap-3 text-left whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C59B47] cursor-pointer"
        >
          <span className="h-9 px-1.5 py-1 rounded-lg bg-white flex items-center justify-center shrink-0 border border-[#C59B47]/70">
            {!logoError ? (
              <img
                src={GYERYONG_EMBLEM_SRC}
                alt="계룡시 공식 로고"
                referrerPolicy="no-referrer"
                onError={() => setLogoError(true)}
                className="h-7 w-auto object-contain"
              />
            ) : (
              <svg
                viewBox="0 0 32 32"
                className="w-7 h-7"
                aria-label="계룡시 심볼"
              >
                <circle cx="16" cy="16" r="14" fill="#FFFFFF" stroke="#B48A3E" strokeWidth="1.5" />
                <path d="M6 19 L13 9 L19 15 L24 11 L26 19" fill="none" stroke="#166534" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 21 Q14 17 26 22 Q18 26 8 23 Z" fill="#0B1F3A" />
              </svg>
            )}
          </span>
          <span className="text-base sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            계룡시 폐기물 판매소 안내
          </span>
        </button>

        {/* Zone 2: Clean Single-Line Navigation Links */}
        <nav
          aria-label="주요 메뉴"
          className="hidden md:flex items-center gap-7 text-sm font-medium"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#C59B47] ${
                  isActive
                    ? 'border-[#C59B47] text-white font-semibold'
                    : 'border-transparent text-slate-300 hover:text-white hover:border-slate-500'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenAddVendor}
            className="px-4 py-2 text-xs sm:text-sm font-bold text-[#0B1F3A] bg-[#C59B47] hover:bg-[#D4AE5F] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C59B47]"
          >
            판매소 등록
          </button>
        </div>
      </div>

      {/* Compact mobile navigation row */}
      <nav
        aria-label="모바일 메뉴"
        className="flex md:hidden border-t border-white/10 px-4 gap-4 overflow-x-auto bg-[#08172C]"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`py-2.5 text-xs font-medium border-b-2 whitespace-nowrap shrink-0 cursor-pointer ${
                isActive
                  ? 'border-[#C59B47] text-white font-semibold'
                  : 'border-transparent text-slate-300'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
