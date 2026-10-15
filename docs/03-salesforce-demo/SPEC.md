# 에코에이블 인증 관리 SPEC (Salesforce 시연판)

2026-10-15 · 박기나 · 원본: Claude Docs 「에코에이블 인증 관리 SPEC」 · 소스: `salesforce-demo/`

## 아키텍처

화면의 두 버튼은 Apex 컨트롤러를 거쳐 데이터를 읽고 쓰며, 메일 초안만 Prompt Builder를 호출한다. 할 일 생성·완료와 단계 전환은 데이터 변화를 감지한 Flow가 처리한다. 전체는 Salesforce DX 소스 형식(API 67.0)으로 관리한다.

```
[화면]   AI 메일 초안 버튼(LWC)     요청 항목 만들기 버튼(LWC)     진행 단계 막대·목록·홈(LWC)
            │                          │
[로직]   메일 초안 Apex ──▶ Prompt Builder 템플릿 4종
            │                          │                         Flow 5개 (레코드 트리거 3 · 예약 2)
[데이터] 인증 컨설팅 프로젝트 ─< 데이터 요청 항목 · 할 일(Task) · 고객사·담당자·직원
```

## 데이터 모델

핵심은 인증 컨설팅 프로젝트와 하위 데이터 요청 항목의 주종 관계다. 프로젝트는 Account·Contact와 기존 Employee__c에 연결되고, 자동 생성 할 일(Task)은 WhatId로 프로젝트에 붙는다.

- **EPD_Certification_Project__c** (인증 컨설팅 프로젝트, 자동 번호 ECP-{0000}, 활동 사용, 공유 모델 ReadWrite)
- **Data_Request_Item__c** (데이터 요청 항목, 자동 번호 DRQ-{0000}, 공유 ControlledByParent)
- 연결: Account 1:N 프로젝트, Contact 1:N 프로젝트, Employee__c 1:N 프로젝트, 프로젝트 1:N 요청 항목(주종), 프로젝트 1:N Task

### 인증 컨설팅 프로젝트 필드

| API 이름 | 라벨 | 유형 | 규칙 / 값 |
| --- | --- | --- | --- |
| Customer_Account__c | 고객사 | Lookup(Account) | 관련 이름 EPD_Projects |
| Customer_Contact__c | 고객 담당자 | Lookup(Contact) | 비어 있으면 메일 초안에 수신자 경고 |
| Lead_Researcher__c | 담당 연구원 | Lookup(Employee__c) | |
| Product_Name__c | 대상 제품 | Text | |
| Certification_Type__c | 인증 종류 | Picklist | 환경성적표지, International EPD, EPD Norway, UL EPD, Carbon Trust |
| Stage__c | 진행 단계 | Picklist | 접수(기본), 데이터 수집, LCA 산정, 검증 심사 대응, 인증 완료 |
| Kickoff_Date__c | 착수일 | Date | |
| Target_Certification_Date__c | 목표 인증일 | Date | |
| Notes__c | 메모 | Long Text Area | |
| Total_Requests__c | 요청 항목 수 | Roll-up COUNT | 요청 항목 전체 |
| Received_Requests__c | 수령 완료 수 | Roll-up COUNT | 상태 = 수령 |
| Data_Collection_Rate__c | 데이터 수집률 | Formula(Percent) | 수령 완료 수 ÷ 요청 항목 수 |
| Missing_Info__c | 확인 필요 정보 | Formula(Text) | 인증 완료이거나 모두 채워지면 "없음", 아니면 "고객 담당자; 목표 인증일; 평가 범위·데이터 요청 항목;" 중 해당 항목 |
| Reminder_Email_Draft__c | AI 메일 초안 | Long Text Area | 버튼에서 저장 |
| Draft_Type__c | 메일 종류 | Picklist | 독촉 메일, 마감 임박 안내, 보완 요청, 정보 확인 |
| Reminder_Review_Status__c | 메일 검토 상태 | Picklist | 미검토(기본), 수정 필요, 검토 완료 |
| Email_Sent__c | 메일 발송 완료 | Checkbox | 체크 시 할 일 완료 Flow 실행 |
| Email_Sent_At__c | 발송 완료 시각 | DateTime | Flow가 기록 |

