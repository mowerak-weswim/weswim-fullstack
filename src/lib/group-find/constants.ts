export const LEVEL_CHIPS = [
  { pub: "입문", api: "beginner_1" },
  { pub: "초급", api: "beginner_2" },
  { pub: "중급", api: "intermediate" },
  { pub: "상급", api: "advanced" },
] as const;

export const DAY_OPTIONS = [
  { ko: "월", value: "mon", wknd: false },
  { ko: "화", value: "tue", wknd: false },
  { ko: "수", value: "wed", wknd: false },
  { ko: "목", value: "thu", wknd: false },
  { ko: "금", value: "fri", wknd: false },
  { ko: "토", value: "sat", wknd: true },
  { ko: "일", value: "sun", wknd: true },
] as const;

export const TIME_OPTIONS = [
  "05:30",
  "06:00",
  "06:30",
  "07:00",
  "07:30",
  "08:00",
  "09:00",
  "10:00",
  "18:00",
  "19:00",
  "19:30",
  "20:00",
];

export const REGION1_OPTIONS = [
  { value: "seoul", label: "서울특별시", match: "서울" },
  { value: "gyeonggi", label: "경기도", match: "경기" },
  { value: "incheon", label: "인천광역시", match: "인천" },
  { value: "busan", label: "부산광역시", match: "부산" },
];

export type Region1Option = (typeof REGION1_OPTIONS)[number];
export type Region2Option = { value: string; label: string; match: string };

/** 시·도별 시·군·구 (수영장 seed `region`·`address` 매칭용) */
export const REGION2_BY_REGION1: Record<string, Region2Option[]> = {
  seoul: [
    { value: "songpa", label: "송파구", match: "송파" },
    { value: "gangnam", label: "강남구", match: "강남" },
    { value: "gangdong", label: "강동구", match: "강동" },
    { value: "gwangjin", label: "광진구", match: "광진" },
    { value: "dongjak", label: "동작구", match: "동작" },
    { value: "yangcheon", label: "양천구", match: "양천" },
    { value: "gangseo", label: "강서구", match: "강서" },
    { value: "mapo", label: "마포구", match: "마포" },
    { value: "eunpyeong", label: "은평구", match: "은평" },
    { value: "seodaemun", label: "서대문구", match: "서대문" },
    { value: "jongno", label: "종로구", match: "종로" },
    { value: "seongbuk", label: "성북구", match: "성북" },
    { value: "jungnang", label: "중랑구", match: "중랑" },
    { value: "nowon", label: "노원구", match: "노원" },
    { value: "dobong", label: "도봉구", match: "도봉" },
    { value: "gangbuk", label: "강북구", match: "강북" },
  ],
  gyeonggi: [
    { value: "guri", label: "구리시", match: "구리" },
    { value: "namyangju", label: "남양주시", match: "남양주" },
    { value: "hanam", label: "하남시", match: "하남" },
    { value: "seongnam", label: "성남시", match: "성남" },
    { value: "bundang", label: "분당", match: "분당" },
    { value: "yongin", label: "용인시", match: "용인" },
    { value: "suji", label: "수지", match: "수지" },
    { value: "anyang", label: "안양시", match: "안양" },
    { value: "pyeongchon", label: "평촌", match: "평촌" },
    { value: "bucheon", label: "부천시", match: "부천" },
    { value: "gimpo", label: "김포시", match: "김포" },
    { value: "goyang", label: "고양시", match: "고양" },
    { value: "ilsan", label: "일산", match: "일산" },
    { value: "paju", label: "파주시", match: "파주" },
    { value: "uijeongbu", label: "의정부시", match: "의정부" },
    { value: "suwon", label: "수원시", match: "수원" },
    { value: "yeongtong", label: "영통", match: "영통" },
    { value: "gwanggyo", label: "광교", match: "광교" },
  ],
  incheon: [
    { value: "namdong", label: "남동구", match: "남동" },
    { value: "yeonsu", label: "연수구", match: "연수" },
  ],
  busan: [
    { value: "haeundae", label: "해운대구", match: "해운대" },
  ],
};

/** @deprecated 시·도 연동은 `getRegion2Options(region1)` 사용 */
export const REGION2_OPTIONS = REGION2_BY_REGION1.seoul;

export function getRegion2Options(region1: string): Region2Option[] {
  return REGION2_BY_REGION1[region1] ?? REGION2_BY_REGION1.seoul;
}

export function defaultRegion2For(region1: string): string {
  return getRegion2Options(region1)[0]?.value ?? "songpa";
}

export function levelPubLabel(apiLevel: string): string {
  return LEVEL_CHIPS.find((c) => c.api === apiLevel)?.pub ?? apiLevel;
}

export function daysKoFromValues(values: string[]): string {
  const order = DAY_OPTIONS.map((d) => d.value);
  const sorted = [...values].sort(
    (a, b) => order.indexOf(a as (typeof order)[number]) - order.indexOf(b as (typeof order)[number]),
  );
  return sorted
    .map((v) => DAY_OPTIONS.find((d) => d.value === v)?.ko ?? v)
    .join("·");
}

export function daysValuesFromKo(koJoined: string): string[] {
  return koJoined
    .split("·")
    .map((ko) => DAY_OPTIONS.find((d) => d.ko === ko)?.value)
    .filter(Boolean) as string[];
}
