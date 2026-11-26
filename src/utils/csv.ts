import type { District, Vendor, VendorCategory, VendorStatus } from '../types/vendor';
import { inferDistrictFromAddress } from './geo';

function decodeBuffer(buffer: ArrayBuffer): string {
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return utf8.replace(/^\uFEFF/, '');
  } catch {
    return new TextDecoder('euc-kr').decode(buffer);
  }
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field.trim());
        field = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(field.trim());
        rows.push(row);
        row = [];
        field = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(field.trim());
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.length > 0));
}

function parseBooleanCell(val: string | undefined, defaultVal: boolean): boolean {
  if (!val) return defaultVal;
  const normalized = val.trim().toLowerCase();
  if (['y', 'yes', 'true', '1', '취급', '가능', 'o', '판매'].includes(normalized)) return true;
  if (['n', 'no', 'false', '0', '미취급', '불가', 'x'].includes(normalized)) return false;
  return defaultVal;
}

function inferCategory(name: string, rawCategory?: string): VendorCategory {
  const combined = `${name} ${rawCategory || ''}`;
  if (combined.includes('행정복지') || combined.includes('면사무소') || combined.includes('주민센터')) {
    return '행정복지센터';
  }
  if (combined.includes('관리사무소') || combined.includes('아파트') || combined.includes('공동주택')) {
    return '아파트 관리사무소';
  }
  if (
    combined.includes('GS25') ||
    combined.includes('CU') ||
    combined.includes('세븐일레븐') ||
    combined.includes('이마트24') ||
    combined.includes('편의점') ||
    combined.includes('미니스톱')
  ) {
    return '편의점';
  }
  if (combined.includes('문구') || combined.includes('오피스') || combined.includes('생활')) {
    return '생활·문구';
  }
  return '마트·슈퍼';
}

export function parseGyeryongVendorCsv(buffer: ArrayBuffer): Vendor[] {
  const text = decodeBuffer(buffer);
  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.replace(/\s+/g, '').toLowerCase());

  const findIndex = (candidates: string[]) =>
    headers.findIndex((h) => candidates.some((c) => h.includes(c)));

  const nameIdx = findIndex(['상호', '업소명', '판매소명', '매장명', 'name']);
  const roadIdx = findIndex(['도로명주소', '소재지도로명', '도로명', '주소', 'address']);
  const jibunIdx = findIndex(['지번주소', '소재지지번', '지번']);
  const districtIdx = findIndex(['행정동', '면동', '읍면동', '구역', 'district']);
  const phoneIdx = findIndex(['전화', '연락처', 'phone']);
  const categoryIdx = findIndex(['업종', '구분', '분류', 'category']);
  const bulkyIdx = findIndex(['대형폐기물', '스티커', 'bulkysticker']);
  const foodIdx = findIndex(['음식물', '납부필증', 'foodtag']);
  const bagIdx = findIndex(['종량제', '봉투', 'volumebag']);
  const latIdx = findIndex(['위도', 'lat']);
  const lngIdx = findIndex(['경도', 'lng', 'lon']);

  const results: Vendor[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = nameIdx >= 0 ? row[nameIdx] : row[0];
    const roadAddress =
      roadIdx >= 0 ? row[roadIdx] : jibunIdx >= 0 ? row[jibunIdx] : row[1] || '';

    if (!name || !roadAddress) continue;

    const jibunAddress = jibunIdx >= 0 ? row[jibunIdx] : undefined;
    const rawDistrict = districtIdx >= 0 ? row[districtIdx] : '';
    const district: District = inferDistrictFromAddress(`${rawDistrict} ${roadAddress} ${jibunAddress || ''}`);

    const parsedLat = latIdx >= 0 ? Number(row[latIdx]) : NaN;
    const parsedLng = lngIdx >= 0 ? Number(row[lngIdx]) : NaN;
    const hasCoords =
      Number.isFinite(parsedLat) &&
      Number.isFinite(parsedLng) &&
      parsedLat > 30 &&
      parsedLat < 40 &&
      parsedLng > 120 &&
      parsedLng < 135;

    const category = inferCategory(name, categoryIdx >= 0 ? row[categoryIdx] : undefined);
    const status: VendorStatus = '영업중';

    results.push({
      id: `csv-${Date.now()}-${i}`,
      name,
      category,
      district,
      roadAddress: roadAddress.startsWith('충') || roadAddress.startsWith('계룡')
        ? roadAddress
        : `충청남도 계룡시 ${roadAddress}`,
      jibunAddress: jibunAddress || undefined,
      phone: phoneIdx >= 0 && row[phoneIdx] ? row[phoneIdx] : undefined,
      bulkySticker: parseBooleanCell(
        bulkyIdx >= 0 ? row[bulkyIdx] : undefined,
        category === '행정복지센터' || category === '아파트 관리사무소'
      ),
      foodTag: parseBooleanCell(foodIdx >= 0 ? row[foodIdx] : undefined, category !== '아파트 관리사무소'),
      volumeBag: parseBooleanCell(
        bagIdx >= 0 ? row[bagIdx] : undefined,
        category !== '행정복지센터' && category !== '아파트 관리사무소'
      ),
      status,
      lat: hasCoords ? parsedLat : undefined,
      lng: hasCoords ? parsedLng : undefined,
      source: 'gyeryong_official',
    });
  }

  return results;
}

export function exportVendorsToCsv(vendors: Vendor[]): string {
  const headers = [
    '상호명',
    '행정구역',
    '업종',
    '도로명주소',
    '지번주소',
    '전화번호',
    '영업시간',
    '대형폐기물스티커',
    '음식물납부필증',
    '종량제봉투',
    '운영상태',
    '비고',
  ];

  const escapeCell = (val: string | boolean | undefined): string => {
    const str = val === undefined ? '' : String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.join(','),
    ...vendors.map((v) =>
      [
        v.name,
        v.district,
        v.category,
        v.roadAddress,
        v.jibunAddress || '',
        v.phone || '',
        v.hours || '',
        v.bulkySticker ? '취급' : '미취급',
        v.foodTag ? '취급' : '미취급',
        v.volumeBag ? '취급' : '미취급',
        v.status,
        v.notes || '',
      ]
        .map(escapeCell)
        .join(',')
    ),
  ];

  return '\uFEFF' + lines.join('\r\n');
}
