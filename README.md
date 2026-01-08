<div align="center">
<img width="1200" height="475" alt="RINDA CRM Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# RINDA CRM

### AI 기반 스마트 영업 관리 시스템

**Google Gemini AI를 활용한 고객 분석, 맞춤형 제안서 생성, 칸반 보드 기반 CRM**

[![React](https://img.shields.io/badge/React-19.2.3-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2.0-646CFF?logo=vite)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite)](https://www.sqlite.org/)

</div>

---

## 📋 목차

- [프로젝트 소개](#-프로젝트-소개)
- [주요 기능](#-주요-기능)
- [기술 스택](#-기술-스택)
- [시작하기](#-시작하기)
- [프로젝트 구조](#-프로젝트-구조)
- [API 문서](#-api-문서)
- [기능 상태](#-기능-상태)
- [개선 필요 사항](#-개선-필요-사항)
- [추가 예정 기능](#-추가-예정-기능)
- [문제 해결](#-문제-해결)
- [기여하기](#-기여하기)

---

## 🎯 프로젝트 소개

**RINDA CRM**은 한국 세일즈 팀을 위해 특화 개발된 **AI 기반 스마트 영업 관리 플랫폼**입니다.

Google Gemini AI를 활용하여:
- 🔍 웹 검색을 통한 고객 정보 자동 수집 및 분석
- 📄 맞춤형 제안서 자동 생성 (커버 이미지 포함)
- 📊 영업 기회 발견 및 Follow-up 전략 수립
- 🎯 ICP(Ideal Customer Profile) 기반 신규 리드 자동 발굴

을 지원합니다.

---

## ✨ 주요 기능

### 🗂️ 핵심 CRM 기능

| 기능 | 설명 |
|------|------|
| **칸반 보드** | 드래그 앤 드롭으로 고객 상태 관리 (신규 → 연락 중 → 제안서 검토 → 계약 완료) |
| **AI 고객 분석** | 회사 요약, CEO 정보, 최근 뉴스, 경쟁사 정보, 영업 기회 자동 분석 |
| **자동 제안서 생성** | AI가 고객 맞춤형 제안서 초안 + 커버 이미지 생성 (1K/2K/4K 해상도) |
| **실시간 검색** | 고객명, 웹사이트, 메모, 산업 분야로 빠른 검색 및 필터링 |
| **통계 대시보드** | 고객 상태별 통계, Follow-up 완료율, 거래 성과 분석 |

### 🔄 Follow-up 자동화

| 기능 | 설명 |
|------|------|
| **자동 스케줄링** | AI 기반 최적 Follow-up 타이밍 자동 계산 |
| **유형별 관리** | 이메일, 전화, 미팅, 메시지 유형 지원 |
| **우선순위 설정** | High, Medium, Low 우선순위 및 상태 관리 |
| **달력 보기** | Follow-up 일정을 달력으로 시각화 |
| **상실 거래 분석** | 실패 사유 기록 및 AI 기반 재접촉 전략 생성 |

### 🤖 AI 고급 기능

| 기능 | 설명 |
|------|------|
| **ICP 기반 리드 생성** | 사용자 정의 ICP 프로필로 자동 기사 수집 및 리드 평가 |
| **명함 스캔 (OCR)** | 카메라/파일 업로드로 명함 정보 자동 추출 |
| **미팅 녹음 요약** | 음성 녹음 → AI 자동 요약, 액션 아이템 추출 |
| **AI 어시스턴트** | 자연어로 CRM 조작, 고객 분석 요청, 통계 조회 |

### 🔗 외부 서비스 통합

| 서비스 | 기능 |
|--------|------|
| **Slack** | 신규 Prospect 알림, Follow-up 알림, 일일 다이제스트 |
| **Gmail** | 이메일 자동 동기화, 고객별 이메일 매칭 |
| **Google Calendar** | 미팅 자동 추적, 사전 준비 자료 생성 |
| **브라우저 알림** | Follow-up, 미팅, 뉴스 업데이트 알림 |

### ⌨️ 키보드 단축키

| 단축키 | 동작 |
|--------|------|
| `Ctrl/Cmd + K` | 검색창 포커스 |
| `Ctrl/Cmd + N` | 새 고객 추가 |
| `Escape` | 모달 닫기 |

---

## 🛠️ 기술 스택

### Frontend
- **React 19.2.3** - UI 프레임워크
- **TypeScript 5.8.2** - 타입 안정성
- **Vite 6.2.0** - 고속 개발 서버 및 빌드 도구
- **Tailwind CSS** - 유틸리티 기반 CSS 스타일링
- **Lucide React 0.562.0** - 아이콘 라이브러리
- **React Markdown 10.1.0** - 마크다운 렌더링

### Backend
- **Node.js** - 런타임 환경
- **Express.js 4.18.2** - 웹 프레임워크
- **SQLite3 (better-sqlite3)** - 경량 데이터베이스
- **Node-Cron** - 자동 작업 스케줄링

### AI/ML
- **Google Gemini AI (3.0 Flash Preview)** - 고객 분석 및 제안서 생성
- **Nano Banana Pro** - 제안서 커버 이미지 생성

### 보안 및 유틸리티
- **Helmet** - HTTP 헤더 보안
- **CORS** - 크로스 도메인 요청 관리
- **Compression** - 응답 압축
- **Express Rate Limit** - API 속도 제한
- **Morgan** - HTTP 요청 로깅

---

## 🚀 시작하기

### 필수 요구사항

- Node.js 18 이상
- npm 또는 yarn
- Gemini API 키 ([Google AI Studio](https://aistudio.google.com/app/apikey)에서 발급)

### 설치 및 실행

#### 1. 저장소 클론
```bash
git clone https://github.com/FINGU-GRINDA/rinda-ai-crm.git
cd rinda-ai-crm
```

#### 2. Frontend 설정
```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.local.example .env.local
# .env.local 파일을 열어 API 키 입력:
# GEMINI_API_KEY=your_actual_api_key_here

# 개발 서버 실행
npm run dev
```

#### 3. Backend 설정
```bash
cd server

# 의존성 설치
npm install

# 서버 실행
npm run dev
```

#### 4. 브라우저에서 접속
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`

### 빌드

```bash
# 프로덕션 빌드
npm run build

# 빌드된 앱 미리보기
npm run preview
```

---

## 📁 프로젝트 구조

```
rinda-ai-crm/
├── components/                    # React UI 컴포넌트
│   ├── KanbanBoard.tsx           # 칸반 보드
│   ├── CustomerDetailPanel.tsx   # 고객 상세 패널
│   ├── EnrichmentPanel.tsx       # AI 분석 결과 표시
│   ├── ProposalGenerator.tsx     # 제안서 생성
│   ├── AutoFollowUpScheduler.tsx # Follow-up 스케줄러
│   ├── MeetingRecorder.tsx       # 미팅 녹음
│   ├── BusinessCardScanner.tsx   # 명함 스캔
│   ├── AIAssistant.tsx           # AI 어시스턴트
│   ├── ICPSettings.tsx           # ICP 프로필 관리
│   ├── modals/                   # 모달 컴포넌트
│   ├── followup/                 # Follow-up 관련 컴포넌트
│   └── settings/                 # 설정 관련 컴포넌트
│
├── services/                      # 비즈니스 로직
│   ├── geminiService.ts          # Gemini AI 서비스
│   ├── geminiApiManager.ts       # Gemini API 싱글톤 관리
│   ├── prospectService.ts        # Prospect 수집
│   ├── followUpService.ts        # Follow-up 분석
│   ├── autoFollowUpService.ts    # 자동 Follow-up 스케줄링
│   ├── slackIntegrationService.ts # Slack 통합
│   ├── emailIntegrationService.ts # Gmail 통합
│   ├── calendarIntegrationService.ts # Google Calendar 통합
│   ├── notificationService.ts    # 알림 관리
│   └── aiAssistantService.ts     # AI 어시스턴트
│
├── contexts/                      # React Context (전역 상태)
│   ├── CustomerContext.tsx       # 고객 데이터 관리
│   └── BackgroundTaskContext.tsx # 백그라운드 작업 관리
│
├── hooks/                         # Custom React Hooks
│   ├── useCustomers.ts           # 고객 데이터 훅
│   └── useMediaQuery.ts          # 미디어 쿼리 훅
│
├── server/                        # Node.js 백엔드
│   ├── index.js                  # 서버 진입점
│   ├── controllers/              # 라우트 핸들러
│   ├── routes/                   # API 라우트
│   ├── middleware/               # Express 미들웨어
│   ├── database/                 # 데이터베이스 (SQLite)
│   │   ├── db.js                # SQLite 연결
│   │   ├── schema.sql           # 데이터베이스 스키마
│   │   └── repositories/        # 데이터 접근 레이어
│   ├── services/                # 백엔드 서비스
│   └── jobs/                    # 백그라운드 작업
│
├── types.ts                      # TypeScript 타입 정의
├── App.tsx                       # 메인 앱 컴포넌트
├── vite.config.ts                # Vite 설정
└── package.json                  # 프로젝트 의존성
```

---

## 📡 API 문서

### 주요 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/customers` | 고객 목록 조회 |
| POST | `/api/customers` | 신규 고객 생성 |
| PUT | `/api/customers/:id` | 고객 정보 수정 |
| DELETE | `/api/customers/:id` | 고객 삭제 |
| POST | `/api/customers/:id/enrich` | AI 고객 분석 실행 |
| POST | `/api/customers/:id/proposal` | 제안서 생성 |
| GET | `/api/prospects` | Prospect 목록 조회 |
| POST | `/api/icp-profiles` | ICP 프로필 생성 |
| GET | `/api/follow-ups` | Follow-up 목록 조회 |
| POST | `/api/meetings/:id/summarize` | 미팅 녹음 요약 |

---

## ✅ 기능 상태

### 완전 구현된 기능 ✅

- [x] 칸반 보드 기반 고객 관리
- [x] AI 기반 고객 분석 (Enrichment)
- [x] 자동 제안서 생성 (커버 이미지 포함)
- [x] 실시간 검색 및 필터링
- [x] Follow-up 스케줄링 및 관리
- [x] 상실 거래 분석
- [x] ICP 기반 리드 생성
- [x] 명함 스캔 (OCR)
- [x] 미팅 녹음 및 AI 요약
- [x] AI 어시스턴트 (자연어 명령)
- [x] Slack 통합 (Webhook 알림)
- [x] 통계 대시보드
- [x] 키보드 단축키
- [x] 반응형 디자인 (모바일/태블릿/데스크톱)
- [x] 백그라운드 작업 처리
- [x] 브라우저 알림

### 부분 구현된 기능 ⚠️

- [ ] Gmail 통합 - 기본 연동 O, 자동 회신 기능 미흡
- [ ] Google Calendar 통합 - 기본 연동 O, 미팅 준비 콘텐츠 생성 보완 필요
- [ ] 다크 모드 - 디자인 토큰은 준비됨, UI 적용 미완료

---

## 🔧 개선 필요 사항

### 높은 우선순위 🔴

| 영역 | 개선 사항 | 상세 내용 |
|------|----------|-----------|
| **테스트** | 유닛 테스트 추가 | Jest 기반 테스트 코드 부재, 핵심 서비스에 테스트 추가 필요 |
| **테스트** | E2E 테스트 추가 | Cypress/Playwright 기반 통합 테스트 필요 |
| **에러 처리** | 에러 핸들링 강화 | API 에러 시 사용자 피드백 개선 필요 |
| **보안** | 환경 변수 관리 | 민감한 정보 관리 체계 강화 |

### 중간 우선순위 🟡

| 영역 | 개선 사항 | 상세 내용 |
|------|----------|-----------|
| **성능** | API 응답 캐싱 | 반복적인 AI 분석 요청 캐싱으로 비용 절감 |
| **UX** | 로딩 상태 개선 | 스켈레톤 UI 및 진행률 표시 개선 |
| **접근성** | 키보드 네비게이션 | 전체 화면 키보드 접근성 개선 |
| **문서화** | API 문서 자동화 | Swagger/OpenAPI 문서 생성 |

### 낮은 우선순위 🟢

| 영역 | 개선 사항 | 상세 내용 |
|------|----------|-----------|
| **코드 품질** | 코드 리팩토링 | 일부 대형 컴포넌트 분리 필요 |
| **UI** | 다크 모드 완성 | 디자인 토큰 기반 다크 테마 적용 |
| **로깅** | 구조화된 로깅 | 프론트엔드 에러 로깅 체계 구축 |

---

## 🚀 추가 예정 기능

### Phase 1 - 핵심 기능 강화

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| **팀 협업** | 팀 멤버 관리, 고객 할당, 권한 관리 | 높음 |
| **고급 보고서** | 데이터 시각화, ROI 분석, 성과 리포트 | 높음 |
| **이메일 템플릿** | 상황별 이메일 템플릿 라이브러리 | 중간 |
| **오프라인 모드** | Service Worker 기반 오프라인 지원 | 중간 |

### Phase 2 - 통합 확대

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| **Microsoft Teams 통합** | Teams 채널 알림 연동 | 높음 |
| **Salesforce 동기화** | 기존 CRM 데이터 양방향 동기화 | 높음 |
| **HubSpot 동기화** | HubSpot CRM 연동 | 중간 |
| **Slack 다이렉트 메시지** | 1:1 Slack 알림 | 낮음 |

### Phase 3 - AI 고도화

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| **예측 분석** | 거래 성사 확률 예측 | 높음 |
| **이탈 위험 예측** | 고객 이탈 위험도 분석 | 높음 |
| **최적 제안 금액 추천** | AI 기반 가격 전략 추천 | 중간 |
| **자동 리드 스코어링** | 리드 품질 자동 평가 | 중간 |

### Phase 4 - 엔터프라이즈 기능

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| **다중 언어 지원** | 영어, 일본어 등 다국어 UI | 중간 |
| **SSO 인증** | SAML/OAuth 기반 SSO | 높음 |
| **감사 로그** | 모든 작업 이력 추적 | 높음 |
| **데이터 내보내기** | CSV/Excel 대량 내보내기 | 중간 |

---

## ❓ 문제 해결

### API 키 오류

"분석 중 문제가 발생했어요. API 키를 확인해주세요." 오류 발생 시:

1. `.env.local` 파일에 올바른 API 키가 설정되어 있는지 확인
2. API 키가 유효한지 [Google AI Studio](https://aistudio.google.com/app/apikey)에서 확인
3. Vite 개발 서버를 재시작: `npm run dev`

### 포트 충돌

기본 포트(3000/3001)가 사용 중이면:
- Vite가 자동으로 다른 포트를 사용합니다
- 터미널 메시지에서 실제 포트 번호를 확인하세요

### 데이터베이스 초기화

데이터베이스를 초기화하려면:
```bash
cd server
rm crm.db
npm run dev  # 서버 시작 시 자동으로 새 DB 생성
```

### 백엔드 연결 오류

CORS 또는 연결 오류 시:
1. 백엔드 서버가 실행 중인지 확인: `cd server && npm run dev`
2. `VITE_API_URL` 환경 변수가 올바르게 설정되어 있는지 확인
3. 브라우저 개발자 도구 Network 탭에서 오류 확인

---

## 🤝 기여하기

프로젝트 기여를 환영합니다!

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 라이선스

이 프로젝트는 개인/팀 내부 사용을 위한 것입니다.

---

## 💬 지원

문제가 발생하거나 질문이 있으시면 [GitHub Issues](https://github.com/FINGU-GRINDA/rinda-ai-crm/issues)에 등록해주세요.

---

<div align="center">

**Made with ❤️ by FINGU-GRINDA Team**

</div>
