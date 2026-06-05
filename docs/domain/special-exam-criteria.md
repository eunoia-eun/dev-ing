# 특수건강진단 대상 유해인자 데이터

## 원천

- **산업안전보건법 시행규칙 [별표 22] 특수건강진단 대상 유해인자** (제201조 관련, 개정 2021. 11. 19.)
- 저장소 루트의 PDF `[별표 22] 특수건강진단 대상 유해인자(...).pdf` 에서 **파싱**하여 생성했습니다.
- 파싱 원문 텍스트: [`별표22-원문추출.txt`](./별표22-원문추출.txt)
- 구조화 결과: `src/infrastructure/seed/hazardousSubstances.json`

## 분류 및 종수 (총 181종)

| 코드 | 대분류 | 분류 | 종수 |
| --- | --- | --- | --- |
| `CHEM_ORGANIC` | 화학적 인자 | 유기화합물 | 109 |
| `CHEM_METAL` | 화학적 인자 | 금속류 | 20 |
| `CHEM_ACID_ALKALI` | 화학적 인자 | 산 및 알카리류 | 8 |
| `CHEM_GAS` | 화학적 인자 | 가스 상태 물질류 | 14 |
| `CHEM_PERMIT` | 화학적 인자 | 허가 대상 유해물질 | 12 |
| `CHEM_MWF` | 화학적 인자 | 금속가공유 | 1 |
| `DUST` | 분진 | 분진 | 7 |
| `PHYSICAL` | 물리적 인자 | 물리적 인자 | 8 |
| `NIGHT_WORK` | 야간작업 | 야간작업 | 2 |

> 혼합물 규정 항목(“1)부터 N)까지의 물질을 … 함유한 혼합물”)은 개별 물질이 아니므로 카탈로그에서 제외했습니다.

## 데이터 형태

```jsonc
{
  "code": "CHEM_ORGANIC",
  "group": "화학적 인자",
  "name": "유기화합물",
  "firstExamMonths": 6,   // 배치 후 최초 특수건강진단 시기(개월)
  "cycleMonths": 12,      // 특수건강진단 주기(개월)
  "substances": [
    { "no": 41, "nameKo": "벤젠", "nameEn": "Benzene", "cas": "71-43-2" }
    // ...
  ]
}
```

## 검진 도래 계산 (`assessExposure`)

```
검진 이력 없음  → 다음 예정일 = 배치(노출 시작)일 + firstExamMonths   (basis: 'first')
검진 이력 있음  → 다음 예정일 = 최근 특수건강진단일 + cycleMonths       (basis: 'periodic')
```

상태(`status`)는 오늘(today) 기준:

- `overdue` — 예정일이 오늘보다 과거
- `due-soon` — 예정일까지 30일 이내(`DUE_SOON_THRESHOLD_DAYS`)
- `ok` — 그 외

## ⚠️ 중요한 한계 — `firstExamMonths` / `cycleMonths`

- 이 값들은 **[별표 23] 의 분류별 일반 기본값**으로 설정한 것입니다.
- 실제 [별표 23]은 **물질별로** 배치 후 최초 시기(1·2·3·6·12개월)와 주기(6·12·24개월)를 다르게 규정합니다.
  - 예: 벤젠·사염화탄소 등 일부 유기화합물은 주기 6개월, 일부 물질은 최초 1~2개월.
- 따라서 앱의 계산은 **참고용**이며, 정확한 주기는 보건관리자가 [별표 23] 원문으로 확인·보정해야 합니다.

### 향후 정밀화 방법

물질별 주기를 반영하려면, `hazardousSubstances.json`의 각 `substance`에
선택적 필드 `firstExamMonths`/`cycleMonths`(물질별 override)를 추가하고,
`assessExposure`(또는 그 호출부)에서 “물질별 값 우선, 없으면 분류 기본값” 순으로 사용하도록 확장하면 됩니다.
도메인 함수 시그니처가 이미 `category`를 받으므로, override 병합 지점만 추가하면 됩니다.
