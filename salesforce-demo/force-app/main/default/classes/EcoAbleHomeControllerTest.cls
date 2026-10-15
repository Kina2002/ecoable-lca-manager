@IsTest
private class EcoAbleHomeControllerTest {
    @TestSetup
    static void setup() {
        Employee__c researcher = new Employee__c(Name = '홈 연구원', Employee_Number__c = 'EMP-HOME-001', Industry__c = '환경 컨설팅', Department__c = '전과정정책본부', Role__c = '연구원');
        insert researcher;
        Account acc = new Account(Name = '홈 테스트 고객사', EcoAble_Client__c = true);
        Account other = new Account(Name = '다른 고객사', EcoAble_Client__c = true);
        insert new List<Account>{ acc, other };
        Contact c = new Contact(LastName = '담당', AccountId = acc.Id);
        insert c;
        EPD_Certification_Project__c busy = new EPD_Certification_Project__c(
            Customer_Account__c = acc.Id, Customer_Contact__c = c.Id, Lead_Researcher__c = researcher.Id, Product_Name__c = '바쁜 제품',
            Stage__c = '데이터 수집', Target_Certification_Date__c = Date.today().addDays(60)
        );
        EPD_Certification_Project__c fresh = new EPD_Certification_Project__c(Customer_Account__c = other.Id, Product_Name__c = '새 제품', Stage__c = '접수');
        EPD_Certification_Project__c calm = new EPD_Certification_Project__c(
            Customer_Account__c = acc.Id, Customer_Contact__c = c.Id, Product_Name__c = '조용한 제품',
            Stage__c = 'LCA 산정', Target_Certification_Date__c = Date.today().addDays(90)
        );
        EPD_Certification_Project__c done = new EPD_Certification_Project__c(Customer_Account__c = acc.Id, Product_Name__c = '끝난 제품', Stage__c = '인증 완료');
        insert new List<EPD_Certification_Project__c>{ busy, fresh, calm, done };
        insert new List<Data_Request_Item__c>{
            new Data_Request_Item__c(Project__c = busy.Id, Data_Category__c = '운송 정보', Status__c = '요청', Due_Date__c = Date.today().addDays(-3)),
            new Data_Request_Item__c(Project__c = busy.Id, Data_Category__c = '폐기물·배출물', Status__c = '보완 요청', Due_Date__c = Date.today().addDays(10), Revision_Reason__c = '누락'),
            new Data_Request_Item__c(Project__c = busy.Id, Data_Category__c = '원료 투입량', Status__c = '요청', Due_Date__c = Date.today()),
            new Data_Request_Item__c(Project__c = busy.Id, Data_Category__c = '용수 사용량', Status__c = '수령', Due_Date__c = Date.today().addDays(-5), Received_Date__c = Date.today().addDays(-6)),
            new Data_Request_Item__c(Project__c = calm.Id, Data_Category__c = '운송 정보', Status__c = '수령', Due_Date__c = Date.today().addDays(-8), Received_Date__c = Date.today().addDays(-9)),
            new Data_Request_Item__c(Project__c = done.Id, Data_Category__c = '포장재 정보', Status__c = '수령', Due_Date__c = Date.today().addDays(-30), Received_Date__c = Date.today().addDays(-31))
        };
        insert new Task(Subject = '[기한 초과] 테스트 독촉 메일 보내기', WhatId = busy.Id, OwnerId = UserInfo.getUserId(), ActivityDate = Date.today());
    }

    private static List<String> products(EcoAbleHomeController.ProjectPage page) {
        List<String> names = new List<String>();
        for (EcoAbleHomeController.ProjectRow r : page.rows) { names.add(r.productName); }
        return names;
    }

    @IsTest
    static void summarizesWithAggregateCounts() {
        EcoAbleHomeController.Summary s = EcoAbleHomeController.getSummary(10, 10);
        EcoAbleHomeController.Kpis k = s.kpis;
        Assert.areEqual(Date.today(), s.today);
        Assert.areEqual(3, k.activeProjects);
        Assert.areEqual(1, k.completedProjects);
        Assert.areEqual(5, k.activeRequests, '진행 중 프로젝트의 요청 항목만');
        Assert.areEqual(2, k.receivedRequests);
        Assert.areEqual(40, k.collectionRate, '2 / 5 = 40%');
        Assert.areEqual(1, k.overdueItems);
        Assert.areEqual(1, k.revisionItems);
        Assert.areEqual(1, k.dueSoonItems);
        Assert.areEqual(1, k.missingInfoProjects, '접수 단계 새 프로젝트만 정보 누락');
        Assert.isTrue(k.openMailTasks >= 2, '직접 만든 할 일 + 보완 요청 Flow가 만든 할 일');

        Assert.areEqual(5, s.stages.size());
        Assert.areEqual('접수', s.stages[0].stage);
        Assert.areEqual(1, s.stages[0].count);
        Assert.areEqual(1, s.researchers.size());
        Assert.areEqual('홈 연구원', s.researchers[0].label);

        Assert.areEqual(3, s.attentionItems.size());
        Assert.areEqual('overdue', s.attentionItems[0].kind);
        Assert.areEqual('기한 초과 3일', s.attentionItems[0].label);
        Assert.areEqual('오늘 마감', s.attentionItems[1].label);
        Assert.areEqual('보완 요청', s.attentionItems[2].label);
        Set<String> kinds = new Set<String>();
        for (EcoAbleHomeController.TaskRow tr : s.tasks) { kinds.add(tr.kind); }
        Assert.isTrue(kinds.contains('overdue') && kinds.contains('revision'), String.valueOf(kinds));

        EcoAbleHomeController.Summary small = EcoAbleHomeController.getSummary(1, 1);
        Assert.areEqual(1, small.attentionItems.size(), '주의 항목은 지정한 개수까지만');
        Assert.areEqual(1, small.tasks.size());
        Assert.areEqual(k.openMailTasks, small.kpis.openMailTasks, '숫자 칸은 목록 개수와 상관없이 전체');
    }

