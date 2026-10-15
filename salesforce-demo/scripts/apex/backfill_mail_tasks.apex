// 보완 요청·정보 확인 할 일을 Flow 추가 전의 기존 데이터에도 만들어 줍니다. 여러 번 실행해도 중복으로 만들지 않습니다.
// 1) "보완 요청" 상태인데 열린 [보완 요청] 할 일이 없는 항목: 상태를 잠깐 "요청"으로 바꿨다가 되돌려 Flow(Create_Revision_Request_Task)가 할 일을 만들게 함
// 2) 확인 필요 정보가 있는 프로젝트: 예약 Flow(Create_Info_Request_Tasks)와 같은 제목으로 할 일 생성 (다음 예약 실행 때 중복 방지)
Set<String> openSubjects = new Set<String>();
for (Task t : [SELECT Subject FROM Task WHERE IsClosed = false AND (Subject LIKE '[보완 요청]%' OR Subject LIKE '[정보 확인]%')]) {
    openSubjects.add(t.Subject);
}

List<Data_Request_Item__c> toRequest = new List<Data_Request_Item__c>();
List<Data_Request_Item__c> toRevision = new List<Data_Request_Item__c>();
for (Data_Request_Item__c item : [
    SELECT Id, Name, Data_Category__c, Project__r.Name, Project__r.Customer_Account__r.Name
    FROM Data_Request_Item__c WHERE Status__c = '보완 요청'
]) {
    String subject = '[보완 요청] ' + item.Project__r.Name + ' ' + (item.Project__r.Customer_Account__r?.Name ?? '')
        + ' · ' + item.Data_Category__c + ' 보완 요청 메일 보내기 (' + item.Name + ')';
    if (!openSubjects.contains(subject)) {
        toRequest.add(new Data_Request_Item__c(Id = item.Id, Status__c = '요청'));
        toRevision.add(new Data_Request_Item__c(Id = item.Id, Status__c = '보완 요청'));
    }
}
update toRequest;
update toRevision;

List<Task> infoTasks = new List<Task>();
for (EPD_Certification_Project__c p : [
    SELECT Id, Name, OwnerId, Product_Name__c, Missing_Info__c, Customer_Account__r.Name
    FROM EPD_Certification_Project__c WHERE Stage__c != '인증 완료' AND Missing_Info__c != '없음'
]) {
    String account = p.Customer_Account__r?.Name ?? '';
    String subject = '[정보 확인] ' + p.Name + ' ' + account + ' · 프로젝트 정보 확인 메일 보내기';
    if (openSubjects.contains(subject)) {
        continue;
    }
    infoTasks.add(new Task(
        Subject = subject,
        WhatId = p.Id,
        OwnerId = p.OwnerId,
        ActivityDate = Date.today(),
        Priority = 'Normal',
        Status = 'Not Started',
        Description = '고객사: ' + account + '\n대상 제품: ' + (p.Product_Name__c ?? '') + '\n확인할 정보: ' + p.Missing_Info__c
            + '\n\n할 일 화면의 [AI 메일 초안] 버튼에서 정보 확인 메일 초안을 만들고, 검토 후 발송해 주세요.'
    ));
}
insert infoTasks;
System.debug(LoggingLevel.ERROR, 'BACKFILL_OK revisionItems=' + toRevision.size() + ' infoTasks=' + infoTasks.size());
