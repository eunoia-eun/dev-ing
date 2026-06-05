# CLAUDE.md

이 저장소에서 작업하는 AI 에이전트/개발자를 위한 안내입니다.

## 한 줄 요약

보건관리자용 임직원 건강관리 웹앱. **React + Vite + TypeScript**, 데이터는 **localStorage**(추상화된 저장소 포트 뒤). **레이어드/클린 아키텍처**이며 **테스트 하네스**가 1급 시민입니다.

## 명령어

| 목적 | 명령 |
| --- | --- |
| 개발 서버 | `npm run dev` |
| 테스트(필수, 변경 후 항상) | `npm test` |
| 타입 검사 | `npm run typecheck` |
| 빌드(타입검사 포함) | `npm run build` |

## 아키텍처 — 의존성 방향 (안쪽으로만)

```
ui ─▶ composition ─▶ application ─▶ domain
                 └─▶ infrastructure ─▶ application(ports), domain
```

레이어별 규칙(엄수):

- **`src/domain`** — 순수 비즈니스 규칙. **어떤 외부도 import 금지**(React, 저장소, Date.now 등 X).
  - 현재시각이 필요한 로직은 `today: ISODate`를 **인자로 주입**받는다(예: `assessExposure`). 절대 내부에서 시간을 읽지 않는다.
  - 모든 도메인 함수는 입력을 변경하지 않는 **순수 함수**를 지향한다(예: `dispenseFromStock`).
- **`src/application`** — 유스케이스(서비스) + **포트**(저장소/시계/ID 인터페이스). 도메인에만 의존.
- **`src/infrastructure`** — 포트 **구현**(localStorage 저장소, 시드, `SystemClock`, `UuidIdGenerator`).
- **`src/composition`** — 합성 루트(`createAppServices`). 의존성을 조립하는 **유일한 곳**.
- **`src/ui`** — React. `useServices()`로 서비스에만 접근하고, infrastructure를 직접 import 하지 않는다.

경로 별칭: `@domain/* @application/* @infrastructure/* @composition/* @ui/* @test/*`
(별칭은 `vite.config.ts`와 `tsconfig.json` 두 곳에 동일하게 정의 — 한쪽만 바꾸지 말 것.)

## 테스트 하네스 (`test/harness`)

- `buildTestServices(seed, { today })` — 실제 `createAppServices`와 **동일 구조**를 인메모리 저장소 + `FixedClock` + `SeqIdGenerator`로 갈아끼운 버전. 통합 테스트는 여기서 시작한다.
- `fakes.ts` — `FixedClock`(시간 고정), `SeqIdGenerator`(예측 가능한 ID).
- `inMemoryRepositories.ts` — 포트의 인메모리 구현.
- `builders.ts` — 테스트 데이터 빌더(`anEmployee`, `aMedicine` 등). 관심 필드만 override.

새 기능을 추가하면 **먼저/함께** 테스트를 추가한다(도메인 규칙은 `test/unit`, 서비스 흐름은 `test/integration`).

## 기능을 추가하는 표준 순서

1. `domain/`에 타입·순수 규칙 작성 + `test/unit` 테스트.
2. `application/ports`에 필요한 포트 추가, `application/usecases`에 서비스 메서드 추가 + `test/integration` 테스트(하네스 사용).
3. `infrastructure`에 포트 구현(+ 필요 시 `seed`).
4. `composition/container.ts`에서 조립.
5. `ui/`에 화면 연결(`useServices` + `useAsync`).

## 도메인 핵심

- **유해물질**: 카탈로그는 `src/infrastructure/seed/hazardousSubstances.json`(산업안전보건법 시행규칙 [별표 22], PDF에서 파싱). 검진 도래 계산은 `domain/hazard/ExposureAssessment.ts`의 `assessExposure`.
  - 검진 이력 없음 → 배치일 + `firstExamMonths`(최초), 있음 → 최근검진일 + `cycleMonths`(주기).
  - `firstExamMonths`/`cycleMonths`는 [별표 23] **분류별 기본값**이며 물질별 세부값은 추후 보정 대상. 자세히는 `docs/domain/special-exam-criteria.md`.
  - **노출 from-to**: `ExposureRecord`에 `startDate`/`endDate`(없으면 진행 중)와 노출 당시 `department`·`jobTitle` 스냅샷이 있다. `assessExposure`는 `endDate`가 있으면 `status='ended'`(종료) — `isExposureEnded` 참고. `getOverview`(검진 도래 집계)·`getHazardUsage`·`getDepartmentHazards`의 적용현황은 **진행 중(active) 노출만** 센다. `addExposure`는 부서·업무를 임직원 현재 값으로 스냅샷, `endExposure(id, endDate)`로 종료. UI는 `EmployeeProfilePage`의 **통합 "배치 · 유해물질 노출 이력" 카드**(아래 배치 이력 참고)에서 노출을 배치 기간별로 묶어 표시.
