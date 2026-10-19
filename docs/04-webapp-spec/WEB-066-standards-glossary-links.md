# WEB-066 적용 기준 설명과 용어사전 연결

사용자 실습 중 범위 정의의 적용 기준 8개를 쉽게 설명하고 이름을 눌러 사전으로 이동하도록 요청했다.

## 범위

- 기존 6개(ISO 14040/44·ISO 14067·EN 15804+A2·PCR·PACT·Catena-X) 설명을 보충하고 누락된 GHG Protocol Product·PEF를 추가한다. 적용 기준 8개 전체를 고정 ID로 연결한다.
- 범위 입력의 체크박스는 선택, 기준 이름 링크는 설명 보기로 분리한다. 링크를 눌러 적용 여부를 바꾸거나 범위를 확정/저장하지 않는다. 상세의 저장된 적용 기준에서도 같은 설명을 연다.
- 사전 검색과 6개 페이지를 활용해 대상 카드를 보여주고 초점/강조를 제공한다. 돌아가기 버튼으로 기존 프로젝트 화면과 클릭 위치로 돌아오며 메모·날짜·체크박스 초안을 유지한다. 이전 사전 검색/페이지도 복구한다.
- 사전 설명에는 쉬운 뜻·가상 예시·공식 출처와 이번 8개 항목의 확인일을 제공한다. 전체 사전 항목을 모두 다시 확인했다고 표시하지 않는다.
- 국제표준, 환경발자국 방법, 제품군별 지침, 공급망 데이터 규칙을 하나의 의무 목록으로 설명하지 않는다. 어떤 기준을 선택할지는 고객·제도 요구에 따라 결정하며 자동 적합성 판단은 없다.
- 업무 저장 키/단계/보고서 사본/범위 저장 규칙은 유지한다. AI 입력 보조는 대기 목록에 둔다.

## 참고 원문 (2026-10-19)

- [ISO 14040](https://www.iso.org/standard/37456.html), [ISO 14044](https://www.iso.org/standard/38498.html), [ISO 14067](https://www.iso.org/standard/71206.html)
- [GHG Protocol Product Standard](https://ghgprotocol.org/product-standard)
- [유럽위원회 EF/PEF 방법](https://green-forum.ec.europa.eu/green-business/environmental-footprint-methods/about-ef-methods_en)
- [BSI EN 15804+A2](https://knowledge.bsigroup.com/products/sustainability-of-construction-works-environmental-product-declarations-core-rules-for-the-product-category-of-construction-products-2)
- [EPD International PCR](https://www.environdec.com/services/what-is-pcr)
- [PACT 방법론](https://www.carbon-transparency.org/pact-methodology)
- [Catena-X PCF Rulebooks](https://catenax-ev.github.io/docs/rulebooks/overview)

## 확인 범위

- 변경 JavaScript 5개 구문과 Git 공백을 확인했다. 자동 테스트는 추가·실행하지 않았다. 과거 WEB-061의 267개는 이번 결과가 아니다.
- 임시 탭에서 범위 입력의 8개 체크박스/설명 링크 표시, PEF 설명 이동·초점·원문 링크·항목 확인일·돌아가기와 미저장 메모/다른 기준 체크 유지, 클릭한 PEF 체크가 바뀌지 않음을 확인했다. 오류 로그는 없었다. 임시 입력을 저장하지 않았고 원래 사용자 탭·업무 기록은 바꾸지 않았다.
- 다른 7개 링크 각각의 실제 이동, 저장된 기준 요약 링크·사전 검색/페이지 복귀·키보드/모바일의 전체 확인은 남아 있다. 고정 ID 매핑과 코드 연결을 실제 모든 조작 확인으로 설명하지 않는다.
