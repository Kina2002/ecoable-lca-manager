@IsTest
private class EcoAbleEmailDraftControllerTest {
    @TestSetup
    static void setup() {
        Account acc = new Account(Name = '테스트 고객사', EcoAble_Client__c = true);
        insert acc;
        insert new EPD_Certification_Project__c(Customer_Account__c = acc.Id, Product_Name__c = '테스트 제품', Stage__c = '데이터 수집');
    }

    private static Id projectId() {
        return [SELECT Id FROM EPD_Certification_Project__c LIMIT 1].Id;
    }

    // 마감이 하루 남은 미수령 항목(독촉·마감 임박 메일에 쓸 내용이 생김)
    private static void addDueSoonItem(Id pid) {
        insert new Data_Request_Item__c(Project__c = pid, Data_Category__c = '운송 정보', Status__c = '요청', Due_Date__c = Date.today().addDays(1));
    }

    @IsTest
    static void generatesDraftForBothTypes() {
        addDueSoonItem(projectId());
        // 테스트 프로젝트는 고객 담당자가 없으므로 메일 초안 맨 위에 수신자 확인 경고가 붙어야 합니다.
        String expected = EcoAbleEmailDraftController.RECIPIENT_WARNING + '\n\n제목: 테스트 메일';
        EcoAbleEmailDraftController.mockGeneration = '  제목: 테스트 메일  ';
        Assert.areEqual(expected, EcoAbleEmailDraftController.generateDraft(projectId(), 'reminder'));
        Assert.areEqual(expected, EcoAbleEmailDraftController.generateDraft(projectId(), 'dueSoon'));
    }

    @IsTest
    static void fillsItemListPlaceholderFromSalesforce() {
        Id pid = projectId();
        Date overdueDue = Date.today().addDays(-2), soonDue = Date.today().addDays(1), laterDue = Date.today().addDays(10);
        insert new List<Data_Request_Item__c>{
            new Data_Request_Item__c(Project__c = pid, Data_Category__c = '운송 정보', Request_Detail__c = '운송거리', Status__c = '요청', Due_Date__c = overdueDue),
            new Data_Request_Item__c(Project__c = pid, Data_Category__c = '폐기물·배출물', Request_Detail__c = '처리 방법', Status__c = '보완 요청', Due_Date__c = laterDue, Revision_Reason__c = '구분 누락'),
            new Data_Request_Item__c(Project__c = pid, Data_Category__c = '원료 투입량', Request_Detail__c = 'MSDS', Status__c = '요청', Due_Date__c = soonDue),
            new Data_Request_Item__c(Project__c = pid, Data_Category__c = '용수 사용량', Request_Detail__c = '받은 자료', Status__c = '수령', Due_Date__c = soonDue, Received_Date__c = Date.today())
        };
        EcoAbleEmailDraftController.mockGeneration = '제목: 테스트\n\n본문:\n안녕하십니까.\n\n[자료 목록]\n\n회신 부탁드립니다.[자료 목록]';

        String reminder = EcoAbleEmailDraftController.generateDraft(pid, 'reminder');
        String expectedReminder = '제출 기한이 지난 자료\n- 운송 정보 - 운송거리 (' + EcoAbleEmailDraftController.koreanDate(overdueDue) + ')\n\n'
            + '보완이 필요한 자료\n- 폐기물·배출물 - 처리 방법 (' + EcoAbleEmailDraftController.koreanDate(laterDue) + ')\n  보완 사유: 구분 누락\n\n'
            + '아직 기한 전인 자료\n- 원료 투입량 - MSDS (' + EcoAbleEmailDraftController.koreanDate(soonDue) + ')';
        Assert.isTrue(reminder.contains('안녕하십니까.\n\n' + expectedReminder + '\n\n회신 부탁드립니다.'), reminder);
        Assert.isFalse(reminder.contains('[자료 목록]'), '표시는 모두 사라져야 함');
        Assert.isFalse(reminder.contains('받은 자료'), '수령한 자료는 넣지 않음');

        String dueSoon = EcoAbleEmailDraftController.generateDraft(pid, 'dueSoon');
        Assert.isTrue(dueSoon.contains('- 원료 투입량 - MSDS (' + EcoAbleEmailDraftController.koreanDate(soonDue) + ', D-1)'), dueSoon);
        Assert.isFalse(dueSoon.contains('운송거리') || dueSoon.contains('처리 방법'), '마감 임박 안내에는 임박 자료만');

        String revision = EcoAbleEmailDraftController.generateDraft(pid, 'revision');
        Assert.isTrue(revision.contains('- 폐기물·배출물 - 처리 방법 (' + EcoAbleEmailDraftController.koreanDate(laterDue) + ')\n  보완 사유: 구분 누락'), revision);
        Assert.isFalse(revision.contains('운송거리') || revision.contains('MSDS'), '보완 요청 메일에는 보완 자료만');

        EcoAbleEmailDraftController.mockGeneration = '제목: 표시 없음';
        Assert.isTrue(EcoAbleEmailDraftController.generateDraft(pid, 'reminder').endsWith('제목: 표시 없음'), '표시가 없으면 AI 글을 그대로 둠');
        Assert.areEqual('기한 미정', EcoAbleEmailDraftController.koreanDate(null));
    }