### 데이터 요청 항목 필드

| API 이름 | 라벨 | 유형 | 규칙 / 값 |
| --- | --- | --- | --- |
| Project__c | 프로젝트 | Master-Detail | 관련 이름 Data_Requests |
| Data_Category__c | 데이터 구분 | Picklist | 원료 투입량, 에너지(전력·연료) 사용량, 용수 사용량, 운송 정보, 폐기물·배출물, 포장재 정보 |
| Request_Detail__c | 요청 내용 | Text(255) | 관련 목록을 프롬프트가 읽도록 Long Text 대신 Text |
| Status__c | 상태 | Picklist | 요청(기본), 수령, 보완 요청 |
| Due_Date__c | 제출 기한 | Date | |
| Received_Date__c | 수령일 | Date | 상태가 수령이면 필수 |
| Revision_Reason__c | 보완 사유 | Text(255) | |
| Is_Overdue__c | 기한 초과 | Formula(Checkbox) | AND(NOT(ISPICKVAL(Status__c, "수령")), NOT(ISBLANK(Due_Date__c)), Due_Date__c < TODAY()) |
| Days_To_Due__c | 마감까지 남은 날 | Formula(Number) | 수령이거나 기한이 없으면 빈 값, 아니면 Due_Date__c − TODAY() |
| Due_Soon_Notice__c | 마감 임박 안내 | Formula(Text) | 남은 날 3 → "D-3 안내", 1 → "D-1 안내" |
| Mail_Group__c | 메일 분류 | Formula(Text) | 수령이면 빈 값, 기한 초과면 "기한 지난 자료", 보완 요청이면 "보완이 필요한 자료", 그 외 "아직 기한 전인 자료". 독촉 메일 목록의 묶음 기준 |

### 표준·기존 오브젝트 추가

| 오브젝트 | 추가 항목 | 용도 |
| --- | --- | --- |
| Account | EcoAble_Client__c(에코에이블 고객사, Checkbox) | 공용 오브젝트에서 이 앱의 고객사만 필터 |
| Contact | EcoAble_Client_Contact__c(에코에이블 고객사 담당자, Formula = Account.EcoAble_Client__c) | 고객사 담당자 필터 |
| Employee__c | Industry__c 값 "환경 컨설팅" | 연구원 필터 |

## 자동화

Flow 5개와 유효성 규칙 1개가 단계 전환, 할 일 생성, 할 일 완료를 맡는다. 모든 할 일 생성 Flow는 같은 제목의 열린 할 일이 있으면 만들지 않고, 소유자는 프로젝트 소유자, 관련 항목(WhatId)은 프로젝트다.

| Flow | 유형 · 대상 | 시작 조건 | 동작 |
| --- | --- | --- | --- |
| Advance_Project_When_Data_Collected | Record-Triggered(after save) · 데이터 요청 항목 | 상태가 수령으로 바뀜 | 같은 프로젝트에 미수령 항목이 없고 단계가 데이터 수집이면 LCA 산정으로 변경 |
| Create_Data_Request_Reminder_Tasks | Scheduled(매일 16:50 KST) · 데이터 요청 항목 | Days_To_Due__c ≤ 3 | 3일 → [D-3] 마감 임박 안내, 1일 → [D-1] 마감 임박 안내(기한일 = 제출 기한), 0 미만 → [기한 초과] 독촉(우선순위 높음) |
| Create_Revision_Request_Task | Record-Triggered(after save, 생성·수정) · 데이터 요청 항목 | 상태가 보완 요청으로 바뀜 | [보완 요청] 할 일 즉시 생성, 설명에 보완 사유·제출 기한 |
| Create_Info_Request_Tasks | Scheduled(매일 16:50 KST) · 프로젝트 | 단계 ≠ 인증 완료 AND 확인 필요 정보 ≠ "없음" | [정보 확인] 할 일 생성, 설명에 비어 있는 정보 |
| Close_Reminder_Tasks_When_Email_Sent | Record-Triggered(after save) · 프로젝트 | 메일 발송 완료가 true로 바뀜 | 메일 종류에 맞는 열린 할 일 완료 후 발송 완료 시각과 검토 완료 기록 |

