export interface CityInfo {
  code: string
  name: string
}

export interface DistrictInfo {
  code: string
  name: string
  cityCode: string
  cityName: string
}

export const CITIES: CityInfo[] = [
  { code: '11', name: '서울시' },
  { code: '26', name: '부산시' },
  { code: '27', name: '대구시' },
  { code: '28', name: '인천시' },
  { code: '29', name: '광주시' },
  { code: '30', name: '대전시' },
  { code: '31', name: '울산시' },
  { code: '36', name: '세종시' },
  { code: '41', name: '경기도' },
  { code: '42', name: '강원도' },
  { code: '43', name: '충청북도' },
  { code: '44', name: '충청남도' },
  { code: '45', name: '전라북도' },
  { code: '46', name: '전라남도' },
  { code: '47', name: '경상북도' },
  { code: '48', name: '경상남도' },
  { code: '50', name: '제주도' },
]

export const SEOUL_DISTRICTS: DistrictInfo[] = [
  { code: '680', name: '강남구', cityCode: '11', cityName: '서울시' },
  { code: '740', name: '강동구', cityCode: '11', cityName: '서울시' },
  { code: '305', name: '강북구', cityCode: '11', cityName: '서울시' },
  { code: '500', name: '강서구', cityCode: '11', cityName: '서울시' },
  { code: '620', name: '관악구', cityCode: '11', cityName: '서울시' },
  { code: '215', name: '광진구', cityCode: '11', cityName: '서울시' },
  { code: '530', name: '구로구', cityCode: '11', cityName: '서울시' },
  { code: '545', name: '금천구', cityCode: '11', cityName: '서울시' },
  { code: '350', name: '노원구', cityCode: '11', cityName: '서울시' },
  { code: '320', name: '도봉구', cityCode: '11', cityName: '서울시' },
  { code: '230', name: '동대문구', cityCode: '11', cityName: '서울시' },
  { code: '590', name: '동작구', cityCode: '11', cityName: '서울시' },
  { code: '440', name: '마포구', cityCode: '11', cityName: '서울시' },
  { code: '410', name: '서대문구', cityCode: '11', cityName: '서울시' },
  { code: '650', name: '서초구', cityCode: '11', cityName: '서울시' },
  { code: '200', name: '성동구', cityCode: '11', cityName: '서울시' },
  { code: '290', name: '성북구', cityCode: '11', cityName: '서울시' },
  { code: '710', name: '송파구', cityCode: '11', cityName: '서울시' },
  { code: '470', name: '양천구', cityCode: '11', cityName: '서울시' },
  { code: '560', name: '영등포구', cityCode: '11', cityName: '서울시' },
  { code: '170', name: '용산구', cityCode: '11', cityName: '서울시' },
  { code: '380', name: '은평구', cityCode: '11', cityName: '서울시' },
  { code: '110', name: '종로구', cityCode: '11', cityName: '서울시' },
  { code: '140', name: '중구', cityCode: '11', cityName: '서울시' },
  { code: '260', name: '중랑구', cityCode: '11', cityName: '서울시' },
]

export const TRADE_TYPES = [
  { code: 'A1', name: '매매' },
  { code: 'B1', name: '전세' },
  { code: 'B2', name: '월세' },
] as const

export const SIZE_TYPES = ['소형', '20평대', '30평대', '중대형'] as const

export const SORT_OPTIONS = [
  { value: 'rank', label: '추천순' },
  { value: 'prc', label: '가격순' },
  { value: 'spc', label: '면적순' },
  { value: 'date', label: '최신순' },
] as const
