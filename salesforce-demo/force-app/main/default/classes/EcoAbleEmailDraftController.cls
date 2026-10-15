/**
 * 인증 컨설팅 프로젝트 화면의 "AI 메일 초안" 버튼(ecoableEmailDraft LWC)용 컨트롤러.
 * Prompt Builder 템플릿으로 메일 초안을 만들고, 사람이 검토한 초안을 프로젝트에 저장합니다.
 * 메일을 실제로 발송하지는 않습니다.
 */
public with sharing class EcoAbleEmailDraftController {
    @TestVisible
    private static final Map<String, String> TEMPLATE_BY_TYPE = new Map<String, String>{
        'reminder' => 'EcoAble_Data_Request_Reminder',
        'dueSoon' => 'EcoAble_Due_Soon_Notice',
        'revision' => 'EcoAble_Revision_Request',
        'info' => 'EcoAble_Info_Request'
    };

    private static final Map<String, String> DRAFT_TYPE_LABEL = new Map<String, String>{
        'reminder' => '독촉 메일',
        'dueSoon' => '마감 임박 안내',
        'revision' => '보완 요청',
        'info' => '정보 확인'
    };

    // 메일 종류별로 "메일을 보냈어요" 체크 시 함께 닫을 할 일 제목의 머리말.
    // 독촉 메일은 기한 초과·보완 필요·임박 자료를 모두 담으므로 세 종류를 닫고, 정보 확인 할 일은 정보 확인 메일만 닫습니다.
    private static final Map<String, List<String>> TASK_PREFIXES_BY_TYPE = new Map<String, List<String>>{
        'reminder' => new List<String>{ '[기한 초과]', '[D-', '[보완 요청]' },
        'dueSoon' => new List<String>{ '[D-' },
        'revision' => new List<String>{ '[보완 요청]' },
        'info' => new List<String>{ '[정보 확인]' }
    };

    @TestVisible
    private static String mockGeneration;

    public class DraftContext {
        @AuraEnabled public Id projectId;
        @AuraEnabled public String projectLabel;
        @AuraEnabled public Boolean openedFromTask = false;
        @AuraEnabled public Integer overdueCount = 0;
        @AuraEnabled public Integer revisionCount = 0;
        @AuraEnabled public Integer dueSoonCount = 0;
        // 메일 종류별로 함께 완료 처리할 수 있는 열린 할 일 개수
        @AuraEnabled public Integer reminderTaskCount = 0;
        @AuraEnabled public Integer dueSoonTaskCount = 0;
        @AuraEnabled public Integer revisionTaskCount = 0;
        @AuraEnabled public Integer infoTaskCount = 0;
        // reminder: 기한 초과가 있거나 보완+임박이 함께 있음(독촉 메일 한 통에 모두 포함)
        // revision: 보완 요청만 있음 / dueSoon: 임박 자료만 있음 / info: 자료 문제는 없고 기본 정보가 비어 있음 / null: 보낼 것 없음
        @AuraEnabled public String recommendedType;
        // 비어 있는 프로젝트 기본 정보 (예: 고객 담당자, 목표 인증일, 데이터 요청 항목)
        @AuraEnabled public List<String> missingInfo = new List<String>();
    }

    // 버튼은 프로젝트 화면과 할 일(Task) 화면 양쪽에 있습니다. 할 일에서 열면 연결된 프로젝트를 찾습니다.
    @TestVisible
    private static Id resolveProjectId(Id recordId) {
        if (recordId == null) {
            throw handledException('프로젝트를 찾을 수 없습니다.');
        }
        if (recordId.getSobjectType() == EPD_Certification_Project__c.SObjectType) {
            return recordId;
        }
        if (recordId.getSobjectType() == Task.SObjectType) {
            List<Task> tasks = [SELECT WhatId FROM Task WHERE Id = :recordId WITH USER_MODE LIMIT 1];
            if (!tasks.isEmpty() && tasks[0].WhatId != null
                && tasks[0].WhatId.getSobjectType() == EPD_Certification_Project__c.SObjectType) {
                return tasks[0].WhatId;
            }
            throw handledException('이 할 일은 인증 컨설팅 프로젝트와 연결되어 있지 않아요. "관련 항목"에 프로젝트를 지정해 주세요.');
        }
        throw handledException('이 화면에서는 메일 초안을 만들 수 없어요.');
    }

    @AuraEnabled
    public static DraftContext getDraftContext(Id projectId) {
        DraftContext ctx = new DraftContext();
        ctx.openedFromTask = projectId != null && projectId.getSobjectType() == Task.SObjectType;
        projectId = resolveProjectId(projectId);
        EPD_Certification_Project__c project = [
            SELECT Name, Product_Name__c, Customer_Account__r.Name, Customer_Contact__c,
                   Target_Certification_Date__c, Total_Requests__c, Stage__c
            FROM EPD_Certification_Project__c WHERE Id = :projectId WITH USER_MODE
        ];
        ctx.projectId = projectId;
        ctx.projectLabel = project.Name + ' ' + (project.Customer_Account__r?.Name ?? '') + ' / ' + (project.Product_Name__c ?? '');
        if (project.Stage__c != '인증 완료') {
            if (project.Customer_Contact__c == null) {
                ctx.missingInfo.add('고객 담당자');
            }
            if (project.Target_Certification_Date__c == null) {
                ctx.missingInfo.add('목표 인증일');
            }
            if (project.Total_Requests__c == null || project.Total_Requests__c == 0) {
                ctx.missingInfo.add('평가 범위·데이터 요청 항목');
            }
        }
        for (Data_Request_Item__c item : [
            SELECT Status__c, Is_Overdue__c, Days_To_Due__c
            FROM Data_Request_Item__c
            WHERE Project__c = :projectId AND Status__c != '수령'
            WITH USER_MODE
        ]) {
            if (item.Is_Overdue__c) {
                ctx.overdueCount++;
            } else if (item.Status__c == '보완 요청') {
                ctx.revisionCount++;
            } else if (item.Days_To_Due__c != null && item.Days_To_Due__c >= 0 && item.Days_To_Due__c <= 3) {
                ctx.dueSoonCount++;
            }
        }
        List<Task> openTasks = openMailTasks(projectId);
        ctx.reminderTaskCount = tasksCoveredBy(openTasks, 'reminder').size();
        ctx.dueSoonTaskCount = tasksCoveredBy(openTasks, 'dueSoon').size();
        ctx.revisionTaskCount = tasksCoveredBy(openTasks, 'revision').size();
        ctx.infoTaskCount = tasksCoveredBy(openTasks, 'info').size();
        ctx.recommendedType = recommendType(ctx.overdueCount, ctx.revisionCount, ctx.dueSoonCount, !ctx.missingInfo.isEmpty());
        return ctx;
    }

    // 메일 종류 추천 규칙. 홈 화면(EcoAbleHomeController)도 같은 규칙을 씁니다.
    public static String recommendType(Integer overdue, Integer revision, Integer dueSoon, Boolean hasMissingInfo) {
        if (overdue > 0 || (revision > 0 && dueSoon > 0)) {
            return 'reminder';
        }
        if (revision > 0) {
            return 'revision';
        }
        if (dueSoon > 0) {
            return 'dueSoon';
        }
        return hasMissingInfo ? 'info' : null;
    }

    public static String draftTypeLabel(String draftType) {
        return draftType == null ? null : DRAFT_TYPE_LABEL.get(draftType);
    }

    @AuraEnabled
    public static String generateDraft(Id projectId, String draftType) {
        projectId = resolveProjectId(projectId);
        String templateApiName = TEMPLATE_BY_TYPE.get(draftType);
        if (templateApiName == null) {
            throw handledException('알 수 없는 메일 종류입니다: ' + draftType);
        }
        // 보낼 내용이 없으면 AI를 부르지 않고 한 줄 안내를 돌려줍니다(AI가 없는 자료를 지어내는 것을 막음).
        String nothingToWrite = nothingToWriteMessage(projectId, draftType);
        if (nothingToWrite != null) {
            return nothingToWrite;
        }
        try {
            String text = callPromptTemplate(templateApiName, projectId);
            if (String.isBlank(text)) {
                throw handledException('AI가 빈 응답을 반환했습니다. 잠시 후 다시 시도해 주세요.');
            }
            return ensureRecipientWarning(projectId, fillItemList(projectId, draftType, text.trim()));
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw handledException('메일 초안을 만들지 못했습니다: ' + e.getMessage());
        }
    }

    /**
     * 초안을 프로젝트에 저장합니다. completeTasks가 true이면(연구원이 "메일을 보냈어요"를 체크)
     * 이 메일에 포함되는 열린 할 일을 함께 완료 처리하고, 완료한 개수를 돌려줍니다.
     * 초안 저장만으로는 할 일을 자동 완료하지 않습니다(발송하지 않은 채 할 일이 사라지는 것을 막기 위해).
     */
    @AuraEnabled
    public static Integer saveDraft(Id projectId, String draft, String draftType, Boolean completeTasks) {
        projectId = resolveProjectId(projectId);
        Boolean sent = completeTasks == true;
        // 프로젝트 화면의 "메일 발송 완료" 체크와 같은 칸을 씁니다. 새 초안은 발송 전이므로 체크를 풉니다.
        EPD_Certification_Project__c project = new EPD_Certification_Project__c(
            Id = projectId,
            Reminder_Email_Draft__c = draft,
            Draft_Type__c = DRAFT_TYPE_LABEL.get(draftType),
            Email_Sent__c = sent,
            Email_Sent_At__c = sent ? System.now() : null,
            Reminder_Review_Status__c = sent ? '검토 완료' : '미검토'
        );
        List<Task> tasksToClose = sent ? tasksCoveredBy(openMailTasks(projectId), draftType) : new List<Task>();
        for (Task t : tasksToClose) {
            t.Status = 'Completed';
        }
        try {
            Database.update(project, AccessLevel.USER_MODE);
            if (!tasksToClose.isEmpty()) {
                Database.update(tasksToClose, AccessLevel.USER_MODE);
            }
        } catch (DmlException e) {
            throw handledException('저장하지 못했습니다: ' + e.getDmlMessage(0));
        }
        return tasksToClose.size();
    }

    // Flow가 만든 "… 메일 보내기" 할 일 중 아직 열려 있는 것
    private static List<Task> openMailTasks(Id projectId) {
        return [
            SELECT Id, Subject FROM Task
            WHERE WhatId = :projectId AND IsClosed = false AND Subject LIKE '%메일 보내기%'
            WITH USER_MODE
        ];
    }

    private static List<Task> tasksCoveredBy(List<Task> openTasks, String draftType) {
        List<Task> result = new List<Task>();
        List<String> prefixes = TASK_PREFIXES_BY_TYPE.get(draftType);
        if (prefixes == null) {
            return result;
        }
        for (Task t : openTasks) {
            for (String prefix : prefixes) {
                if (t.Subject.startsWith(prefix)) {
                    result.add(t);
                    break;
                }
            }
        }
        return result;
    }

    private static String callPromptTemplate(String templateApiName, Id projectId) {
        ConnectApi.EinsteinPromptTemplateGenerationsInput input = buildInput(projectId);
        if (Test.isRunningTest()) {
            return mockGeneration;
        }
        return firstGeneration(ConnectApi.EinsteinLLM.generateMessagesForPromptTemplate(templateApiName, input));
    }

    // 메일 종류별로 쓸 내용이 없을 때의 한 줄 안내. 프롬프트 템플릿의 한 줄 응답과 같은 문구입니다.
    private static final Map<String, String> NOTHING_TO_WRITE_BY_TYPE = new Map<String, String>{
        'reminder' => '현재 요청할 미제출 자료가 없습니다.',
        'dueSoon' => '3일 이내에 마감되는 미제출 자료가 없습니다.',
        'revision' => '보완을 요청할 자료가 없습니다.',
        'info' => '추가로 확인할 프로젝트 정보가 없습니다.'
    };

    // 메일 종류에 해당하는 자료나 정보가 하나도 없으면 "[번호] [고객사] / [제품]: …" 한 줄을, 있으면 null을 돌려줍니다.
    @TestVisible
    private static String nothingToWriteMessage(Id projectId, String draftType) {
        EPD_Certification_Project__c project = [
            SELECT Name, Product_Name__c, Customer_Account__r.Name, Missing_Info__c,
                   (SELECT Status__c, Days_To_Due__c FROM Data_Requests__r WHERE Status__c != '수령')
            FROM EPD_Certification_Project__c WHERE Id = :projectId WITH USER_MODE
        ];
        Boolean hasContent = false;
        if (draftType == 'info') {
            hasContent = String.isNotBlank(project.Missing_Info__c) && project.Missing_Info__c != '없음';
        }
        for (Data_Request_Item__c item : project.Data_Requests__r) {
            Boolean dueSoon = item.Days_To_Due__c != null && item.Days_To_Due__c >= 0 && item.Days_To_Due__c <= 3;
            if (draftType == 'reminder' || (draftType == 'dueSoon' && dueSoon) || (draftType == 'revision' && item.Status__c == '보완 요청')) {
                hasContent = true;
            }
        }
        if (hasContent) {
            return null;
        }
        String label = project.Name + ' ' + (project.Customer_Account__r?.Name ?? '') + ' / ' + (project.Product_Name__c ?? '');
        return label + ': ' + NOTHING_TO_WRITE_BY_TYPE.get(draftType);
    }

    // 템플릿이 목록 자리에 이 표시를 남기면, Apex가 그 자리에 Salesforce가 정한 자료 목록을 채웁니다.
    // AI가 목록을 직접 베껴 쓰면 자료를 빠뜨리거나 다른 묶음에 넣는 일이 있어, 목록은 AI에게 맡기지 않습니다.
    @TestVisible
    private static final String ITEM_LIST_PLACEHOLDER = '[자료 목록]';

    // 독촉 메일 묶음 순서와 제목. 키는 메일 분류(Mail_Group__c) 값입니다.
    private static final List<String> REMINDER_GROUPS = new List<String>{ '기한 지난 자료', '보완이 필요한 자료', '아직 기한 전인 자료' };
    private static final Map<String, String> REMINDER_GROUP_HEADING = new Map<String, String>{
        '기한 지난 자료' => '제출 기한이 지난 자료',
        '보완이 필요한 자료' => '보완이 필요한 자료',
        '아직 기한 전인 자료' => '아직 기한 전인 자료'
    };

    @TestVisible
    private static String fillItemList(Id projectId, String draftType, String text) {
        Integer at = text.indexOf(ITEM_LIST_PLACEHOLDER);
        if (at < 0) {
            return text;
        }
        // 표시를 두 번 이상 썼더라도 목록은 한 번만 넣습니다.
        String after = text.substring(at + ITEM_LIST_PLACEHOLDER.length()).replace(ITEM_LIST_PLACEHOLDER, '');
        return text.left(at) + buildItemList(projectId, draftType) + after;
    }

    // 메일 종류에 맞는 미수령 자료를 "- 데이터 구분 - 요청 내용 (제출 기한)" 줄로 만듭니다.
    @TestVisible
    private static String buildItemList(Id projectId, String draftType) {
        Map<String, List<String>> linesByGroup = new Map<String, List<String>>();
        List<String> lines = new List<String>();
        for (Data_Request_Item__c item : [
            SELECT Data_Category__c, Request_Detail__c, Status__c, Due_Date__c, Days_To_Due__c, Revision_Reason__c, Mail_Group__c
            FROM Data_Request_Item__c
            WHERE Project__c = :projectId AND Status__c != '수령'
            WITH USER_MODE
            ORDER BY Due_Date__c ASC NULLS LAST, Name ASC
        ]) {
            Boolean isRevision = item.Status__c == '보완 요청';
            String reason = isRevision && String.isNotBlank(item.Revision_Reason__c) ? '\n  보완 사유: ' + item.Revision_Reason__c : '';
            String head = '- ' + item.Data_Category__c + ' - ' + (item.Request_Detail__c ?? '') + ' (' + koreanDate(item.Due_Date__c);
            if (draftType == 'reminder' && item.Mail_Group__c != null) {
                if (!linesByGroup.containsKey(item.Mail_Group__c)) {
                    linesByGroup.put(item.Mail_Group__c, new List<String>());
                }
                linesByGroup.get(item.Mail_Group__c).add(head + ')' + reason);
            } else if (draftType == 'dueSoon' && item.Days_To_Due__c != null && item.Days_To_Due__c >= 0 && item.Days_To_Due__c <= 3) {
                lines.add(head + ', ' + (item.Days_To_Due__c == 0 ? '오늘 마감' : 'D-' + item.Days_To_Due__c.intValue()) + ')');
            } else if (draftType == 'revision' && isRevision) {
                lines.add(head + ')' + reason);
            }
        }
        if (draftType != 'reminder') {
            return String.join(lines, '\n');
        }
        List<String> blocks = new List<String>();
        for (String g : REMINDER_GROUPS) {
            if (linesByGroup.containsKey(g)) {
                blocks.add(REMINDER_GROUP_HEADING.get(g) + '\n' + String.join(linesByGroup.get(g), '\n'));
            }
        }
        return String.join(blocks, '\n\n');
    }

    @TestVisible
    private static String koreanDate(Date d) {
        return d == null ? '기한 미정' : d.year() + '. ' + d.month() + '. ' + d.day() + '.';
    }

    @TestVisible
    private static final String RECIPIENT_WARNING = '※ 고객 담당자 미지정 - 수신자 확인 필요';

    // 고객 담당자가 없는 프로젝트의 메일 초안에는 AI가 빠뜨려도 수신자 확인 경고를 맨 위에 붙입니다.
    // "제목"이 없는 한 줄 응답(보낼 내용 없음)에는 붙이지 않습니다.
    @TestVisible
    private static String ensureRecipientWarning(Id projectId, String text) {
        // AI가 기호를 조금 다르게 써도 경고가 두 번 붙지 않도록 핵심 문구로 확인합니다.
        if (text.contains('수신자 확인') || !text.contains('제목')) {
            return text;
        }
        EPD_Certification_Project__c project = [
            SELECT Customer_Contact__c FROM EPD_Certification_Project__c WHERE Id = :projectId WITH USER_MODE
        ];
        return project.Customer_Contact__c == null ? RECIPIENT_WARNING + '\n\n' + text : text;
    }

    // 템플릿의 입력 이름이 "project"이므로 "Input:project"로 프로젝트 Id를 넘깁니다.
    @TestVisible
    private static ConnectApi.EinsteinPromptTemplateGenerationsInput buildInput(Id projectId) {
        ConnectApi.WrappedValue projectValue = new ConnectApi.WrappedValue();
        projectValue.value = new Map<String, String>{ 'id' => projectId };

        ConnectApi.EinsteinPromptTemplateGenerationsInput input = new ConnectApi.EinsteinPromptTemplateGenerationsInput();
        input.isPreview = false;
        input.inputParams = new Map<String, ConnectApi.WrappedValue>{ 'Input:project' => projectValue };
        input.additionalConfig = new ConnectApi.EinsteinLlmAdditionalConfigInput();
        input.additionalConfig.applicationName = 'PromptTemplateGenerationsInvocable';
        return input;
    }

    @TestVisible
    private static String firstGeneration(ConnectApi.EinsteinPromptTemplateGenerationsRepresentation result) {
        if (result == null || result.generations == null || result.generations.isEmpty()) {
            return null;
        }
        return result.generations[0].text;
    }

    private static AuraHandledException handledException(String message) {
        AuraHandledException e = new AuraHandledException(message);
        e.setMessage(message);
        return e;
    }
}