### 할 일 제목 규칙

제목 머리말이 할 일의 종류를 구분하며, 끝에 "메일 보내기"가 들어가 리스트 뷰 "에코에이블 안내·독촉 할 일"에 모인다.

- [D-1] ECP-0001 그린팩소재(주) · 원료 투입량 마감 임박 안내 메일 보내기 (DRQ-0023)
- [기한 초과] ECP-0003 누리철강(주) · 운송 정보 독촉 메일 보내기 (DRQ-0015)
- [보완 요청] ECP-0003 누리철강(주) · 폐기물·배출물 보완 요청 메일 보내기 (DRQ-0014)
- [정보 확인] ECP-0005 다온배터리(주) · 프로젝트 정보 확인 메일 보내기

### 메일 종류별로 닫는 할 일

Flow(메일 발송 완료 체크)와 Apex(버튼의 "메일을 보냈어요" 체크)는 같은 규칙을 쓴다.

| 메일 종류 | 닫는 할 일(제목 머리말) |
| --- | --- |
| 독촉 메일(또는 종류 없음) | [기한 초과], [D-3], [D-1], [보완 요청] |
| 마감 임박 안내 | [D-3], [D-1] |
| 보완 요청 | [보완 요청] |
| 정보 확인 | [정보 확인] |

### 유효성 규칙

Received_Date_Required(데이터 요청 항목): AND(ISPICKVAL(Status__c, "수령"), ISBLANK(Received_Date__c))이면 저장을 막는다.

## AI 메일 초안

프로젝트·할 일 화면의 빠른 작업 "AI 메일 초안"(LWC ecoableEmailDraft)이 Apex EcoAbleEmailDraftController를 통해 Prompt Builder Flex 템플릿 4종을 호출한다. 초안은 프로젝트에 저장만 하고 발송하지 않는다.

### 프롬프트 템플릿

| 메일 종류 (draftType) | 템플릿 API 이름 | 다루는 자료 | 보낼 내용이 없을 때 |
| --- | --- | --- | --- |
| 독촉 메일 (reminder) | EcoAble_Data_Request_Reminder | AI는 인사·안내·맺음말과 [자료 목록] 표시만 쓰고, Apex가 메일 분류 순서로 미수령 목록을 채움 | "현재 요청할 미제출 자료가 없습니다." 한 줄 |
| 마감 임박 안내 (dueSoon) | EcoAble_Due_Soon_Notice | 기한이 0~3일 남은 미수령 항목 | "3일 이내에 마감되는 미제출 자료가 없습니다." 한 줄 |
| 보완 요청 (revision) | EcoAble_Revision_Request | 상태가 보완 요청인 항목, 감사 인사 후 보완 사유 | "보완을 요청할 자료가 없습니다." 한 줄 |
| 정보 확인 (info) | EcoAble_Info_Request | Missing_Info__c에 들어 있는 항목만 질문 | "추가로 확인할 프로젝트 정보가 없습니다." 한 줄 |

한 줄 응답에는 모두 "[프로젝트 번호] [고객사] / [대상 제품]:"이 앞에 붙는다. 템플릿 공통 설계는 다음과 같다.

- 입력 이름은 소문자 project이며 병합은 {!$Input:project.필드} 형식이다(대소문자 구분)
- 요청 항목은 {!$Input:project.Data_Requests__r.Records}로 읽는다. 열은 페이지 레이아웃 관련 목록 열에서 오고 JSON의 API 이름으로 전달되므로, 규칙도 Is_Overdue__c 같은 API 이름으로 쓴다
- 본문 구조는 [먼저 확인] 게이트 → [작성 규칙] → [예시] → [프로젝트 정보] 순서다
- 모델은 sfdc_ai__DefaultGPT5Mini, 한국어 스타일 설정(einstein_gpt__koLanguageStyle)을 쓴다

### Apex 컨트롤러 (EcoAbleEmailDraftController, with sharing)