- **배치(발령) 이력**: `domain/employee/Assignment.ts`(employeeId·department·jobTitle·startDate·endDate?·note, from-to). `AssignmentRepository`(`assignments` 키). `AssignmentService` — `getTimeline`(이력 없으면 입사일 기준 최초 배치 1건 lazy 생성·persist), **`changeAssignment`**(이전 배치 종료[전날]→새 배치 시작→임직원 현재 부서·업무 갱신→진행 중 노출 종료[전날]→새 부서 매핑 유해인자를 `suggestions`로 반환). 부서·업무 변경은 이 흐름을 거쳐야 노출이 함께 정리된다. UI는 `EmployeeProfilePage`의 **통합 "배치 · 유해물질 노출 이력" 카드** — 배치를 `group-row` 헤더(기간·부서·업무·현재 뱃지)로, 그 아래에 해당 기간 노출(노출 시작일이 배치 기간에 포함되면 소속, 미매칭은 맨 아래 '배치 미매칭' 묶음)을 묶어 표시. 카드 액션 "발령/배치 변경"(2단계 모달: 입력 → 새 노출 제안 체크 등록, `hazard.addExposure`로 startDate=변경일) + "＋ 노출 등록", 배치 헤더마다 "＋ 이 배치에 노출"(해당 배치 시작일로 기본 채움). 배치 헤더는 **클릭 시 접기/펼치기**(기본: 현재 배치 펼침·과거 접힘; 사용자가 누른 id만 `Set`에 기억해 기본값 반전). **현재 배치엔 부서별 유해인자 매핑(카탈로그)의 '표준 유해인자' 칩 행**을 함께 표시 — 등록됨(✓)/미등록(＋칩·일괄 등록)으로 `hazard.getDepartmentHazards()` + `addExposure`를 조합해 그 자리에서 노출 등록(부서별 유해인자↔배치↔노출 통합). 합성 루트에서 assignment·exposure·deptHazard repo를 주입.
- **유해인자별 건강장해**: `src/infrastructure/seed/hazardHealthDetails.json`(「유해인자별 건강장해」 편람 + 고용노동부 노출기준, PDF에서 파싱). 키 `"<분류코드>-<번호>"`로 카탈로그와 1:1 매핑(178/181종). 각 항목에 동의어·물리화학적 성질·노출기준(`KoreanExposureLimit`, 단위 포함)·흡수대사·용도·표적장기·건강장해. **약 1MB**라 `StaticHazardHealthProvider`가 **동적 import**로 카탈로그 상세를 처음 열 때만 별도 청크로 로딩한다. UI는 `CatalogPage`(분류→물질→상세 드릴다운). 자세히는 `docs/domain/health-hazards.md`.
- **증상↔유해인자 점검**: `domain/hazard/symptomMatching.ts`의 `checkSymptomHazardRelation`(순수 함수) — 증상을 표적장기(계)로 매핑 + 건강장해 본문 키워드로 교차 점검. 서비스는 `HazardExposureService.checkSymptomRelations(employeeId, symptoms)`. UI는 증상 기재 모달(`SymptomPage`의 `SymptomHazardPanel`)에서 실시간 경고. 참고용(진단 아님).
- **부서별 유해인자(공정 매핑)**: `domain/hazard/DepartmentHazard.ts` — 임직원 개별 노출과 별개로 "부서(공정)가 다루는 유해인자"를 **직접 묶는다**(부서를 **이름(string)으로** 참조). 저장소 `DepartmentHazardRepository`(`deptHazards` 키, 추가 전용 아님 — list/save/remove). 서비스는 `HazardExposureService`에 통합: `getDepartmentHazards()`(매핑 + 적용현황=부서인원/노출등록인원 집계), `linkDepartmentHazard`(카탈로그 검증·중복 차단), `unlinkDepartmentHazard`, **`applyDepartmentHazardToEmployees`**(그 부서 임직원에게 `ExposureRecord` 일괄 생성 — 이미 같은 노출 있으면 skip, startDate=오늘, note에 출처 기록 → 특수검진 도래 계산에 자연 반영). `getDepartmentHazards`는 `appliedEmployees`(이 유해인자에 진행 중 노출 등록된 부서 임직원 이름·id)도 반환. UI는 `CatalogPage`의 **통합 "부서별 유해인자(공정) · 노출 임직원" 카드**(부서 칩 필터 + ＋유해인자 추가 모달[부서 select·카탈로그 검색 picker·공정 메모] + 행별 '임직원 적용'/'삭제'). **적용 현황 'n/n명'(뱃지) 클릭 시 그 유해인자의 노출 임직원 명단이 펼쳐지고 이름→건강명부(`/employees/:id`) 링크** — '의도(공정 매핑)'와 '실제(노출 임직원)'를 한 카드로 합침. `getHazardUsage`(실제 노출 집계)는 분류 목록의 '사용' 뱃지용으로만 남음(별도 카드 제거).
- **임직원 선택**: `ui/components/EmployeePicker.tsx`는 이름·사번·부서·직무로 검색되는 콤보박스(모든 화면 공용).
- **부서**: `domain/department/Department.ts`(id·name·note). `DepartmentService` — 임직원은 부서를 **이름(string)으로 참조**하므로, 부서명 변경 시 소속 임직원에 cascade 반영, 소속 임직원이 있는 부서는 삭제 차단(`EmployeeRepository` 주입). UI `EmployeesPage`는 **부서 선택 → 임직원** 드릴다운 + 부서 CRUD, 임직원 추가 폼의 부서는 select.
- **건강검진/프로필**: `domain/checkup/HealthCheckup.ts`(검진종류·건강관리구분 A/C1/C2/CN/D1/D2/R·업무적합 가나다라·사후관리 조치·소견·검사수치 `labResults`). 검사 항목 카탈로그 `LAB_ITEMS`(정상범위 포함). `HealthCheckupService`(CRUD), `EmployeeProfileService`(여러 서비스를 조합해 임직원별 노출·증상·약물·검진 통합 — 집계 전용, 상태 없음). UI는 `EmployeeProfilePage`(`/profile/:id`), 명부에서 링크. 서비스 간 의존은 합성 루트에서 주입.
- **검사 수치 추이**: `domain/checkup/labTrend.ts`의 `buildLabTrend(checkups, range, labItems?)`(순수 함수) — 검진들을 '검사항목(행) × 검진일(열, 오래된→최신)' 매트릭스로 변환, 정상범위 벗어난 셀 `abnormal` 표시. 조회기간 기본값 `defaultLabRange(year)`=올해 포함 5개년. UI `LabTrendCard`는 프로필 **맨 아래**에 위치.
- **검사 항목 카탈로그(관리형)**: `DEFAULT_LAB_ITEMS`(청력·시력 등 포함)를 시드로 하는 `LabItem`(id=코드, `enabled`, `order`). `LabItemService` — 추가(id=`lab_*`)/제외·포함(setEnabled)/수정/삭제(내장 삭제 불가)/**순서이동(move up·down, order 교환)**. UI `LabItemManagerModal`(검진 모달의 "⚙ 검사 항목 관리"): ▲▼ 순서, 체크 제외, 그룹 관리 포함. `LabResult.code`=`LabItem.id`.
- **검사 그룹(관리형)**: `LabGroup`(id·name·order). `LabGroupService` — 추가/삭제(소속 항목 있으면 차단). 항목은 그룹을 **이름으로** 참조.
- **검진 종류(관리형)**: `CheckupType=string`(코드). `DEFAULT_CHECKUP_TYPES`(general/special/pre_placement/ad_hoc) 시드. `CheckupTypeService` — 추가(id=`ctype_*`)/삭제(기본·사용중 차단). 라벨은 `resolveCheckupTypeName(code, types)`(폴백 `CHECKUP_TYPE_LABEL`). UI `CheckupTypeManagerModal`.
- **검사 수치 그래프**: `ui/components/LineChart.tsx`(의존성 없는 SVG, 정상범위 음영+이상치 빨강). `LabTrendCard`에 표/그래프 토글, 항목 선택 후 시계열 라인.
- **상비약**: `domain/symptom/Medicine.ts`의 `dispenseFromStock`(재고 부족 시 `InsufficientStockError`). 서비스(`SymptomService.recordVisit`)는 **모든 수령을 검증/차감한 뒤** 방문을 저장(부분 반영 방지).
- **방문 기록 수정·이력**: `SymptomVisit`에 `hazardFindings`(증상↔유해인자 점검 스냅샷)와 `log`(VisitLogEntry[] — created/updated 줄)가 있다. `SymptomService.updateVisit`는 상비약 **변경분(delta)만** 재고에 반영(증가분 검증·차감, 감소분 반납)하고 변경 요약을 log에 누적. UI는 방문 차트 행의 "수정" 버튼 → 모달 하단에 변경 이력 줄 표시(`SymptomPage`).
- **프로그램**: `domain/program/HealthProgram.ts`. 정원 초과 시 `decideEnrollmentStatus`가 `waitlisted` 반환. 취소 시 `ProgramService.cancel`이 대기자 자동 승급.
- **통계**: `domain/stats/Demographics.ts`(연령대 버킷 `ageBucketOf`·성별 라벨·`dimensionKeyOf` — 차원 `StatDimension`='department'|'age'|'gender', 모두 순수·`today` 주입). 인구 현황 `getWorkforceSummary()`(성별·나이대·국적 인원). 국적은 `Employee.isForeign?`(없으면 **내국인 기본**, `nationalityLabel`) — 임직원 등록 폼(`EmployeesPage` `EmployeeModal`)에 국적 select(내국인 기본)·생년월일(나이대 통계용) 입력. UI는 `StatisticsPage` **맨 위 인구 현황 카드**(차원 토글과 무관, 성별/국적/나이대 뱃지)와 `domain/stats/Statistics.ts`(`monthKey`/`monthsBetween`/`buildMonthlyMatrix` — 월×그룹 집계, 순수). 판정 분류는 `HealthCheckup.ts`의 `gradeCategory`(정상 A / 요관찰 C1·C2·CN / 유소견 D1·D2 / 재검 R). 서비스 `StatisticsService`(employee·checkup·visit·movement repo + clock 주입) — `getCheckupFindings(dimension, year?)`(임직원별 최근 검진[연도 지정 시 그 해] 기준, 차원별 행 + 관리대상자 명단), `getMonthlyActivity(dimension, startMonth, endMonth)`(상담/내원 건수·약 반출[movement 'out'] 수량을 월×그룹 매트릭스로), `getCheckupYears`, `getExposureStats(dimension)`(진행 중 노출 기준 차원별 인원·특수검진 상태[가장 위급한 상태로 임직원 집계] + 분류별 노출 인원 — catalog·exposure repo 주입), `getProgramStats(dimension)`(프로그램별 충원[`summarizeParticipation` 재사용] + 차원별 참여율[취소 제외] — program·enrollment repo 주입), `getSymptomOptions`/`getSymptomTrend(symptom, startMonth, endMonth, dimension)`(증상 포함 방문의 월×그룹 추이). UI `StatisticsPage`(`/stats`, 메뉴 '통계' 📊) — 상단 차원 토글(부서/연령/성별) 공유 + 카드: 검진 유소견·유해인자 노출자·프로그램 참여율·월별 상담내원/약반출·특정 증상 추이. 매트릭스 표 + `LineChart` 월합계 추이 + **모든 카드 ⬇엑셀(CSV) 다운로드**(`ui/csv.ts`의 `downloadCsv`, BOM 포함). 새 통계 추가 시: 도메인 순수 함수는 `domain/stats`, 집계는 `StatisticsService`, 화면 카드는 `StatisticsPage`.

## 주의

- 데이터 시드는 localStorage가 비어 있을 때만 1회 주입(`LocalStorageStore`). 시드를 바꿔도 기존 브라우저 데이터는 유지되므로, 확인하려면 localStorage(`whm:*` 키)를 비운다.
- `Date.now()`/`new Date()`는 `infrastructure/system`과 `ui`의 가장자리에서만 사용.
