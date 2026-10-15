// 시연 전 상태로 되돌리기: ECP-0002를 "1건 남음"으로, ECP-0003·ECP-0005 메일·할 일 테스트 흔적을 원래대로.
Data_Request_Item__c drq11 = [SELECT Id FROM Data_Request_Item__c WHERE Name = 'DRQ-0011'];
drq11.Status__c = '요청';
drq11.Received_Date__c = null;
update drq11;

EPD_Certification_Project__c p2 = [SELECT Id FROM EPD_Certification_Project__c WHERE Name = 'ECP-0002'];
p2.Stage__c = '데이터 수집';
List<EPD_Certification_Project__c> mailProjects = [SELECT Id FROM EPD_Certification_Project__c WHERE Name IN ('ECP-0003', 'ECP-0005')];
for (EPD_Certification_Project__c p : mailProjects) {
    p.Reminder_Email_Draft__c = null;
    p.Draft_Type__c = null;
    p.Email_Sent__c = false;
    p.Email_Sent_At__c = null;
    p.Reminder_Review_Status__c = null;
}
List<EPD_Certification_Project__c> toReset = new List<EPD_Certification_Project__c>{ p2 };
toReset.addAll(mailProjects);
update toReset;

List<Task> reopened = [SELECT Id FROM Task WHERE WhatId IN :mailProjects AND IsClosed = true AND Subject LIKE '%메일 보내기%'];
for (Task t : reopened) { t.Status = 'Not Started'; }
update reopened;
System.debug('RESET_OK reopenedTasks=' + reopened.size());