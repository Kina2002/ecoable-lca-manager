// 마감 임박(D-3, D-1) 시험용 가상 데이터 요청 항목 2건. 실행일 기준으로 기한을 잡습니다.
Id p1 = [SELECT Id FROM EPD_Certification_Project__c WHERE Name = 'ECP-0001'].Id;
Id p3 = [SELECT Id FROM EPD_Certification_Project__c WHERE Name = 'ECP-0003'].Id;
insert new List<Data_Request_Item__c>{
    new Data_Request_Item__c(Project__c = p1, Data_Category__c = '원료 투입량', Request_Detail__c = '첨가제 MSDS 및 성분 함량표', Status__c = '요청', Due_Date__c = Date.today().addDays(1)),
    new Data_Request_Item__c(Project__c = p3, Data_Category__c = '용수 사용량', Request_Detail__c = '산세 공정 용수 사용량(m³)', Status__c = '요청', Due_Date__c = Date.today().addDays(3))
};
System.debug('DUE_SOON_OK');