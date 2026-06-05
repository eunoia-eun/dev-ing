# 아키텍처

이 프로젝트는 **레이어드/클린 아키텍처**를 따르며, **테스트 하네스**를 설계의 1순위로 둡니다(“하네스 엔지니어링”).

## 왜 이렇게 나누나요?

병원 업무에 비유하면:

- **도메인(domain)** = 의학 지식·규정 그 자체 (예: “이 유해물질은 6개월마다 검진”).
- **애플리케이션(application)** = 진료 절차 (지식을 사용해 일을 처리, 차트를 읽고/쓰기).
- **인프라(infrastructure)** = 차트 보관함·시계 (실제 저장·시간).
- **UI** = 응대 창구 (사람이 보는 화면).

핵심 지식(도메인)을 보관함이나 화면과 분리해 두면, **한 부분을 바꿔도 나머지가 안전**하고, 검사(테스트)로 즉시 확인할 수 있습니다.

## 의존성 방향

화살표는 “~에 의존한다(import 한다)”. **항상 안쪽(도메인)을 향합니다.**

```
            ┌──────────────┐
            │      ui       │  React 화면
            └──────┬───────┘
                   ▼
            ┌──────────────┐
            │ composition   │  합성 루트(조립)
            └──┬────────┬──┘
               ▼        ▼
   ┌────────────────┐  ┌────────────────────┐
   │  application    │◀─│   infrastructure    │
   │ usecases+ports  │  │ localStorage/clock  │
   └───────┬────────┘  └─────────┬──────────┘
           ▼                     ▼
            ┌──────────────────────┐
            │        domain         │  순수 규칙 (외부 의존 0)
            └──────────────────────┘
```

- 도메인은 **아무것도 모릅니다** (React도, localStorage도, 시간도).
- 애플리케이션은 “포트(인터페이스)”로 외부와 대화합니다. 구현은 모릅니다.
- 인프라가 그 포트를 **구현**합니다(localStorage 저장소 등).
- 합성 루트(`createAppServices`)만이 “누가 무엇을 쓰는지”를 압니다.

## 포트와 어댑터 (저장소 교체)

`application/ports`는 인터페이스(약속)이고, `infrastructure/repositories`는 그 구현입니다.

```ts
// 포트(약속) — application/ports/EmployeeRepository.ts
interface EmployeeRepository {
  list(): Promise<Employee[]>;
  save(e: Employee): Promise<void>;
  // ...
}
```

지금은 `LocalEmployeeRepository`(localStorage)가 이 약속을 구현합니다.
나중에 실제 백엔드로 바꾸려면:

1. `infrastructure`에 `ApiEmployeeRepository`(예: `fetch` 사용)를 새로 만들어 같은 포트를 구현.
2. `composition/container.ts`에서 `new LocalEmployeeRepository()` → `new ApiEmployeeRepository()`로 교체.

**도메인·애플리케이션·UI 코드는 한 줄도 바꿀 필요가 없습니다.** 이것이 계층 분리의 핵심 이점입니다.

## 테스트 하네스가 1순위라는 의미

- 도메인 로직은 **시간·저장소에 의존하지 않도록** 설계됩니다(현재시각은 인자로 주입).
  덕분에 테스트가 **결정적**입니다(언제 돌려도 같은 결과).
- `test/harness/buildTestServices.ts`는 실제 합성 루트와 **같은 구조**를, 인메모리 저장소 + 고정 시계로 바꾼 “시험용 받침대”입니다.
  통합 테스트는 진짜 서비스 로직을 그대로 통과시키되, 빠르고 격리된 환경에서 검증합니다.
- 그래서 새 규칙을 넣을 때 화면 없이도 즉시 검증할 수 있습니다.

```ts
const { services } = buildTestServices(
  { medicines: [aMedicine({ stock: 1 })] },
  { today: '2026-06-02' },
);
await expect(services.symptom.recordVisit(/* 재고보다 많이 */)).rejects.toThrow();
```

## 데이터 흐름 예 (증상·상비약)

1. **UI** `SymptomPage`에서 “방문 기록” 제출 → `useServices().symptom.recordVisit(input)`.
2. **Application** `SymptomService`가 수령 약품을 모아 재고를 **먼저 검증/차감**(부족하면 예외) 후 저장.
3. **Domain** `dispenseFromStock`이 재고 규칙(불변·부족 시 오류)을 강제.
4. **Infrastructure** `LocalMedicineRepository`/`LocalSymptomVisitRepository`가 localStorage에 기록.

## 폴더 빠른 참조

| 폴더 | 책임 | 의존 가능 대상 |
| --- | --- | --- |
| `domain` | 엔티티·값·순수 규칙 | (없음) |
| `application/ports` | 저장소/시계/ID 인터페이스 | domain |
| `application/usecases` | 유스케이스(서비스) | domain, ports |
| `infrastructure` | 포트 구현, 시드, 시계 | application(ports), domain |
| `composition` | 의존성 조립 | 전부 |
| `ui` | React 화면 | composition(서비스), domain(타입) |
| `test/harness` | 테스트용 조립·페이크·빌더 | 전부 |