| 메서드 | 역할 |
| --- | --- |
| getDraftContext(Id) | 프로젝트 또는 할 일 Id를 받아 프로젝트를 찾고, 기한 초과·보완·임박 건수, 메일 종류별 열린 할 일 수, 비어 있는 정보, 추천 메일 종류를 돌려준다 |
| generateDraft(Id, String draftType) | ConnectApi.EinsteinLLM.generateMessagesForPromptTemplate를 호출한다(inputParams 키 Input:project, applicationName PromptTemplateGenerationsInvocable). 보낼 내용이 없으면 AI 없이 한 줄 안내를 돌려주고, 생성 결과의 [자료 목록] 표시를 실제 목록으로 채운 뒤 수신자 경고를 보장한다 |
| saveDraft(Id, String draft, String draftType, Boolean completeTasks) | 초안과 메일 종류를 저장한다. completeTasks가 true면 발송 완료·발송 시각·검토 완료를 기록하고 해당 할 일을 완료한다. false면 미검토로 두고 발송 체크를 푼다. 닫은 할 일 수를 돌려준다 |

### 추천 규칙

미수령 항목은 기한 초과 → 보완 요청 → 임박(0~3일) 순서로 한 곳에만 센다. 추천은 위에서부터 처음 맞는 규칙을 따른다.

1. 기한 초과가 있거나, 보완과 임박이 함께 있으면 → 독촉 메일(고객사가 메일을 두 번 받지 않도록 한 통에 모두 포함)
2. 보완만 있으면 → 보완 요청
3. 임박만 있으면 → 마감 임박 안내
4. 자료 문제는 없고 기본 정보가 비어 있으면(인증 완료 제외) → 정보 확인
5. 그 외 → 추천 없음("메일을 보내지 않아도 됩니다")

이 규칙은 EcoAbleEmailDraftController.recommendType()에 한 곳만 있고, 홈 화면도 같은 메서드를 써서 버튼과 홈의 추천이 항상 같다.

### 수신자 경고 보장

생성 결과에 "제목"이 있고(한 줄 응답 제외) "수신자 확인"이 없으며 프로젝트의 Customer_Contact__c가 비어 있으면, 맨 앞에 "※ 고객 담당자 미지정 - 수신자 확인 필요"와 빈 줄을 붙인다. 4종 메일 모두에 적용되며, 템플릿도 같은 줄을 예시에 넣어 이중으로 막는다.

### 한 줄 안내와 자료 목록 채우기

같은 데이터를 받아도 AI가 자료를 다른 묶음에 넣거나 빠뜨리는 경우가 확인되어, 정확해야 하는 부분은 Apex가 만든다.

- 보낼 내용이 없을 때: 독촉(미수령 0건), 마감 임박(0~3일 남은 미수령 0건), 보완 요청(보완 요청 0건), 정보 확인(확인 필요 정보 = "없음")이면 AI를 호출하지 않고 한 줄 안내를 돌려준다
- 자료 목록: 생성 결과에 [자료 목록]이 있으면 그 자리에 "- 데이터 구분 - 요청 내용 (제출 기한)" 줄을 넣는다. 독촉 메일은 Mail_Group__c 순서(제출 기한이 지난 자료 → 보완이 필요한 자료 → 아직 기한 전인 자료)로 묶고 보완 자료 아래에 보완 사유를 붙인다. 마감 임박 안내는 "D-n" 또는 "오늘 마감"을 붙인다
- 적용 범위: 현재 독촉 메일 템플릿이 이 표시를 쓴다. 마감 임박·보완 요청 템플릿도 표시를 쓰면 같은 방식으로 채워진다
- 검증: 버튼과 같은 API 방식으로 ECP-0001·ECP-0003을 2번씩 생성해 4번 모두 목록이 정확했다

테스트에서는 Test.isRunningTest()일 때 LLM 대신 mockGeneration 값을 쓴다. 오류는 사용자에게 보여 줄 한국어 메시지를 담은 AuraHandledException으로 돌려준다.

## 요청 항목 만들기

프로젝트 화면의 빠른 작업 "요청 항목 만들기"(LWC ecoableDataRequestCreator)는 데이터 구분 선택 목록을 실행 시점에 읽어 완성한 화면에서, 고른 자료만 요청 항목으로 한 번에 만든다. 구분 값을 설정에서 추가하면 코드 수정 없이 화면에 나타난다.