    @IsTest
    static void returnsOneLineWithoutAiWhenNothingToWrite() {
        Id pid = projectId();
        // AI가 불리면 이 문장이 나오므로, 한 줄 안내가 나오면 AI를 부르지 않은 것입니다.
        EcoAbleEmailDraftController.mockGeneration = '제목: AI가 불리면 안 됨';
        String label = [SELECT Name FROM EPD_Certification_Project__c WHERE Id = :pid].Name + ' 테스트 고객사 / 테스트 제품: ';
        Assert.areEqual(label + '현재 요청할 미제출 자료가 없습니다.', EcoAbleEmailDraftController.generateDraft(pid, 'reminder'));
        Assert.areEqual(label + '3일 이내에 마감되는 미제출 자료가 없습니다.', EcoAbleEmailDraftController.generateDraft(pid, 'dueSoon'));
        Assert.areEqual(label + '보완을 요청할 자료가 없습니다.', EcoAbleEmailDraftController.generateDraft(pid, 'revision'));

        // 마감이 10일 남은 일반 요청: 독촉 메일에는 쓸 내용이 있지만 마감 임박·보완 요청에는 없음
        insert new Data_Request_Item__c(Project__c = pid, Data_Category__c = '원료 투입량', Status__c = '요청', Due_Date__c = Date.today().addDays(10));
        Assert.areEqual('제목: AI가 불리면 안 됨', EcoAbleEmailDraftController.generateDraft(pid, 'reminder').substringAfter('\n\n'));
        Assert.areEqual(label + '3일 이내에 마감되는 미제출 자료가 없습니다.', EcoAbleEmailDraftController.generateDraft(pid, 'dueSoon'));
        Assert.areEqual(label + '보완을 요청할 자료가 없습니다.', EcoAbleEmailDraftController.generateDraft(pid, 'revision'));

        // 인증 완료 프로젝트는 확인할 정보가 없음
        update new EPD_Certification_Project__c(Id = pid, Stage__c = '인증 완료');
        Assert.areEqual(label + '추가로 확인할 프로젝트 정보가 없습니다.', EcoAbleEmailDraftController.generateDraft(pid, 'info'));
    }

    @IsTest
    static void addsRecipientWarningOnlyWhenNeeded() {
        Id pid = projectId();
        String warned = EcoAbleEmailDraftController.RECIPIENT_WARNING + '\n제목: 이미 표시됨';
        Assert.areEqual(warned, EcoAbleEmailDraftController.ensureRecipientWarning(pid, warned), '이미 있으면 중복으로 붙이지 않음');
        String oneLine = 'ECP-0000 테스트: 추가로 확인할 프로젝트 정보가 없습니다.';
        Assert.areEqual(oneLine, EcoAbleEmailDraftController.ensureRecipientWarning(pid, oneLine), '한 줄 응답에는 붙이지 않음');

        Account acc = [SELECT Id FROM Account LIMIT 1];
        Contact c = new Contact(LastName = '담당', AccountId = acc.Id);
        insert c;
        update new EPD_Certification_Project__c(Id = pid, Customer_Contact__c = c.Id);
        Assert.areEqual('제목: 담당자 있음', EcoAbleEmailDraftController.ensureRecipientWarning(pid, '제목: 담당자 있음'), '담당자가 있으면 붙이지 않음');
    }

