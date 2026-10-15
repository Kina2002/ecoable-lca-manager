// 에코에이블 인증 관리 앱 가상 샘플 데이터 (모두 가상의 회사·인물입니다)
// 한 트랜잭션으로 실행되어, 중간에 실패하면 전체가 취소됩니다.

Employee__c han = new Employee__c(Name = '한소윤', Employee_Number__c = 'EMP-ECO-001', Industry__c = '환경 컨설팅', Department__c = '전과정정책본부', Role__c = '선임연구원');
Employee__c lee = new Employee__c(Name = '이도현', Employee_Number__c = 'EMP-ECO-002', Industry__c = '환경 컨설팅', Department__c = '전과정정책본부', Role__c = '연구원');
insert new List<Employee__c>{ han, lee };

Account greenpack = new Account(Name = '그린팩소재(주)', EcoAble_Client__c = true, Description = '식품 포장용 PET 필름 제조');
Account hanbit = new Account(Name = '한빛케미칼(주)', EcoAble_Client__c = true, Description = '산업용·건축용 도료 제조');
Account nuri = new Account(Name = '누리철강(주)', EcoAble_Client__c = true, Description = '냉연 강판 제조');
Account saebom = new Account(Name = '새봄식품(주)', EcoAble_Client__c = true, Description = '생수·음료 제조');
Account daon = new Account(Name = '다온배터리(주)', EcoAble_Client__c = true, Description = 'ESS용 배터리 팩 제조');
insert new List<Account>{ greenpack, hanbit, nuri, saebom, daon };

Contact cGreen = new Contact(LastName = '김가람', Title = '품질환경팀 과장', AccountId = greenpack.Id);
Contact cHanbit = new Contact(LastName = '박서진', Title = 'ESG전략팀 대리', AccountId = hanbit.Id);
Contact cNuri = new Contact(LastName = '최우람', Title = '환경안전팀 차장', AccountId = nuri.Id);
Contact cSaebom = new Contact(LastName = '윤다솜', Title = '생산관리팀 주임', AccountId = saebom.Id);
insert new List<Contact>{ cGreen, cHanbit, cNuri, cSaebom };

List<EPD_Certification_Project__c> projects = new List<EPD_Certification_Project__c>{
    new EPD_Certification_Project__c(Customer_Account__c = greenpack.Id, Customer_Contact__c = cGreen.Id, Lead_Researcher__c = han.Id,
        Product_Name__c = 'PET 포장 필름', Certification_Type__c = '환경성적표지', Stage__c = '데이터 수집',
        Kickoff_Date__c = Date.newInstance(2026, 9, 22), Target_Certification_Date__c = Date.newInstance(2026, 12, 15),
        Notes__c = '운송·폐기물 데이터가 기한을 넘겨 LCA 산정 착수가 지연되고 있음.'),
    new EPD_Certification_Project__c(Customer_Account__c = hanbit.Id, Customer_Contact__c = cHanbit.Id, Lead_Researcher__c = lee.Id,
        Product_Name__c = '수성 친환경 도료', Certification_Type__c = 'International EPD', Stage__c = '데이터 수집',
        Kickoff_Date__c = Date.newInstance(2026, 9, 15), Target_Certification_Date__c = Date.newInstance(2026, 12, 20),
        Notes__c = '출하 운송거리 데이터 1건만 남음.'),
    new EPD_Certification_Project__c(Customer_Account__c = nuri.Id, Customer_Contact__c = cNuri.Id, Lead_Researcher__c = han.Id,
        Product_Name__c = '냉연 강판', Certification_Type__c = 'EPD Norway', Stage__c = '데이터 수집',
        Kickoff_Date__c = Date.newInstance(2026, 9, 1), Target_Certification_Date__c = Date.newInstance(2026, 11, 28),
        Notes__c = '폐기물 처리 방법 구분 누락으로 보완 요청함.'),
    new EPD_Certification_Project__c(Customer_Account__c = saebom.Id, Customer_Contact__c = cSaebom.Id, Lead_Researcher__c = lee.Id,
        Product_Name__c = '500mL 생수 PET병', Certification_Type__c = 'Carbon Trust', Stage__c = 'LCA 산정',
        Kickoff_Date__c = Date.newInstance(2026, 8, 25), Target_Certification_Date__c = Date.newInstance(2026, 11, 14),
        Notes__c = '데이터 수집 완료, LCA 모델링 진행 중.'),
    new EPD_Certification_Project__c(Customer_Account__c = daon.Id, Lead_Researcher__c = han.Id,
        Product_Name__c = 'ESS 배터리 팩', Certification_Type__c = 'UL EPD', Stage__c = '접수',
        Notes__c = '고객사 담당자 미정. 평가 범위(셀·모듈·팩)와 목표 인증일 확인 필요.'),
    new EPD_Certification_Project__c(Customer_Account__c = hanbit.Id, Customer_Contact__c = cHanbit.Id, Lead_Researcher__c = lee.Id,
        Product_Name__c = '유성 산업용 도료', Certification_Type__c = '환경성적표지', Stage__c = '인증 완료',
        Kickoff_Date__c = Date.newInstance(2026, 5, 11), Target_Certification_Date__c = Date.newInstance(2026, 8, 29),
        Notes__c = '2026-08-27 인증 취득.')
};
insert projects;
Id p1 = projects[0].Id; Id p2 = projects[1].Id; Id p3 = projects[2].Id; Id p4 = projects[3].Id; Id p6 = projects[5].Id;

