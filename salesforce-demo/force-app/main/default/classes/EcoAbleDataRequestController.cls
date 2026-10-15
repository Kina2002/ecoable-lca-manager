/**
 * 인증 컨설팅 프로젝트 화면의 "요청 항목 만들기" 버튼(ecoableDataRequestCreator LWC)용 컨트롤러.
 * "데이터 구분" 선택 목록을 그때그때 읽어 오므로, 설정에서 구분 값을 추가하면 창에도 자동으로 나타납니다.
 */
public with sharing class EcoAbleDataRequestController {
    @TestVisible
    private static final Integer DEFAULT_DUE_DAYS = 14;

    // 기본 6개 구분의 요청 내용 기본 문장. 나중에 추가한 구분은 genericDetail()을 씁니다.
    private static final Map<String, String> DEFAULT_DETAIL_BY_CATEGORY = new Map<String, String>{
        '원료 투입량' => '주요 원료·부원료 연간 투입량(kg 또는 톤)',
        '에너지(전력·연료) 사용량' => '공정별 연간 전력(kWh)·연료(LNG 등) 사용량',
        '용수 사용량' => '공정별 연간 용수 사용량(m³)',
        '운송 정보' => '원료 입고·제품 출하 운송거리와 운송수단',
        '폐기물·배출물' => '공정 폐기물 발생량과 처리 방법(재활용·소각·매립)',
        '포장재 정보' => '제품 포장재 종류와 개당 중량'
    };

    public class CategoryOption {
        @AuraEnabled public String category;
        @AuraEnabled public String defaultDetail;
        // 이 프로젝트에 같은 구분의 요청 항목이 이미 있으면 true (창에서 건너뜀으로 표시)
        @AuraEnabled public Boolean exists = false;
    }

    public class SetupInfo {
        @AuraEnabled public String projectLabel;
        @AuraEnabled public String stage;
        @AuraEnabled public Date defaultDueDate;
        @AuraEnabled public List<CategoryOption> options = new List<CategoryOption>();
    }

    public class RequestInput {
        @AuraEnabled public String category { get; set; }
        @AuraEnabled public String detail { get; set; }
    }

    public class CreateResult {
        @AuraEnabled public Integer createdCount = 0;
        @AuraEnabled public List<String> skippedCategories = new List<String>();
        @AuraEnabled public Boolean movedToDataCollection = false;
    }

    @AuraEnabled
    public static SetupInfo getSetup(Id projectId) {
        EPD_Certification_Project__c project = loadProject(projectId);
        Set<String> existing = existingCategories(projectId);

        SetupInfo info = new SetupInfo();
        info.projectLabel = project.Name + ' ' + (project.Customer_Account__r?.Name ?? '') + ' / ' + (project.Product_Name__c ?? '');
        info.stage = project.Stage__c;
        info.defaultDueDate = Date.today().addDays(DEFAULT_DUE_DAYS);
        for (String category : activeCategories()) {
            CategoryOption option = new CategoryOption();
            option.category = category;
            option.defaultDetail = DEFAULT_DETAIL_BY_CATEGORY.get(category) ?? genericDetail(category);
            option.exists = existing.contains(category);
            info.options.add(option);
        }
        return info;
    }

    /**
     * 고른 구분마다 요청 항목을 만들고(이미 있는 구분은 건너뜀), 프로젝트가 "접수" 단계면 "데이터 수집"으로 넘깁니다.
     */
    @AuraEnabled
    public static CreateResult createRequests(Id projectId, Date dueDate, List<RequestInput> requests) {
        if (dueDate == null || dueDate < Date.today()) {
            throw handledException('제출 마감일은 오늘 이후 날짜로 골라 주세요.');
        }
        if (requests == null || requests.isEmpty()) {
            throw handledException('요청할 자료를 하나 이상 골라 주세요.');
        }
        EPD_Certification_Project__c project = loadProject(projectId);
        Set<String> allowed = new Set<String>(activeCategories());
        Set<String> existing = existingCategories(projectId);

        CreateResult result = new CreateResult();
        List<Data_Request_Item__c> items = new List<Data_Request_Item__c>();
        Set<String> chosen = new Set<String>();
        for (RequestInput request : requests) {
            if (!allowed.contains(request.category)) {
                throw handledException('알 수 없는 데이터 구분입니다: ' + request.category);
            }
            if (!chosen.add(request.category)) {
                continue; // 같은 구분이 두 번 넘어와도 하나만 만듭니다.
            }
            if (existing.contains(request.category)) {
                result.skippedCategories.add(request.category);
                continue;
            }
            items.add(new Data_Request_Item__c(
                Project__c = projectId,
                Data_Category__c = request.category,
                Request_Detail__c = String.isBlank(request.detail) ? genericDetail(request.category) : request.detail.trim().abbreviate(255),
                Status__c = '요청',
                Due_Date__c = dueDate
            ));
        }

        Savepoint sp = Database.setSavepoint();
        try {
            if (!items.isEmpty()) {
                Database.insert(items, AccessLevel.USER_MODE);
                if (project.Stage__c == '접수') {
                    Database.update(new EPD_Certification_Project__c(Id = projectId, Stage__c = '데이터 수집'), AccessLevel.USER_MODE);
                    result.movedToDataCollection = true;
                }
            }
        } catch (DmlException e) {
            Database.rollback(sp);
            throw handledException('요청 항목을 만들지 못했습니다: ' + e.getDmlMessage(0));
        }
        result.createdCount = items.size();
        return result;
    }

    // 설정에서 활성화된 "데이터 구분" 값을 화면 순서대로 돌려줍니다.
    @TestVisible
    private static List<String> activeCategories() {
        List<String> categories = new List<String>();
        for (Schema.PicklistEntry entry : Data_Request_Item__c.Data_Category__c.getDescribe().getPicklistValues()) {
            if (entry.isActive()) {
                categories.add(entry.getValue());
            }
        }
        return categories;
    }

    @TestVisible
    private static String genericDetail(String category) {
        return category + ' 관련 연간 데이터(수량·단위 포함)';
    }

    private static EPD_Certification_Project__c loadProject(Id projectId) {
        if (projectId == null) {
            throw handledException('프로젝트를 찾을 수 없습니다.');
        }
        List<EPD_Certification_Project__c> projects = [
            SELECT Name, Stage__c, Product_Name__c, Customer_Account__r.Name
            FROM EPD_Certification_Project__c WHERE Id = :projectId WITH USER_MODE
        ];
        if (projects.isEmpty()) {
            throw handledException('프로젝트를 찾을 수 없습니다.');
        }
        return projects[0];
    }

    private static Set<String> existingCategories(Id projectId) {
        Set<String> categories = new Set<String>();
        for (Data_Request_Item__c item : [
            SELECT Data_Category__c FROM Data_Request_Item__c WHERE Project__c = :projectId WITH USER_MODE
        ]) {
            categories.add(item.Data_Category__c);
        }
        return categories;
    }

    private static AuraHandledException handledException(String message) {
        AuraHandledException e = new AuraHandledException(message);
        e.setMessage(message);
        return e;
    }
}