### Apex 컨트롤러 (EcoAbleDataRequestController, with sharing)

| 메서드 | 역할 |
| --- | --- |
| getSetup(Id projectId) | 프로젝트 라벨, 진행 단계, 기본 마감일(오늘 + 14일), 활성 구분별 기본 요청 내용과 이미 있는지 여부를 돌려준다 |
| createRequests(Id projectId, Date dueDate, List<RequestInput>) | 마감일과 구분을 검증하고, 이미 있는 구분은 건너뛰며 요청 항목을 만든다. 하나 이상 만들었고 단계가 접수면 데이터 수집으로 바꾼다. 만든 수, 건너뛴 구분, 단계 전환 여부를 돌려준다 |

### 규칙

- 구분 목록: Data_Category__c의 활성 선택 목록 값을 화면 순서대로 읽는다(Schema describe)
- 화면 기본값: 이미 있는 구분은 회색으로 "이미 있어요 · 건너뜀" 표시·선택 불가, 나머지는 체크된 상태. 체크를 풀면 요청 내용 칸이 숨는다
- 마감일: 필수, 오늘 이후(화면과 서버에서 모두 검사)
- 요청 내용: 앞뒤 공백 제거, 255자 제한. 비우면 "[구분] 관련 연간 데이터(수량·단위 포함)"
- 생성되는 항목: 상태 요청, 제출 기한 = 고른 마감일
- 같은 구분이 한 요청에 두 번 들어오면 하나만 만든다. 목록에 없는 구분은 거부한다
- 저장점(Savepoint)으로 항목 생성과 단계 변경을 하나로 묶어, 실패하면 모두 되돌린다
- 완료 후 알림(토스트)으로 결과를 보여 주고 RefreshEvent로 관련 목록을 새로 고친다

## 화면 구성

앱 "에코에이블 인증 관리"(EcoAble_Certification)는 에코에이블 홈, 인증 컨설팅 프로젝트, 데이터 요청 항목, 할 일, 고객사, 연락처, 직원 탭으로 구성된다. 프로젝트 화면은 전용 레코드 페이지가 조직 기본으로 지정되어 있다.

### 프로젝트 화면

- 레코드 페이지 EPD_Project_Record_Page: 상단에 하이라이트 패널(작업 3개 표시)과 진행 단계 막대, 본문에 상세·관련 탭, 오른쪽에 활동. 오브젝트의 View 재정의(데스크톱)로 지정
- 페이지 레이아웃 섹션: 프로젝트 개요(확인 필요 정보 포함), 일정과 데이터 수집, 메모, AI 데이터 요청 메일, 시스템 정보
- 작업 순서: AI 메일 초안, 요청 항목 만들기, 편집, 복제, 삭제
- 요청 항목 관련 목록 열: 번호, 데이터 구분, 요청 내용, 상태, 제출 기한, 수령일, 기한 초과, 마감까지 남은 날, 마감 임박 안내, 보완 사유, 메일 분류(프롬프트가 이 열을 읽는다)

### 진행 단계 막대 (Path EPD_Project_Stage)

| 단계 | 핵심 필드 | 안내 요약 |
| --- | --- | --- |
| 접수 | 고객 담당자, 인증 종류, 목표 인증일, 확인 필요 정보, 담당 연구원 | 빈 정보는 정보 확인 메일로 문의, 요청 항목 만들기로 자료 요청 |
| 데이터 수집 | 착수일, 요청 항목 수, 수령 완료 수, 데이터 수집률, 목표 인증일 | 받으면 수령과 수령일 입력, 모두 수령하면 자동 전환 |
| LCA 산정 | 데이터 수집률, 담당 연구원, 목표 인증일 | 빠진 자료는 보완 요청과 보완 사유 입력 |
| 검증 심사 대응 | 인증 종류, 담당 연구원, 목표 인증일 | 심사 의견 대응, 추가 자료는 요청 항목으로 등록 |
| 인증 완료 | 인증 종류, 목표 인증일, 담당 연구원 | 인증 번호·유효기간을 메모에 기록 |