List<Data_Request_Item__c> items = new List<Data_Request_Item__c>{
    // ECP-0001 그린팩소재: 수령 4, 기한 초과 2
    new Data_Request_Item__c(Project__c = p1, Data_Category__c = '원료 투입량', Request_Detail__c = 'PET 칩·첨가제 연간 투입량(kg)', Status__c = '수령', Due_Date__c = Date.newInstance(2026, 9, 30), Received_Date__c = Date.newInstance(2026, 9, 29)),
    new Data_Request_Item__c(Project__c = p1, Data_Category__c = '에너지(전력·연료) 사용량', Request_Detail__c = '압출·연신 공정 전력 사용량(kWh)', Status__c = '수령', Due_Date__c = Date.newInstance(2026, 9, 30), Received_Date__c = Date.newInstance(2026, 10, 2)),
    new Data_Request_Item__c(Project__c = p1, Data_Category__c = '용수 사용량', Request_Detail__c = '냉각수 사용량(m³)', Status__c = '수령', Due_Date__c = Date.newInstance(2026, 10, 7), Received_Date__c = Date.newInstance(2026, 10, 6)),
    new Data_Request_Item__c(Project__c = p1, Data_Category__c = '포장재 정보', Request_Detail__c = '출하 포장재 종류·중량', Status__c = '수령', Due_Date__c = Date.newInstance(2026, 10, 7), Received_Date__c = Date.newInstance(2026, 10, 7)),
    new Data_Request_Item__c(Project__c = p1, Data_Category__c = '운송 정보', Request_Detail__c = '원료 입고 운송거리·운송수단', Status__c = '요청', Due_Date__c = Date.newInstance(2026, 10, 10)),
    new Data_Request_Item__c(Project__c = p1, Data_Category__c = '폐기물·배출물', Request_Detail__c = '공정 스크랩·폐기물 발생량과 처리 방법', Status__c = '요청', Due_Date__c = Date.newInstance(2026, 10, 10)),
    // ECP-0002 한빛케미칼 수성 도료: 수령 4, 요청 1 (기한 전) - 시연용
    new Data_Request_Item__c(Project__c = p2, Data_Category__c = '원료 투입량', Request_Detail__c = '수지·안료·용제 배합비와 투입량', Status__c = '수령', Due_Date__c = Date.newInstance(2026, 9, 25), Received_Date__c = Date.newInstance(2026, 9, 24)),
    new Data_Request_Item__c(Project__c = p2, Data_Category__c = '에너지(전력·연료) 사용량', Request_Detail__c = '배합·충진 공정 전력·LNG 사용량', Status__c = '수령', Due_Date__c = Date.newInstance(2026, 9, 25), Received_Date__c = Date.newInstance(2026, 9, 26)),
    new Data_Request_Item__c(Project__c = p2, Data_Category__c = '용수 사용량', Request_Detail__c = '설비 세척수 사용량(m³)', Status__c = '수령', Due_Date__c = Date.newInstance(2026, 10, 2), Received_Date__c = Date.newInstance(2026, 10, 1)),
    new Data_Request_Item__c(Project__c = p2, Data_Category__c = '포장재 정보', Request_Detail__c = '18L 캔 포장재 중량', Status__c = '수령', Due_Date__c = Date.newInstance(2026, 10, 2), Received_Date__c = Date.newInstance(2026, 10, 2)),
    new Data_Request_Item__c(Project__c = p2, Data_Category__c = '운송 정보', Request_Detail__c = '제품 출하 운송거리(권역별)', Status__c = '요청', Due_Date__c = Date.newInstance(2026, 10, 24)),
    // ECP-0003 누리철강: 수령 2, 보완 요청 1, 기한 초과 1
    new Data_Request_Item__c(Project__c = p3, Data_Category__c = '원료 투입량', Request_Detail__c = '열연코일 투입량(톤)', Status__c = '수령', Due_Date__c = Date.newInstance(2026, 9, 15), Received_Date__c = Date.newInstance(2026, 9, 14)),
    new Data_Request_Item__c(Project__c = p3, Data_Category__c = '에너지(전력·연료) 사용량', Request_Detail__c = '산세·압연 공정 전력·LNG 사용량', Status__c = '수령', Due_Date__c = Date.newInstance(2026, 9, 15), Received_Date__c = Date.newInstance(2026, 9, 18)),
    new Data_Request_Item__c(Project__c = p3, Data_Category__c = '폐기물·배출물', Request_Detail__c = '슬러지·폐산 발생량과 처리 방법', Status__c = '보완 요청', Due_Date__c = Date.newInstance(2026, 10, 20), Revision_Reason__c = '처리 방법(재활용·소각·매립) 구분이 누락되어 재요청'),
    new Data_Request_Item__c(Project__c = p3, Data_Category__c = '운송 정보', Request_Detail__c = '코일 입고·출하 운송거리와 운송수단', Status__c = '요청', Due_Date__c = Date.newInstance(2026, 10, 8)),
    // ECP-0004 새봄식품: 모두 수령
    new Data_Request_Item__c(Project__c = p4, Data_Category__c = '원료 투입량', Request_Detail__c = '프리폼·캡·라벨 투입량', Status__c = '수령', Due_Date__c = Date.newInstance(2026, 9, 5), Received_Date__c = Date.newInstance(2026, 9, 4)),
    new Data_Request_Item__c(Project__c = p4, Data_Category__c = '에너지(전력·연료) 사용량', Request_Detail__c = '블로잉·충진 공정 전력 사용량', Status__c = '수령', Due_Date__c = Date.newInstance(2026, 9, 5), Received_Date__c = Date.newInstance(2026, 9, 5)),
    new Data_Request_Item__c(Project__c = p4, Data_Category__c = '용수 사용량', Request_Detail__c = '제품수·세척수 사용량', Status__c = '수령', Due_Date__c = Date.newInstance(2026, 9, 12), Received_Date__c = Date.newInstance(2026, 9, 11)),
    new Data_Request_Item__c(Project__c = p4, Data_Category__c = '운송 정보', Request_Detail__c = '물류센터 배송 거리', Status__c = '수령', Due_Date__c = Date.newInstance(2026, 9, 12), Received_Date__c = Date.newInstance(2026, 9, 15)),
    // ECP-0006 한빛케미칼 유성 도료: 인증 완료
    new Data_Request_Item__c(Project__c = p6, Data_Category__c = '원료 투입량', Request_Detail__c = '수지·안료·용제 투입량', Status__c = '수령', Due_Date__c = Date.newInstance(2026, 5, 29), Received_Date__c = Date.newInstance(2026, 5, 28)),
    new Data_Request_Item__c(Project__c = p6, Data_Category__c = '에너지(전력·연료) 사용량', Request_Detail__c = '공정 전력·스팀 사용량', Status__c = '수령', Due_Date__c = Date.newInstance(2026, 5, 29), Received_Date__c = Date.newInstance(2026, 6, 1)),
    new Data_Request_Item__c(Project__c = p6, Data_Category__c = '포장재 정보', Request_Detail__c = '200L 드럼 포장재 중량', Status__c = '수령', Due_Date__c = Date.newInstance(2026, 6, 5), Received_Date__c = Date.newInstance(2026, 6, 4))
};
insert items;
System.debug('LOAD_OK employees=2 accounts=5 contacts=4 projects=' + projects.size() + ' items=' + items.size());
