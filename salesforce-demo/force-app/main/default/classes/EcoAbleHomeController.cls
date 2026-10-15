/**
 * 에코에이블 홈 탭(ecoableHome LWC)용 컨트롤러. 읽기만 합니다.
 * 프로젝트가 많아져도 정확하도록 숫자 칸은 집계 쿼리(COUNT)로 세고, 목록은 필요한 개수만 가져옵니다.
 */
public with sharing class EcoAbleHomeController {
    private static final Integer MAX_LIST_SIZE = 200;
    private static final String COMPLETED = '인증 완료';

    public class Kpis {
        @AuraEnabled public Integer activeProjects = 0;
        @AuraEnabled public Integer completedProjects = 0;
        // 진행 중 프로젝트의 요청 항목 전체 중 수령한 비율
        @AuraEnabled public Decimal collectionRate;
        @AuraEnabled public Integer activeRequests = 0;
        @AuraEnabled public Integer receivedRequests = 0;
        @AuraEnabled public Integer overdueItems = 0;
        @AuraEnabled public Integer dueSoonItems = 0;
        @AuraEnabled public Integer revisionItems = 0;
        @AuraEnabled public Integer missingInfoProjects = 0;
        @AuraEnabled public Integer openMailTasks = 0;
    }

    public class StageCount {
        @AuraEnabled public String stage;
        @AuraEnabled public Integer count = 0;
    }

    public class Option {
        @AuraEnabled public String label;
        @AuraEnabled public String value;
    }

    public class ProjectRow {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public String accountName;
        @AuraEnabled public String productName;
        @AuraEnabled public String certificationType;
        @AuraEnabled public String stage;
        @AuraEnabled public String researcher;
        @AuraEnabled public Decimal collectionRate;
        @AuraEnabled public Integer totalRequests = 0;
        @AuraEnabled public Integer receivedRequests = 0;
        @AuraEnabled public Integer overdue = 0;
        @AuraEnabled public Integer revision = 0;
        @AuraEnabled public Integer dueSoon = 0;
        @AuraEnabled public Boolean missingInfo = false;
        @AuraEnabled public Date nextDueDate;
        @AuraEnabled public Date targetDate;
        @AuraEnabled public String recommendedType;
        @AuraEnabled public String recommendedLabel;
    }

    public class ProjectPage {
        @AuraEnabled public List<ProjectRow> rows = new List<ProjectRow>();
        // 조건에 맞는 전체 프로젝트 수
        @AuraEnabled public Integer totalCount = 0;
        @AuraEnabled public Boolean hasMore = false;
    }

    public class ItemRow {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public Id projectId;
        @AuraEnabled public String projectName;
        @AuraEnabled public String accountName;
        @AuraEnabled public String category;
        @AuraEnabled public String detail;
        @AuraEnabled public Date dueDate;
        // overdue / dueSoon / revision
        @AuraEnabled public String kind;
        @AuraEnabled public String label;
    }

    public class TaskRow {
        @AuraEnabled public Id id;
        @AuraEnabled public String subject;
        @AuraEnabled public Date activityDate;
        @AuraEnabled public String priority;
        @AuraEnabled public Id projectId;
        @AuraEnabled public String projectName;
        // overdue / dueSoon / revision / info
        @AuraEnabled public String kind;
    }

    public class Summary {
        @AuraEnabled public Date today;
        @AuraEnabled public Kpis kpis = new Kpis();
        @AuraEnabled public List<StageCount> stages = new List<StageCount>();
        @AuraEnabled public List<Option> researchers = new List<Option>();
        @AuraEnabled public List<ItemRow> attentionItems = new List<ItemRow>();
        @AuraEnabled public List<TaskRow> tasks = new List<TaskRow>();
    }

    /**
     * 숫자 칸, 단계별 건수, 연구원 목록, 주의 항목·메일 할 일(급한 순서로 지정한 개수만)을 돌려줍니다.
     */
    @AuraEnabled(cacheable=true)
    public static Summary getSummary(Integer attentionLimit, Integer taskLimit) {
        Summary s = new Summary();
        Date td = Date.today();
        Date soon = td.addDays(3);
        s.today = td;

        // 숫자 칸: 모두 집계 쿼리로 세므로 데이터가 많아도 정확합니다.
        Kpis k = s.kpis;
        k.activeProjects = [SELECT COUNT() FROM EPD_Certification_Project__c WHERE Stage__c != :COMPLETED WITH USER_MODE];
        k.completedProjects = [SELECT COUNT() FROM EPD_Certification_Project__c WHERE Stage__c = :COMPLETED WITH USER_MODE];
        k.activeRequests = [SELECT COUNT() FROM Data_Request_Item__c WHERE Project__r.Stage__c != :COMPLETED WITH USER_MODE];
        k.receivedRequests = [SELECT COUNT() FROM Data_Request_Item__c WHERE Project__r.Stage__c != :COMPLETED AND Status__c = '수령' WITH USER_MODE];
        k.collectionRate = k.activeRequests == 0 ? null : (k.receivedRequests * 100.0 / k.activeRequests).setScale(0, RoundingMode.HALF_UP);
        // 미수령 항목은 기한 초과 -> 보완 요청 -> 임박(0~3일) 순서로 한 곳에만 셉니다(메일 추천과 같은 기준).
        k.overdueItems = [SELECT COUNT() FROM Data_Request_Item__c WHERE Status__c != '수령' AND Due_Date__c < :td WITH USER_MODE];
        k.revisionItems = [SELECT COUNT() FROM Data_Request_Item__c WHERE Status__c = '보완 요청' AND (Due_Date__c >= :td OR Due_Date__c = null) WITH USER_MODE];
        k.dueSoonItems = [SELECT COUNT() FROM Data_Request_Item__c WHERE Status__c = '요청' AND Due_Date__c >= :td AND Due_Date__c <= :soon WITH USER_MODE];
        k.missingInfoProjects = [
            SELECT COUNT() FROM EPD_Certification_Project__c
            WHERE Stage__c != :COMPLETED AND (Customer_Contact__c = null OR Target_Certification_Date__c = null OR Total_Requests__c = 0)
            WITH USER_MODE
        ];
        k.openMailTasks = [SELECT COUNT() FROM Task WHERE IsClosed = false AND Subject LIKE '%메일 보내기%' WITH USER_MODE];

        Map<String, Integer> countByStage = new Map<String, Integer>();
        for (AggregateResult ar : [SELECT Stage__c stage, COUNT(Id) cnt FROM EPD_Certification_Project__c WITH USER_MODE GROUP BY Stage__c]) {
            countByStage.put((String) ar.get('stage'), (Integer) ar.get('cnt'));
        }
        for (Schema.PicklistEntry entry : EPD_Certification_Project__c.Stage__c.getDescribe().getPicklistValues()) {
            if (entry.isActive()) {
                StageCount sc = new StageCount();
                sc.stage = entry.getValue();
                sc.count = countByStage.get(sc.stage) ?? 0;
                s.stages.add(sc);
            }
        }

        for (Employee__c e : [
            SELECT Id, Name FROM Employee__c
            WHERE Id IN (SELECT Lead_Researcher__c FROM EPD_Certification_Project__c)
            WITH USER_MODE ORDER BY Name LIMIT :MAX_LIST_SIZE
        ]) {
            Option o = new Option();
            o.label = e.Name;
            o.value = e.Id;
            s.researchers.add(o);
        }

        // 주의 항목: 기한 초과 -> 임박 -> 보완 요청 순서로 지정한 개수까지
        Integer remaining = clamp(attentionLimit);
        for (String kind : new List<String>{ 'overdue', 'dueSoon', 'revision' }) {
            if (remaining <= 0) {
                break;
            }
            for (Data_Request_Item__c item : attentionQuery(kind, td, soon, remaining)) {
                s.attentionItems.add(toItemRow(item, kind));
            }
            remaining = clamp(attentionLimit) - s.attentionItems.size();
        }

        Integer taskRows = clamp(taskLimit);
        for (Task t : [
            SELECT Id, Subject, ActivityDate, Priority, WhatId, What.Name
            FROM Task
            WHERE IsClosed = false AND Subject LIKE '%메일 보내기%'
            WITH USER_MODE
            ORDER BY ActivityDate ASC NULLS LAST, Subject
            LIMIT :taskRows
        ]) {
            TaskRow tr = new TaskRow();
            tr.id = t.Id;
            tr.subject = t.Subject;
            tr.activityDate = t.ActivityDate;
            tr.priority = t.Priority;
            tr.projectId = t.WhatId;
            tr.projectName = t.What?.Name;
            tr.kind = t.Subject.startsWith('[기한 초과]') ? 'overdue'
                : t.Subject.startsWith('[D-') ? 'dueSoon'
                : t.Subject.startsWith('[보완 요청]') ? 'revision'
                : t.Subject.startsWith('[정보 확인]') ? 'info' : null;
            s.tasks.add(tr);
        }
        return s;
    }

    /**
     * 프로젝트 현황표. 거르기 조건에 맞는 프로젝트를 손이 많이 가는 순서로 pageSize개까지 돌려줍니다.
     * attentionOnly: 기한 초과·보완·임박·정보 누락이 있는 프로젝트만
     * includeCompleted: 인증 완료 프로젝트도 포함 (stage를 고르면 무시)
     */
    @AuraEnabled(cacheable=true)
    public static ProjectPage getProjects(Boolean attentionOnly, Boolean includeCompleted, String stage, String researcherId, String searchText, Integer pageSize) {
        Integer size = clamp(pageSize);
        // 검색어가 있으면 "주의 필요만"과 "인증 완료 숨기기"를 무시하고 모든 프로젝트에서 찾습니다.
        Boolean searching = String.isNotBlank(searchText);
        Date td = Date.today();
        Date soon = td.addDays(3);
        Map<String, Object> binds = new Map<String, Object>{ 'completed' => COMPLETED };
        List<String> filters = new List<String>();
        if (String.isNotBlank(stage)) {
            filters.add('Stage__c = :stage');
            binds.put('stage', stage);
        } else if (includeCompleted != true && !searching) {
            filters.add('Stage__c != :completed');
        }
        if (String.isNotBlank(researcherId)) {
            filters.add('Lead_Researcher__c = :researcherId');
            binds.put('researcherId', researcherId);
        }
        if (String.isNotBlank(searchText)) {
            filters.add('(Name LIKE :search OR Product_Name__c LIKE :search OR Customer_Account__r.Name LIKE :search)');
            binds.put('search', '%' + searchText.trim() + '%');
        }

        // 손이 많이 가는 프로젝트: 미수령 항목 문제가 있거나 기본 정보가 빈 프로젝트
        Map<Id, Integer> overdue = countByProject('overdue', td, soon);
        Map<Id, Integer> revision = countByProject('revision', td, soon);
        Map<Id, Integer> dueSoon = countByProject('dueSoon', td, soon);
        Set<Id> attentionIds = new Set<Id>();
        attentionIds.addAll(overdue.keySet());
        attentionIds.addAll(revision.keySet());
        attentionIds.addAll(dueSoon.keySet());
        for (EPD_Certification_Project__c p : [
            SELECT Id FROM EPD_Certification_Project__c
            WHERE Stage__c != :COMPLETED AND (Customer_Contact__c = null OR Target_Certification_Date__c = null OR Total_Requests__c = 0)
            WITH USER_MODE LIMIT 2000
        ]) {
            attentionIds.add(p.Id);
        }
        binds.put('attentionIds', attentionIds);

        List<String> attentionWhere = new List<String>(filters);
        attentionWhere.add('Id IN :attentionIds');
        List<ProjectRow> attentionRows = new List<ProjectRow>();
        for (EPD_Certification_Project__c p : (List<EPD_Certification_Project__c>) Database.queryWithBinds(projectQuery(attentionWhere, '', 2000), binds, AccessLevel.USER_MODE)) {
            attentionRows.add(toProjectRow(p, overdue, revision, dueSoon));
        }
        attentionRows = sortByUrgency(attentionRows);

        ProjectPage page = new ProjectPage();
        for (ProjectRow r : attentionRows) {
            if (page.rows.size() < size) {
                page.rows.add(r);
            }
        }
        if (attentionOnly == true && !searching) {
            page.totalCount = attentionRows.size();
        } else {
            List<String> otherWhere = new List<String>(filters);
            otherWhere.add('Id NOT IN :attentionIds');
            page.totalCount = attentionRows.size()
                + Database.countQueryWithBinds('SELECT COUNT() FROM EPD_Certification_Project__c' + whereClause(otherWhere), binds, AccessLevel.USER_MODE);
            Integer room = size - page.rows.size();
            if (room > 0) {
                for (EPD_Certification_Project__c p : (List<EPD_Certification_Project__c>) Database.queryWithBinds(projectQuery(otherWhere, ' ORDER BY Name', room), binds, AccessLevel.USER_MODE)) {
                    page.rows.add(toProjectRow(p, overdue, revision, dueSoon));
                }
            }
        }
        page.hasMore = page.totalCount > page.rows.size();
        fillNextDueDates(page.rows);
        return page;
    }

    private static Integer clamp(Integer requested) {
        if (requested == null || requested < 1) {
            return 10;
        }
        return Math.min(requested, MAX_LIST_SIZE);
    }

    private static String whereClause(List<String> conditions) {
        return conditions.isEmpty() ? '' : ' WHERE ' + String.join(conditions, ' AND ');
    }

    private static String projectQuery(List<String> conditions, String orderBy, Integer lim) {
        return 'SELECT Id, Name, Stage__c, Product_Name__c, Certification_Type__c, Customer_Account__r.Name, Lead_Researcher__r.Name, '
            + 'Target_Certification_Date__c, Total_Requests__c, Received_Requests__c, Data_Collection_Rate__c, Missing_Info__c '
            + 'FROM EPD_Certification_Project__c' + whereClause(conditions) + orderBy + ' LIMIT ' + lim;
    }

    // 종류별 미수령 항목 수를 프로젝트별로 셉니다(문제가 있는 프로젝트만 결과에 나옴).
    private static Map<Id, Integer> countByProject(String kind, Date td, Date soon) {
        List<AggregateResult> results;
        if (kind == 'overdue') {
            results = [SELECT Project__c pid, COUNT(Id) cnt FROM Data_Request_Item__c WHERE Status__c != '수령' AND Due_Date__c < :td WITH USER_MODE GROUP BY Project__c LIMIT 2000];
        } else if (kind == 'revision') {
            results = [SELECT Project__c pid, COUNT(Id) cnt FROM Data_Request_Item__c WHERE Status__c = '보완 요청' AND (Due_Date__c >= :td OR Due_Date__c = null) WITH USER_MODE GROUP BY Project__c LIMIT 2000];
        } else {
            results = [SELECT Project__c pid, COUNT(Id) cnt FROM Data_Request_Item__c WHERE Status__c = '요청' AND Due_Date__c >= :td AND Due_Date__c <= :soon WITH USER_MODE GROUP BY Project__c LIMIT 2000];
        }
        Map<Id, Integer> counts = new Map<Id, Integer>();
        for (AggregateResult ar : results) {
            counts.put((Id) ar.get('pid'), (Integer) ar.get('cnt'));
        }
        return counts;
    }

    private static List<Data_Request_Item__c> attentionQuery(String kind, Date td, Date soon, Integer lim) {
        if (kind == 'overdue') {
            return [
                SELECT Id, Name, Project__c, Project__r.Name, Project__r.Customer_Account__r.Name, Data_Category__c, Request_Detail__c, Due_Date__c, Days_To_Due__c
                FROM Data_Request_Item__c WHERE Status__c != '수령' AND Due_Date__c < :td
                WITH USER_MODE ORDER BY Due_Date__c ASC, Name LIMIT :lim
            ];
        }
        if (kind == 'dueSoon') {
            return [
                SELECT Id, Name, Project__c, Project__r.Name, Project__r.Customer_Account__r.Name, Data_Category__c, Request_Detail__c, Due_Date__c, Days_To_Due__c
                FROM Data_Request_Item__c WHERE Status__c = '요청' AND Due_Date__c >= :td AND Due_Date__c <= :soon
                WITH USER_MODE ORDER BY Due_Date__c ASC, Name LIMIT :lim
            ];
        }
        return [
            SELECT Id, Name, Project__c, Project__r.Name, Project__r.Customer_Account__r.Name, Data_Category__c, Request_Detail__c, Due_Date__c, Days_To_Due__c
            FROM Data_Request_Item__c WHERE Status__c = '보완 요청' AND (Due_Date__c >= :td OR Due_Date__c = null)
            WITH USER_MODE ORDER BY Due_Date__c ASC NULLS LAST, Name LIMIT :lim
        ];
    }

    private static ItemRow toItemRow(Data_Request_Item__c item, String kind) {
        ItemRow ir = new ItemRow();
        ir.id = item.Id;
        ir.name = item.Name;
        ir.projectId = item.Project__c;
        ir.projectName = item.Project__r.Name;
        ir.accountName = item.Project__r.Customer_Account__r?.Name;
        ir.category = item.Data_Category__c;
        ir.detail = item.Request_Detail__c;
        ir.dueDate = item.Due_Date__c;
        ir.kind = kind;
        Integer days = item.Days_To_Due__c == null ? null : item.Days_To_Due__c.intValue();
        if (kind == 'overdue') {
            ir.label = '기한 초과 ' + (days == null ? 0 : Math.abs(days)) + '일';
        } else if (kind == 'dueSoon') {
            ir.label = days == 0 ? '오늘 마감' : 'D-' + days;
        } else {
            ir.label = '보완 요청';
        }
        return ir;
    }

    private static ProjectRow toProjectRow(EPD_Certification_Project__c p, Map<Id, Integer> overdue, Map<Id, Integer> revision, Map<Id, Integer> dueSoon) {
        ProjectRow row = new ProjectRow();
        row.id = p.Id;
        row.name = p.Name;
        row.accountName = p.Customer_Account__r?.Name;
        row.productName = p.Product_Name__c;
        row.certificationType = p.Certification_Type__c;
        row.stage = p.Stage__c;
        row.researcher = p.Lead_Researcher__r?.Name;
        row.collectionRate = p.Data_Collection_Rate__c;
        row.totalRequests = p.Total_Requests__c == null ? 0 : p.Total_Requests__c.intValue();
        row.receivedRequests = p.Received_Requests__c == null ? 0 : p.Received_Requests__c.intValue();
        row.targetDate = p.Target_Certification_Date__c;
        row.missingInfo = String.isNotBlank(p.Missing_Info__c) && p.Missing_Info__c != '없음';
        row.overdue = overdue.get(p.Id) ?? 0;
        row.revision = revision.get(p.Id) ?? 0;
        row.dueSoon = dueSoon.get(p.Id) ?? 0;
        row.recommendedType = EcoAbleEmailDraftController.recommendType(row.overdue, row.revision, row.dueSoon, row.missingInfo);
        row.recommendedLabel = EcoAbleEmailDraftController.draftTypeLabel(row.recommendedType);
        return row;
    }

    // 화면에 보이는 프로젝트만 다음 마감일(미수령 항목 중 가장 이른 제출 기한)을 채웁니다.
    private static void fillNextDueDates(List<ProjectRow> rows) {
        Map<Id, ProjectRow> byId = new Map<Id, ProjectRow>();
        for (ProjectRow r : rows) {
            byId.put(r.id, r);
        }
        if (byId.isEmpty()) {
            return;
        }
        Set<Id> ids = byId.keySet();
        for (AggregateResult ar : [
            SELECT Project__c pid, MIN(Due_Date__c) nextDue FROM Data_Request_Item__c
            WHERE Project__c IN :ids AND Status__c != '수령' WITH USER_MODE GROUP BY Project__c
        ]) {
            byId.get((Id) ar.get('pid')).nextDueDate = (Date) ar.get('nextDue');
        }
    }

    // 손이 많이 가는 프로젝트가 위로: 기한 초과 > 보완 > 임박 > 정보 누락, 같으면 프로젝트 번호 순.
    @TestVisible
    private static List<ProjectRow> sortByUrgency(List<ProjectRow> rows) {
        Map<String, ProjectRow> byKey = new Map<String, ProjectRow>();
        for (ProjectRow r : rows) {
            Integer score = Math.min(r.overdue, 99) * 1000000 + Math.min(r.revision, 99) * 10000 + Math.min(r.dueSoon, 99) * 100 + (r.missingInfo ? 1 : 0);
            byKey.put(String.valueOf(999999999 - score).leftPad(9, '0') + r.name, r);
        }
        List<String> keys = new List<String>(byKey.keySet());
        keys.sort();
        List<ProjectRow> sorted = new List<ProjectRow>();
        for (String k : keys) {
            sorted.add(byKey.get(k));
        }
        return sorted;
    }
}