    @IsTest
    static void rejectsUnknownTypeAndBlankResponse() {
        try {
            EcoAbleEmailDraftController.generateDraft(projectId(), 'unknown');
            Assert.fail('알 수 없는 종류는 거부되어야 합니다.');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains('알 수 없는'), e.getMessage());
        }
        addDueSoonItem(projectId());
        EcoAbleEmailDraftController.mockGeneration = '';
        try {
            EcoAbleEmailDraftController.generateDraft(projectId(), 'reminder');
            Assert.fail('빈 응답은 거부되어야 합니다.');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains('빈 응답'), e.getMessage());
        }
        try {
            EcoAbleEmailDraftController.generateDraft(null, 'reminder');
            Assert.fail('프로젝트 없이 호출되면 안 됩니다.');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains('프로젝트'), e.getMessage());
        }
    }

    @IsTest
    static void recommendsDraftTypeFromPendingItems() {
        Id pid = projectId();
        Assert.areEqual('info', EcoAbleEmailDraftController.getDraftContext(pid).recommendedType, '미수령 자료가 없고 기본 정보가 비면 정보 확인 추천');

        Data_Request_Item__c dueSoon = new Data_Request_Item__c(Project__c = pid, Data_Category__c = '운송 정보', Status__c = '요청', Due_Date__c = Date.today().addDays(1));
        insert dueSoon;
        EcoAbleEmailDraftController.DraftContext onlySoon = EcoAbleEmailDraftController.getDraftContext(pid);
        Assert.areEqual(1, onlySoon.dueSoonCount);
        Assert.areEqual('dueSoon', onlySoon.recommendedType);

        insert new List<Data_Request_Item__c>{
            new Data_Request_Item__c(Project__c = pid, Data_Category__c = '원료 투입량', Status__c = '요청', Due_Date__c = Date.today().addDays(-2)),
            new Data_Request_Item__c(Project__c = pid, Data_Category__c = '용수 사용량', Status__c = '보완 요청', Due_Date__c = Date.today().addDays(10))
        };
        EcoAbleEmailDraftController.DraftContext both = EcoAbleEmailDraftController.getDraftContext(pid);
        Assert.areEqual(1, both.overdueCount);
        Assert.areEqual(1, both.revisionCount);
        Assert.areEqual(1, both.dueSoonCount);
        Assert.areEqual('reminder', both.recommendedType, '기한 초과가 있으면 독촉 메일 하나로 추천');
    }

    @IsTest
    static void recommendsInfoRequestWhenBasicsMissing() {
        Id pid = projectId();
        EcoAbleEmailDraftController.DraftContext ctx = EcoAbleEmailDraftController.getDraftContext(pid);
        Assert.areEqual('info', ctx.recommendedType, '자료 문제가 없고 기본 정보가 비면 정보 확인 메일 추천');
        Assert.isTrue(ctx.missingInfo.contains('고객 담당자'));
        Assert.isTrue(ctx.missingInfo.contains('목표 인증일'));
        Assert.isTrue(ctx.missingInfo.contains('평가 범위·데이터 요청 항목'));

        EcoAbleEmailDraftController.mockGeneration = '정보 확인 초안';
        Assert.areEqual('정보 확인 초안', EcoAbleEmailDraftController.generateDraft(pid, 'info'));
        Assert.areEqual(0, EcoAbleEmailDraftController.saveDraft(pid, '정보 확인 초안', 'info', false));
        Assert.areEqual('정보 확인', [SELECT Draft_Type__c FROM EPD_Certification_Project__c WHERE Id = :pid].Draft_Type__c);

        update new EPD_Certification_Project__c(Id = pid, Stage__c = '인증 완료');
        Assert.isTrue(EcoAbleEmailDraftController.getDraftContext(pid).missingInfo.isEmpty(), '인증 완료 프로젝트는 정보 확인 대상 아님');
    }

    @IsTest
    static void recommendsRevisionWhenOnlyRevisionPending() {
        Id pid = projectId();
        insert new Data_Request_Item__c(Project__c = pid, Data_Category__c = '폐기물·배출물', Status__c = '보완 요청', Due_Date__c = Date.today().addDays(10), Revision_Reason__c = '처리 방법 누락');
        EcoAbleEmailDraftController.DraftContext ctx = EcoAbleEmailDraftController.getDraftContext(pid);
        Assert.areEqual('revision', ctx.recommendedType);

        Assert.areEqual(1, ctx.revisionTaskCount, '보완 요청으로 저장되면 Flow가 보완 요청 할 일을 바로 만듦');

        insert new Task(Subject = '[기한 초과] 다른 항목 독촉 메일 보내기', WhatId = pid, OwnerId = UserInfo.getUserId());
        EcoAbleEmailDraftController.mockGeneration = '보완 요청 초안';
        Assert.areEqual('보완 요청 초안', EcoAbleEmailDraftController.generateDraft(pid, 'revision'));
        Assert.areEqual(1, EcoAbleEmailDraftController.saveDraft(pid, '보완 요청 초안', 'revision', true), '보완 요청 메일은 보완 요청 할 일만 닫음');
        EPD_Certification_Project__c saved = [SELECT Draft_Type__c, Email_Sent__c FROM EPD_Certification_Project__c WHERE Id = :pid];
        Assert.areEqual('보완 요청', saved.Draft_Type__c);
        Assert.isTrue(saved.Email_Sent__c);
        List<Task> stillOpen = [SELECT Subject FROM Task WHERE WhatId = :pid AND IsClosed = false];
        Assert.areEqual(1, stillOpen.size(), '독촉 할 일은 보완 요청 메일로 닫히지 않음');
        Assert.isTrue(stillOpen[0].Subject.startsWith('[기한 초과]'));
    }

    @IsTest
    static void createsRevisionTaskWhenStatusChangesToRevision() {
        Id pid = projectId();
        Data_Request_Item__c item = new Data_Request_Item__c(Project__c = pid, Data_Category__c = '운송 정보', Status__c = '요청', Due_Date__c = Date.today().addDays(10));
        insert item;
        Assert.areEqual(0, [SELECT COUNT() FROM Task WHERE WhatId = :pid], '요청 상태에서는 할 일을 만들지 않음');

        // 주종 관계 칸(Project__c)은 바꿀 수 없으므로 바꿀 칸만 담아 수정합니다.
        update new Data_Request_Item__c(Id = item.Id, Status__c = '보완 요청', Revision_Reason__c = '운송 거리 누락');
        Task created = [SELECT Subject, Description, Status, ActivityDate FROM Task WHERE WhatId = :pid];
        String drqName = [SELECT Name FROM Data_Request_Item__c WHERE Id = :item.Id].Name;
        Assert.isTrue(created.Subject.startsWith('[보완 요청] '), created.Subject);
        Assert.isTrue(created.Subject.endsWith('운송 정보 보완 요청 메일 보내기 (' + drqName + ')'), created.Subject);
        Assert.isTrue(created.Description.contains('운송 거리 누락'), '설명에 보완 사유 포함');
        Assert.areEqual(Date.today(), created.ActivityDate);

        update new Data_Request_Item__c(Id = item.Id, Revision_Reason__c = '운송 거리·수단 누락');
        Assert.areEqual(1, [SELECT COUNT() FROM Task WHERE WhatId = :pid], '이미 보완 요청 상태면 다시 만들지 않음');

        update new Data_Request_Item__c(Id = item.Id, Status__c = '요청');
        update new Data_Request_Item__c(Id = item.Id, Status__c = '보완 요청');
        Assert.areEqual(1, [SELECT COUNT() FROM Task WHERE WhatId = :pid], '같은 제목의 열린 할 일이 있으면 중복으로 만들지 않음');
    }

    @IsTest
    static void checkingEmailSentClosesOnlyMatchingTasks() {
        Id pid = projectId();
        Id me = UserInfo.getUserId();
        Task info = new Task(Subject = '[정보 확인] ECP 테스트 · 프로젝트 정보 확인 메일 보내기', WhatId = pid, OwnerId = me);
        Task revision = new Task(Subject = '[보완 요청] ECP 테스트 · 용수 사용량 보완 요청 메일 보내기 (DRQ-1)', WhatId = pid, OwnerId = me);
        Task overdue = new Task(Subject = '[기한 초과] ECP 테스트 · 운송 정보 독촉 메일 보내기 (DRQ-2)', WhatId = pid, OwnerId = me);
        insert new List<Task>{ info, revision, overdue };

        update new EPD_Certification_Project__c(Id = pid, Draft_Type__c = '보완 요청', Email_Sent__c = true);
        Assert.isTrue([SELECT IsClosed FROM Task WHERE Id = :revision.Id].IsClosed, '보완 요청 메일 → 보완 요청 할 일 닫힘');
        Assert.isFalse([SELECT IsClosed FROM Task WHERE Id = :overdue.Id].IsClosed);
        Assert.isFalse([SELECT IsClosed FROM Task WHERE Id = :info.Id].IsClosed);

        update new EPD_Certification_Project__c(Id = pid, Email_Sent__c = false);
        update new EPD_Certification_Project__c(Id = pid, Draft_Type__c = '독촉 메일', Email_Sent__c = true);
        Assert.isTrue([SELECT IsClosed FROM Task WHERE Id = :overdue.Id].IsClosed, '독촉 메일 → 독촉 할 일 닫힘');
        Assert.isFalse([SELECT IsClosed FROM Task WHERE Id = :info.Id].IsClosed, '독촉 메일로는 정보 확인 할 일을 닫지 않음');

        update new EPD_Certification_Project__c(Id = pid, Email_Sent__c = false);
        update new EPD_Certification_Project__c(Id = pid, Draft_Type__c = '정보 확인', Email_Sent__c = true);
        Assert.isTrue([SELECT IsClosed FROM Task WHERE Id = :info.Id].IsClosed, '정보 확인 메일 → 정보 확인 할 일 닫힘');
    }

    @IsTest
    static void worksFromLinkedTask() {
        Id pid = projectId();
        Task linked = new Task(Subject = '[기한 초과] 테스트 독촉 메일 보내기', WhatId = pid, OwnerId = UserInfo.getUserId());
        Task unlinked = new Task(Subject = '프로젝트 없는 할 일', OwnerId = UserInfo.getUserId());
        insert new List<Task>{ linked, unlinked };

        EcoAbleEmailDraftController.DraftContext ctx = EcoAbleEmailDraftController.getDraftContext(linked.Id);
        Assert.areEqual(pid, ctx.projectId, '할 일에 연결된 프로젝트를 찾아야 합니다.');
        Assert.isTrue(ctx.openedFromTask);
        Assert.isTrue(ctx.projectLabel.contains('테스트 고객사'), ctx.projectLabel);

        addDueSoonItem(pid);
        EcoAbleEmailDraftController.mockGeneration = '초안';
        Assert.areEqual('초안', EcoAbleEmailDraftController.generateDraft(linked.Id, 'reminder'));
        Assert.areEqual(0, EcoAbleEmailDraftController.saveDraft(linked.Id, '할 일에서 저장', 'reminder', false));
        Assert.areEqual('할 일에서 저장', [SELECT Reminder_Email_Draft__c FROM EPD_Certification_Project__c WHERE Id = :pid].Reminder_Email_Draft__c);
        Assert.isFalse([SELECT IsClosed FROM Task WHERE Id = :linked.Id].IsClosed, '체크하지 않으면 할 일은 그대로여야 합니다.');

        try {
            EcoAbleEmailDraftController.getDraftContext(unlinked.Id);
            Assert.fail('프로젝트와 연결되지 않은 할 일은 거부되어야 합니다.');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains('연결되어 있지 않아요'), e.getMessage());
        }
        try {
            EcoAbleEmailDraftController.getDraftContext(UserInfo.getUserId());
            Assert.fail('지원하지 않는 레코드는 거부되어야 합니다.');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains('만들 수 없어요'), e.getMessage());
        }
    }

    @IsTest
    static void buildsPromptInputAndReadsGeneration() {
        Id pid = projectId();
        ConnectApi.EinsteinPromptTemplateGenerationsInput input = EcoAbleEmailDraftController.buildInput(pid);
        Assert.isFalse(input.isPreview);
        Assert.isTrue(input.inputParams.containsKey('Input:project'), '입력 이름은 Input:project여야 합니다.');
        Assert.areEqual(pid, ((Map<String, String>) input.inputParams.get('Input:project').value).get('id'));

        Assert.isNull(EcoAbleEmailDraftController.firstGeneration(null));
        ConnectApi.EinsteinPromptTemplateGenerationsRepresentation empty = new ConnectApi.EinsteinPromptTemplateGenerationsRepresentation();
        Assert.isNull(EcoAbleEmailDraftController.firstGeneration(empty));
        ConnectApi.EinsteinLLMGenerationItemOutput item = new ConnectApi.EinsteinLLMGenerationItemOutput();
        item.text = '초안';
        empty.generations = new List<ConnectApi.EinsteinLLMGenerationItemOutput>{ item };
        Assert.areEqual('초안', EcoAbleEmailDraftController.firstGeneration(empty));
    }

    @IsTest
    static void completesOnlyTasksCoveredByTheEmail() {
        Id pid = projectId();
        Id me = UserInfo.getUserId();
        Task overdue = new Task(Subject = '[기한 초과] ECP 테스트 · 운송 정보 독촉 메일 보내기 (DRQ-1)', WhatId = pid, OwnerId = me);
        Task d1 = new Task(Subject = '[D-1] ECP 테스트 · 원료 투입량 마감 임박 안내 메일 보내기 (DRQ-2)', WhatId = pid, OwnerId = me);
        Task revision = new Task(Subject = '[보완 요청] ECP 테스트 · 용수 사용량 보완 요청 메일 보내기 (DRQ-3)', WhatId = pid, OwnerId = me);
        Task info = new Task(Subject = '[정보 확인] ECP 테스트 · 프로젝트 정보 확인 메일 보내기', WhatId = pid, OwnerId = me);
        Task other = new Task(Subject = '고객 미팅 일정 잡기', WhatId = pid, OwnerId = me);
        insert new List<Task>{ overdue, d1, revision, info, other };

        EcoAbleEmailDraftController.DraftContext ctx = EcoAbleEmailDraftController.getDraftContext(pid);
        Assert.areEqual(3, ctx.reminderTaskCount, '독촉 메일은 기한 초과 + 임박 + 보완 요청 할 일을 포함');
        Assert.areEqual(1, ctx.dueSoonTaskCount, '마감 임박 안내는 임박 할 일만 포함');
        Assert.areEqual(1, ctx.revisionTaskCount, '보완 요청 메일은 보완 요청 할 일만 포함');
        Assert.areEqual(1, ctx.infoTaskCount, '정보 확인 메일은 정보 확인 할 일만 포함');

        Assert.areEqual(1, EcoAbleEmailDraftController.saveDraft(pid, '임박 안내', 'dueSoon', true));
        Assert.isTrue([SELECT IsClosed FROM Task WHERE Id = :d1.Id].IsClosed);
        Assert.isFalse([SELECT IsClosed FROM Task WHERE Id = :overdue.Id].IsClosed, '마감 임박 안내로는 독촉 할 일을 닫지 않음');

        Assert.areEqual(2, EcoAbleEmailDraftController.saveDraft(pid, '독촉', 'reminder', true));
        Assert.isTrue([SELECT IsClosed FROM Task WHERE Id = :overdue.Id].IsClosed);
        Assert.isTrue([SELECT IsClosed FROM Task WHERE Id = :revision.Id].IsClosed, '독촉 메일은 보완 필요 자료도 담으므로 보완 요청 할 일도 닫음');
        Assert.isFalse([SELECT IsClosed FROM Task WHERE Id = :info.Id].IsClosed, '독촉 메일로는 정보 확인 할 일을 닫지 않음');

        Assert.areEqual(1, EcoAbleEmailDraftController.saveDraft(pid, '정보 확인', 'info', true));
        Assert.isTrue([SELECT IsClosed FROM Task WHERE Id = :info.Id].IsClosed);
        Assert.isFalse([SELECT IsClosed FROM Task WHERE Id = :other.Id].IsClosed, '메일 할 일이 아닌 것은 건드리지 않음');
    }

    @IsTest
    static void checkingEmailSentOnProjectClosesTasks() {
        Id pid = projectId();
        Id me = UserInfo.getUserId();
        Task overdue = new Task(Subject = '[기한 초과] ECP 테스트 · 운송 정보 독촉 메일 보내기 (DRQ-1)', WhatId = pid, OwnerId = me);
        Task d3 = new Task(Subject = '[D-3] ECP 테스트 · 용수 사용량 마감 임박 안내 메일 보내기 (DRQ-2)', WhatId = pid, OwnerId = me);
        insert new List<Task>{ overdue, d3 };

        // 초안만 저장: 체크가 풀린 상태로 저장되고 할 일은 남음
        EcoAbleEmailDraftController.saveDraft(pid, '마감 임박 초안', 'dueSoon', false);
        EPD_Certification_Project__c draftOnly = [SELECT Draft_Type__c, Email_Sent__c FROM EPD_Certification_Project__c WHERE Id = :pid];
        Assert.areEqual('마감 임박 안내', draftOnly.Draft_Type__c);
        Assert.isFalse(draftOnly.Email_Sent__c);
        Assert.isFalse([SELECT IsClosed FROM Task WHERE Id = :d3.Id].IsClosed);

        // 나중에 프로젝트 화면에서 "메일 발송 완료" 체크 → Flow가 마감 임박 할 일만 닫고 검토 완료·발송 시각 기록
        Test.startTest();
        update new EPD_Certification_Project__c(Id = pid, Email_Sent__c = true);
        Test.stopTest();
        EPD_Certification_Project__c sent = [SELECT Reminder_Review_Status__c, Email_Sent_At__c FROM EPD_Certification_Project__c WHERE Id = :pid];
        Assert.areEqual('검토 완료', sent.Reminder_Review_Status__c);
        Assert.isNotNull(sent.Email_Sent_At__c);
        Assert.isTrue([SELECT IsClosed FROM Task WHERE Id = :d3.Id].IsClosed, '마감 임박 할 일은 닫힘');
        Assert.isFalse([SELECT IsClosed FROM Task WHERE Id = :overdue.Id].IsClosed, '마감 임박 안내로는 독촉 할 일을 닫지 않음');
    }

    @IsTest
    static void savesDraftAsUnreviewed() {
        Id pid = projectId();
        EcoAbleEmailDraftController.saveDraft(pid, '검토할 초안', 'reminder', false);
        EPD_Certification_Project__c saved = [SELECT Reminder_Email_Draft__c, Reminder_Review_Status__c FROM EPD_Certification_Project__c WHERE Id = :pid];
        Assert.areEqual('검토할 초안', saved.Reminder_Email_Draft__c);
        Assert.areEqual('미검토', saved.Reminder_Review_Status__c);
        try {
            EcoAbleEmailDraftController.saveDraft(null, 'x', 'reminder', false);
            Assert.fail('프로젝트 없이 저장되면 안 됩니다.');
        } catch (AuraHandledException e) {
            Assert.isTrue(e.getMessage().contains('프로젝트'), e.getMessage());
        }
    }
}