### 에코에이블 홈

앱 첫 탭 EcoAble_Home(앱 페이지)에 LWC ecoableHome을 두고, Apex EcoAbleHomeController가 집계한다(읽기 전용, 캐시 가능, 새로 고침 버튼).

- 숫자 칸 7개(getSummary): 진행 중 프로젝트, 전체 데이터 수집률(진행 중 프로젝트의 요청 항목 중 수령 비율), 기한 초과 요청, 3일 안에 마감, 보완 요청, 정보가 빈 프로젝트, 열린 메일 할 일. 모두 집계 쿼리(COUNT)로 세어 데이터가 많아도 정확하다
- 단계별 프로젝트: 단계를 누르면 현황표가 그 단계만 보여 주고, 다시 누르면 전체
- 프로젝트 현황표(getProjects): 거르기 줄(주의 필요만 기본 켜짐, 담당 연구원, 검색, 인증 완료도 보기). 검색어가 있으면 숨김 조건을 무시하고 모든 프로젝트에서 찾는다. 기한 초과 > 보완 > 임박 > 정보 누락 순으로 정렬, 10개씩 "더 보기"
- 주의가 필요한 요청 항목과 열린 메일 할 일도 급한 순서로 10개씩 + 전체 목록 바로가기

### 리스트 뷰 (모두 전체 사용자 공개)

| 오브젝트 | 리스트 뷰 | 조건 |
| --- | --- | --- |
| 인증 컨설팅 프로젝트 | 전체 프로젝트 (All) | 전체 |
| 데이터 요청 항목 | 기한 초과 요청 (Overdue_Requests) | 기한 초과 = true |
| 데이터 요청 항목 | 마감 임박 요청 (Due_Soon_Requests) | 마감까지 남은 날 0~3 |
| 할 일 | 에코에이블 안내·독촉 할 일 (EcoAble_Reminder_Tasks) | 제목에 "메일 보내기" 포함, 열린 할 일 |
| 고객사 | EcoAble_Clients | 에코에이블 고객사 = true |
| 연락처 | EcoAble_Client_Contacts | 에코에이블 고객사 담당자 = true |
| 직원 | EcoAble_Researchers | 업종 = 환경 컨설팅 |

## 권한, 테스트, 배포

Apex 테스트 22개가 모두 통과하고 커버리지는 메일 초안 컨트롤러 97%, 요청 항목 컨트롤러 96%, 홈 컨트롤러 99%다. 모든 배포는 검증 배포(dry-run) 후 실제 배포했다.

### 권한

- 관리자 프로필(Admin.profile-meta.xml 부분 배포)로 오브젝트·필드 권한, 탭 표시, 앱 접근을 부여한다
- Apex는 with sharing, 조회는 WITH USER_MODE, 저장은 AccessLevel.USER_MODE로 사용자 권한을 따른다

### 테스트

| 테스트 클래스 | 테스트 수 | 대상 커버리지 | 주요 검증 |
| --- | --- | --- | --- |
| EcoAbleEmailDraftControllerTest | 15 | EcoAbleEmailDraftController 97% | 메일 4종 생성·거부, 보낼 내용이 없을 때 한 줄 안내, [자료 목록] 채우기, 추천 규칙, 할 일 화면 경로, 메일별 할 일 완료, 발송 체크 Flow 연동, 보완 요청 할 일 생성·중복 방지, 수신자 경고 |
| EcoAbleDataRequestControllerTest | 4 | EcoAbleDataRequestController 96% | 구분 목록·기본값, 선택 생성·건너뜀·단계 전환, 전환하지 않는 경우, 잘못된 입력 거부 |
| EcoAbleHomeControllerTest | 3 | EcoAbleHomeController 99% | 집계 쿼리 숫자 칸·단계별 건수, 거르기(주의 필요만·단계·검색·연구원·인증 완료), 더 보기, 프로젝트 정렬·추천 메일, 추천 규칙 공유 |

예약 Flow는 Apex 테스트로 실행할 수 없어, 조직에서 실제 실행 결과(할 일 5건 생성)로 확인했다. AI 생성은 익명 Apex로 generateDraft를 호출해 실제 출력을 확인했다.

