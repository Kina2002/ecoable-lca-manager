@IsTest
private class EcoAbleDataRequestControllerTest {
    @TestSetup
    static void setup() {
        Account acc = new Account(Name = '테스트 고객사', EcoAble_Client__c = true);
        insert acc;
        insert new EPD_Certification_Project__c(Customer_Account__c = acc.Id, Product_Name__c = '테스트 제품', Stage__c = '접수');
    }

    private static Id projectId() {
        return [SELECT Id FROM EPD_Certification_Project__c LIMIT 1].Id;
    }

    private static EcoAbleDataRequestController.RequestInput request(String category, String detail) {
        EcoAbleDataRequestController.RequestInput input = new EcoAbleDataRequestController.RequestInput();
        input.category = category;
        input.detail = detail;
        return input;
    }

    @IsTest
    static void listsEveryActiveCategoryWithDefaults() {
        Id pid = projectId();
        insert new Data_Request_Item__c(Project__c = pid, Data_Category__c = '운송 정보', Status__c = '요청', Due_Date__c = Date.today().addDays(5));

        EcoAbleDataRequestController.SetupInfo info = EcoAbleDataRequestController.getSetup(pid);
        Assert.areEqual(EcoAbleDataRequestController.activeCategories().size(), info.options.size(), '데이터 구분 선택 목록을 그대로 보여 줌');
        Assert.isTrue(info.options.size() >= 6);
        Assert.areEqual(Date.today().addDays(EcoAbleDataRequestController.DEFAULT_DUE_DAYS), info.defaultDueDate);
        Assert.areEqual('접수', info.stage);
        Assert.isTrue(info.projectLabel.contains('테스트 고객사'), info.projectLabel);
        for (EcoAbleDataRequestController.CategoryOption option : info.options) {
            Assert.isFalse(String.isBlank(option.defaultDetail), option.category + ' 기본 문장 필요');
            Assert.areEqual(option.category == '운송 정보', option.exists, option.category);
        }
        Assert.areEqual('포장재 정보 관련 연간 데이터(수량·단위 포함)', EcoAbleDataRequestController.genericDetail('포장재 정보'), '새로 추가한 구분용 기본 문장');
    }

    @IsTest
    static void createsSelectedItemsSkipsExistingAndMovesStage() {
        Id pid = projectId();
        insert new Data_Request_Item__c(Project__c = pid, Data_Category__c = '운송 정보', Status__c = '요청', Due_Date__c = Date.today().addDays(5));
        Date due = Date.today().addDays(20);

        EcoAbleDataRequestController.CreateResult result = EcoAbleDataRequestController.createRequests(pid, due, new List<EcoAbleDataRequestController.RequestInput>{
            request('원료 투입량', '  셀·모듈 부품 연간 투입량(kg)  '),
            request('에너지(전력·연료) 사용량', ''),
            request('운송 정보', '이미 있는 구분'),
            request('원료 투입량', '같은 구분 중복')
        });

        Assert.areEqual(2, result.createdCount);
        Assert.areEqual(new List<String>{ '운송 정보' }, result.skippedCategories);
        Assert.isTrue(result.movedToDataCollection);
        Assert.areEqual('데이터 수집', [SELECT Stage__c FROM EPD_Certification_Project__c WHERE Id = :pid].Stage__c);

        Map<String, Data_Request_Item__c> byCategory = new Map<String, Data_Request_Item__c>();
        for (Data_Request_Item__c item : [SELECT Data_Category__c, Request_Detail__c, Status__c, Due_Date__c FROM Data_Request_Item__c WHERE Project__c = :pid AND Due_Date__c = :due]) {
            byCategory.put(item.Data_Category__c, item);
        }
        Assert.areEqual(2, byCategory.size());
        Assert.areEqual('셀·모듈 부품 연간 투입량(kg)', byCategory.get('원료 투입량').Request_Detail__c, '연구원이 고친 요청 내용 사용');
        Assert.areEqual('에너지(전력·연료) 사용량 관련 연간 데이터(수량·단위 포함)', byCategory.get('에너지(전력·연료) 사용량').Request_Detail__c, '비우면 기본 문장');
        Assert.areEqual('요청', byCategory.get('원료 투입량').Status__c);
    }

    @IsTest
    static void doesNotMoveStageWhenNothingCreatedOrAlreadyCollecting() {
        Id pid = projectId();
        insert new Data_Request_Item__c(Project__c = pid, Data_Category__c = '운송 정보', Status__c = '요청', Due_Date__c = Date.today().addDays(5));
        EcoAbleDataRequestController.CreateResult onlyExisting = EcoAbleDataRequestController.createRequests(pid, Date.today(), new List<EcoAbleDataRequestController.RequestInput>{
            request('운송 정보', 'x')
        });
        Assert.areEqual(0, onlyExisting.createdCount);
        Assert.isFalse(onlyExisting.movedToDataCollection, '새로 만든 항목이 없으면 단계를 바꾸지 않음');
        Assert.areEqual('접수', [SELECT Stage__c FROM EPD_Certification_Project__c WHERE Id = :pid].Stage__c);

        update new EPD_Certification_Project__c(Id = pid, Stage__c = 'LCA 산정');
        EcoAbleDataRequestController.CreateResult later = EcoAbleDataRequestController.createRequests(pid, Date.today(), new List<EcoAbleDataRequestController.RequestInput>{
            request('용수 사용량', '추가 요청')
        });
        Assert.areEqual(1, later.createdCount);
        Assert.isFalse(later.movedToDataCollection, '접수 단계가 아니면 단계를 그대로 둠');
        Assert.areEqual('LCA 산정', [SELECT Stage__c FROM EPD_Certification_Project__c WHERE Id = :pid].Stage__c);
    }

    @IsTest
    static void rejectsInvalidInput() {
        Id pid = projectId();
        List<EcoAbleDataRequestController.RequestInput> one = new List<EcoAbleDataRequestController.RequestInput>{ request('원료 투입량', 'x') };
        assertRejected(pid, Date.today().addDays(-1), one, '오늘 이후');
        assertRejected(pid, null, one, '오늘 이후');
        assertRejected(pid, Date.today(), new List<EcoAbleDataRequestController.RequestInput>(), '하나 이상');
        assertRejected(pid, Date.today(), new List<EcoAbleDataRequestController.RequestInput>{ request('없는 구분', 'x') }, '알 수 없는');
        assertRejected(null, Date.today(), one, '프로젝트');
        Assert.areEqual(0, [SELECT COUNT() FROM Data_Request_Item__c], '잘못된 요청으로는 아무것도 만들지 않음');
        try {
            EcoAbleDataRequestController.getSetup(null);
            Assert.fail('프로젝트 없이 열면 안 됩니다.');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains('프로젝트'), e.getMessage());
        }
    }

    private static void assertRejected(Id pid, Date due, List<EcoAbleDataRequestController.RequestInput> requests, String expected) {
        try {
            EcoAbleDataRequestController.createRequests(pid, due, requests);
            Assert.fail('거부되어야 합니다: ' + expected);
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains(expected), e.getMessage());
        }
    }
}