    @IsTest
    static void filtersAndPagesProjects() {
        // 기본: 주의 필요만, 인증 완료 제외 -> 바쁜(기한 초과) > 새(정보 누락)
        EcoAbleHomeController.ProjectPage attention = EcoAbleHomeController.getProjects(true, false, null, null, null, 10);
        Assert.areEqual(new List<String>{ '바쁜 제품', '새 제품' }, products(attention));
        Assert.areEqual(2, attention.totalCount);
        Assert.isFalse(attention.hasMore);
        EcoAbleHomeController.ProjectRow busy = attention.rows[0];
        Assert.areEqual(1, busy.overdue);
        Assert.areEqual(1, busy.revision);
        Assert.areEqual(1, busy.dueSoon);
        Assert.areEqual('reminder', busy.recommendedType);
        Assert.areEqual('독촉 메일', busy.recommendedLabel);
        Assert.areEqual(Date.today().addDays(-3), busy.nextDueDate);
        Assert.areEqual('홈 연구원', busy.researcher);
        Assert.areEqual('info', attention.rows[1].recommendedType);

        // 전체 보기: 주의 프로젝트 먼저, 그다음 나머지(이름순). 인증 완료는 스위치를 켜야 보임
        Assert.areEqual(new List<String>{ '바쁜 제품', '새 제품', '조용한 제품' }, products(EcoAbleHomeController.getProjects(false, false, null, null, null, 10)));
        EcoAbleHomeController.ProjectPage all = EcoAbleHomeController.getProjects(false, true, null, null, null, 10);
        Assert.areEqual(4, all.totalCount);
        Assert.areEqual('끝난 제품', all.rows[3].productName);
        Assert.isNull(all.rows[3].recommendedType);

        // 더 보기: 1개씩
        EcoAbleHomeController.ProjectPage first = EcoAbleHomeController.getProjects(false, true, null, null, null, 1);
        Assert.areEqual(1, first.rows.size());
        Assert.areEqual(4, first.totalCount);
        Assert.isTrue(first.hasMore);

        // 단계 화살표: 고른 단계만 (인증 완료도 스위치와 상관없이)
        Assert.areEqual(new List<String>{ '끝난 제품' }, products(EcoAbleHomeController.getProjects(false, false, '인증 완료', null, null, 10)));
        Assert.areEqual(new List<String>{ '조용한 제품' }, products(EcoAbleHomeController.getProjects(false, false, 'LCA 산정', null, null, 10)));

        // 검색: 제품 이름, 고객사 이름
        Assert.areEqual(new List<String>{ '새 제품' }, products(EcoAbleHomeController.getProjects(false, true, null, null, '새 제', 10)));
        Assert.areEqual(new List<String>{ '새 제품' }, products(EcoAbleHomeController.getProjects(false, true, null, null, '다른 고객', 10)));

        // 검색어가 있으면 "주의 필요만"·"인증 완료 숨기기"가 켜져 있어도 모든 프로젝트에서 찾음
        Assert.areEqual(new List<String>{ '조용한 제품' }, products(EcoAbleHomeController.getProjects(true, false, null, null, '조용한', 10)));
        Assert.areEqual(new List<String>{ '끝난 제품' }, products(EcoAbleHomeController.getProjects(true, false, null, null, '끝난', 10)));

        // 담당 연구원
        String researcherId = [SELECT Id FROM Employee__c WHERE Employee_Number__c = 'EMP-HOME-001'].Id;
        Assert.areEqual(new List<String>{ '바쁜 제품' }, products(EcoAbleHomeController.getProjects(false, true, null, researcherId, null, 10)));

        // 조건에 맞는 것이 없을 때
        EcoAbleHomeController.ProjectPage none = EcoAbleHomeController.getProjects(true, false, null, null, '없는 이름', 10);
        Assert.areEqual(0, none.rows.size());
        Assert.areEqual(0, none.totalCount);
    }

    @IsTest
    static void recommendationRuleIsShared() {
        Assert.areEqual('reminder', EcoAbleEmailDraftController.recommendType(1, 0, 0, false));
        Assert.areEqual('reminder', EcoAbleEmailDraftController.recommendType(0, 1, 1, false));
        Assert.areEqual('revision', EcoAbleEmailDraftController.recommendType(0, 1, 0, true));
        Assert.areEqual('dueSoon', EcoAbleEmailDraftController.recommendType(0, 0, 2, true));
        Assert.areEqual('info', EcoAbleEmailDraftController.recommendType(0, 0, 0, true));
        Assert.isNull(EcoAbleEmailDraftController.recommendType(0, 0, 0, false));
        Assert.isNull(EcoAbleEmailDraftController.draftTypeLabel(null));
        Assert.areEqual('정보 확인', EcoAbleEmailDraftController.draftTypeLabel('info'));
    }
}