### 배포

```bash
sf project deploy start --source-dir force-app --target-org <alias> --dry-run --test-level RunSpecifiedTests --tests EcoAbleEmailDraftControllerTest --tests EcoAbleDataRequestControllerTest --tests EcoAbleHomeControllerTest
sf project deploy start --source-dir force-app --target-org <alias> --test-level RunSpecifiedTests --tests EcoAbleEmailDraftControllerTest --tests EcoAbleDataRequestControllerTest --tests EcoAbleHomeControllerTest
sf apex run --file scripts/apex/load_sample_data.apex --target-org <alias>
```

- Path 설정(settings/PathAssistant)을 먼저 배포한 뒤 Path와 레코드 페이지를 배포한다
- 보완 요청·정보 확인 템플릿은 Prompt Builder에서 만들고 활성화한다. 내려받은 독촉·마감 임박 템플릿은 활성 버전과 충돌하지 않게 주의해 재배포한다
- 화면 변경은 브라우저 캐시 때문에 로그아웃 후 다시 로그인해야 보인다

## 샘플 데이터와 운영 스크립트

샘플은 가상 데이터로 연구원 2명, 고객사 5곳, 고객 담당자 4명, 프로젝트 6건, 요청 항목 24건이다. 스크립트는 `salesforce-demo/scripts/apex`에 있다.

| 스크립트 | 용도 |
| --- | --- |
| load_sample_data.apex | 연구원, 고객사, 담당자, 프로젝트 6건, 요청 항목 22건을 한 트랜잭션으로 등록(실패 시 전체 취소) |
| load_due_soon_samples.apex | 실행일 기준 D-1(ECP-0001, DRQ-0023), D-3(ECP-0003, DRQ-0024) 항목 추가 |
| backfill_mail_tasks.apex | Flow 추가 전 데이터에 보완 요청·정보 확인 할 일 생성. 반복 실행해도 중복 없음 |
| reset_demo_state.apex | 시연 전 상태로 되돌림: ECP-0002를 1건 남음(80%)으로, ECP-0003·ECP-0005의 메일 기록 초기화, 닫힌 메일 할 일 다시 열기. 요청 항목은 삭제하지 않음 |

## 알려진 제약

| 제약 | 영향 | 대응 |
| --- | --- | --- |
| 예약 Flow 시작 시각은 조직 시간대 00:50 기준 | 서머타임 기간 16:50 KST, 서머타임 종료(2026년 11월 1일) 후 17:50 KST에 실행. 날짜는 한국과 같은 날로 맞음 | 운영에서는 조직 시간대를 Asia/Seoul로 바꾼 뒤 오전 실행으로 조정 |
| 기한 초과·정보 확인 할 일은 조건이 남아 있으면 다음 날 다시 생성 | 알림 피로 | 생성 주기 조정 검토 |
| 요청 내용 기본 문장이 Apex에 들어 있음 | 문장 변경 시 배포 필요 | 사용자 지정 메타데이터로 이전(로드맵 1번) |
| 할 일은 프로젝트 소유자에게 배정 | 담당 연구원(Employee__c)은 Salesforce 사용자가 아니라 직접 배정 불가 | 연구원과 사용자 연결 |
| 보완 요청 시 단계 되돌림 없음 | LCA 산정 중 자료가 다시 비어도 단계 유지 | 로드맵 2번 |
| Prompt Builder 미리보기는 Apex 보정을 거치지 않음 | 미리보기에서는 수신자 경고가 빠질 수 있고, 독촉 메일의 [자료 목록]이 빈칸으로 보임 | 실제 버튼에서는 Apex가 경고와 목록을 보장 |
| 요청 항목 만들기로 만든 항목은 되돌리기 스크립트가 지우지 않음 | 시연 후 ECP-0005 상태가 남음 | 사용자가 직접 삭제하거나 연습용 프로젝트 사용 |
| 전용 레코드 페이지는 데스크톱(Large)에만 지정 | 모바일은 기본 화면 | 필요 시 모바일 페이지 추가 |
