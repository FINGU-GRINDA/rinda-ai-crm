# RINDA CRM UI 가이드라인

이 문서는 신규 화면/컴포넌트 개발 시 따라야 할 디자인 원칙과 카피 규칙을 정의합니다.

> **단일 출처**: 모든 색상, 상태 매핑, 사용자 노출 텍스트는 코드에서 다음 두 파일을 통해서만 정의합니다.
>
> - `frontend/styles/design-tokens.ts` — 색상, 타이포, 간격, 상태 매핑
> - `frontend/styles/copy.ts` — 사용자 노출 텍스트 상수

---

## 1. 색상 시스템

### 사용 가능한 색상 패밀리 (6종)

| 패밀리 | 용도 | 비고 |
|---|---|---|
| `blue` | 주색 (브랜드), 정보 | 모든 primary 액션, 링크, 활성 탭 |
| `slate` | 중립 (텍스트, 보더, 배경) | 가장 광범위하게 사용 |
| `emerald` | 성공, 긍정적 신호 | 성사된 거래, 강한 신호 |
| `amber` | 주의, 협상 단계 | 협상 중, 보통 우선순위 |
| `red` | 위험, 실주 | 실주 처리, 삭제, 높은 우선순위 |
| `violet` | AI 단일 액센트 | AI 분석/추천 영역 전용 |

### 사용 금지 색상

`indigo`, `purple`, `rose`, `fuchsia`, `green` (Tailwind), `sky`, `teal`, `lime`, `pink`, `orange`, `cyan`, `yellow`(amber로 대체), `neutral`/`zinc`/`stone`(slate로 대체)

### 그라데이션 규칙

- **두 색상 간 그라데이션 금지** (예: `from-indigo-50 to-purple-50` ✗)
- 화이트 페이드만 허용: `from-slate-50 to-white`, `from-blue-50 to-white`
- `design-tokens.ts`의 `allowedGradients`만 사용

### 상태 표시는 반드시 토큰으로

상태 배지(`<StatusBadge>`)는 `statusBadge`, `priorityBadge`, `signalBadge` 맵을 통해서만 렌더링합니다. 인라인 `bg-X-50 text-X-700` 작성 금지.

```tsx
// ✗ 금지
<span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full">협상 중</span>

// ✓ 권장
<StatusBadge kind="status" value="negotiation" />
```

---

## 2. 공용 UI 프리미티브

`frontend/components/ui/`의 컴포넌트를 우선 사용합니다.

| 컴포넌트 | 용도 |
|---|---|
| `<Badge tone>` | 카테고리/태그/상태 표시 (작은 라벨) |
| `<StatusBadge kind value>` | 고객 상태/우선순위/신호 강도 (도메인 매핑) |
| `<Card tone padding>` | 섹션 컨테이너 (`default` / `muted` / `ai`) |
| `<EmptyState>` | 빈 상태/검색 결과 없음 화면 |
| `<SectionHeader level>` | 섹션 제목 (h2~h4 typography 토큰 자동 적용) |
| `<Button variant size>` | 액션 버튼 (이미 표준화 완료) |

신규 변형이 필요하면 컴포넌트에 prop으로 추가하고, 인라인 스타일 작성하지 마세요.

---

## 3. 타이포그래피

`design-tokens.ts`의 `typography` 토큰을 사용합니다.

| 레벨 | 토큰 | 용도 |
|---|---|---|
| h1 | `typography.h1` | 페이지 제목 |
| h2 | `typography.h2` | 메이저 섹션 |
| h3 | `typography.h3` | 카드/패널 제목 |
| h4 | `typography.h4` | 서브 섹션 |
| body | `typography.body` | 본문 |
| label | `typography.label` | 폼 라벨 (uppercase) |
| caption | `typography.caption` | 보조 설명 |

---

## 4. 모서리 / 그림자

| 요소 | 라운드 | 그림자 |
|---|---|---|
| 컨트롤 (버튼, 인풋) | `rounded-lg` | `shadow-sm` (hover: `shadow`) |
| 카드 / 패널 | `rounded-xl` | `shadow-sm` |
| 모달 | `rounded-2xl` | `shadow-2xl` |
| 아바타 / 필 배지 | `rounded-full` | 없음 |

`rounded-md`, `rounded-3xl` 등 사용 자제.

---

## 5. 카피라이팅 규칙

> 자세한 도메인 용어는 `frontend/styles/copy.ts` 참조.

### 5.1 한국어 전용

영문 비즈니스 용어를 한국어 안에 섞지 않습니다.

| ✗ | ✓ |
|---|---|
| Deal 실패 처리 | 실주 처리 |
| Lost Deal로 표시 | 실주로 처리 |
| Kanban / 칸반 | 보드 |
| 프로스펙트 | 잠재 고객 |
| ICP (단독) | 이상적 고객 조건 (ICP) — 약어는 괄호 안에만 |

### 5.2 액션 우선 동사

| ✗ | ✓ |
|---|---|
| 데이터 분석 실행 | 회사 정보 자동 채우기 |
| 모니터링 권장 | 지속 관찰을 권장합니다 |
| 참고용 | 참고 자료 |

### 5.3 에러는 원인 + 복구 안내

| ✗ | ✓ |
|---|---|
| 오류가 발생했습니다 | 고객 목록을 불러오지 못했어요. 새로고침해 주세요 |
| 실패 | 저장하지 못했어요. 입력 내용을 확인하고 다시 시도해 주세요 |

### 5.4 기술 용어 누수 금지

`enrichedData`, `enrichment`, `signalStrength` 등 코드 식별자는 UI 라벨로 노출하지 않습니다.

---

## 6. AI 영역 표현

AI 분석/추천/생성 결과 영역은 다음 규칙을 따릅니다.

- 표면: `aiSurface` 상수 (`bg-violet-50 border border-violet-100 text-violet-900`)
- 아이콘 강조: `aiAccentText` (텍스트), `aiAccentIconBg` (아이콘 원형 배경)
- 그라데이션 금지. `indigo`/`purple` 클래스 사용 금지.
- `<Card tone="ai">` 사용 권장.

---

## 7. 검증

PR 머지 전 다음을 확인합니다.

```bash
cd frontend && npm run build
```

색상 회귀 감사:
```bash
grep -rE "bg-(indigo|purple|rose|fuchsia|sky|teal|lime|pink|orange|cyan|green-[0-9])" frontend/components
```
↑ 결과는 점진적으로 감소해야 합니다.

카피 회귀 감사:
```bash
grep -rnE ">(Deal|Lost Deal|Kanban|칸반|프로스펙트|enrichedData)<" frontend/components
```
↑ 결과는 0건이어야 합니다 (코드 변수명은 제외).
