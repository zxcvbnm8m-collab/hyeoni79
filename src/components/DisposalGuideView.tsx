import React from 'react';
import { ExternalLink, Phone, MapPin } from 'lucide-react';

export const DisposalGuideView: React.FC = () => {
  const centers = [
    {
      name: '두마면 행정복지센터',
      address: '충청남도 계룡시 두마면 팥거리2길 14',
      phone: '042-840-3313',
    },
    {
      name: '엄사면 행정복지센터',
      address: '충청남도 계룡시 엄사면 번영로 47',
      phone: '042-840-3131',
    },
    {
      name: '금암동 행정복지센터',
      address: '충청남도 계룡시 장안1길 28',
      phone: '042-840-3401',
    },
    {
      name: '신도안면 행정복지센터',
      address: '충청남도 계룡시 신도안면 신도안2길 59',
      phone: '042-840-3207',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <h1 className="text-xl font-bold text-[#0B1F3A] tracking-tight">
          계룡시 대형폐기물 스티커 및 음식물 납부필증 안내
        </h1>
        <p className="text-sm text-slate-600 mt-1.5 max-w-3xl leading-relaxed">
          계룡시 관내 대형폐기물 신고필증(스티커) 및 음식물폐기물 납부필증은 오프라인 지정판매소·행정복지센터뿐만 아니라 계룡시청 온라인 시스템을 통해서도 편리하게 발급받을 수 있습니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <article className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-[#1E4D3B]">01. 대형폐기물 온라인 신고</div>
            <h2 className="text-base font-bold text-[#0B1F3A] mt-1">
              계룡시 대형폐기물 인터넷 배출 시스템
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700 leading-relaxed">
              <li>1. PC 또는 모바일에서 배출자 정보·품목·장소 입력</li>
              <li>2. 신용카드 또는 계좌이체로 수수료 결제</li>
              <li>3. 신고필증 출력 후 폐기물에 부착 배출 (프린터가 없을 경우 빈 종이에 접수번호·품명·금액·배출장소를 굵은 펜으로 기재해 부착 가능)</li>
            </ul>
          </div>
          <a
            href="https://www.gyeryong.go.kr/clean/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1E4D3B] hover:underline"
          >
            계룡시청 대형폐기물 인터넷 신청 바로가기
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
          </a>
        </article>

        <article className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-[#1E4D3B]">02. 오프라인 지정판매소 구매</div>
            <h2 className="text-base font-bold text-[#0B1F3A] mt-1">
              지정판매소·공동주택 관리사무소 구매
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700 leading-relaxed">
              <li>1. 대형폐기물 스티커: 거주지 인근 300세대 이상 아파트 관리사무소·행정복지센터·지정 판매소 문의</li>
              <li>2. 음식물 납부필증·종량제봉투: 계룡시 지정 마트·슈퍼마켓·편의점 방문 구매</li>
              <li>3. 아파트 관리사무소 및 점포별 취급 품목·재고가 상이할 수 있어 방문 전 전화 확인을 권장합니다</li>
            </ul>
          </div>
          <div className="mt-5 text-xs text-slate-500">
            최신 공공데이터 파일은 공공데이터포털(data.go.kr) ‘계룡시 종량제봉투 판매소’에서 CSV로 내려받아 본 앱에 바로 업로드할 수 있습니다.
          </div>
        </article>

        <article className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold text-[#1E4D3B]">03. 대형 폐가전 무상 방문수거</div>
            <h2 className="text-base font-bold text-[#0B1F3A] mt-1">
              스티커 없이 무료 방문 수거
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700 leading-relaxed">
              <li>대상: 냉장고, 세탁기, 에어컨, TV 등 대형 폐가전제품</li>
              <li>수수료: 유료 스티커 구매 불필요 (무상 수거)</li>
              <li>신청: 인터넷 ‘폐가전 무상방문수거 예약센터’ 또는 전용 콜센터 예약</li>
            </ul>
          </div>
          <div className="mt-5 space-y-1 text-sm font-semibold text-[#0B1F3A] font-mono-tabular">
            <div>폐가전 무상수거 콜센터: 1599-0903</div>
            <div className="text-xs font-normal text-slate-600">
              계룡시 환경위생과 청소행정팀: 042-840-2482
            </div>
          </div>
        </article>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-base font-bold text-[#0B1F3A] mb-4">
          계룡시 면·동 행정복지센터 방문 신고 및 안내처
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {centers.map((center) => (
            <div
              key={center.name}
              className="border border-slate-200 rounded-lg p-4 bg-slate-50/50"
            >
              <h3 className="text-sm font-bold text-[#0F2942]">{center.name}</h3>
              <p className="mt-2 text-xs text-slate-700 flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{center.address}</span>
              </p>
              <p className="mt-1.5 text-xs text-slate-600 font-mono-tabular flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                <span>{center.phone}</span>
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
