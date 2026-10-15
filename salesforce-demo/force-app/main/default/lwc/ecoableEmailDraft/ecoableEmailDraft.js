import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { CloseActionScreenEvent } from 'lightning/actions';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { notifyRecordUpdateAvailable } from 'lightning/uiRecordApi';
import generateDraft from '@salesforce/apex/EcoAbleEmailDraftController.generateDraft';
import saveDraft from '@salesforce/apex/EcoAbleEmailDraftController.saveDraft';
import getDraftContext from '@salesforce/apex/EcoAbleEmailDraftController.getDraftContext';

// 프로젝트 화면과 할 일(Task) 화면 양쪽의 "AI 메일 초안" 빠른 작업에서 사용합니다.
export default class EcoableEmailDraft extends NavigationMixin(LightningElement) {
    _recordId;
    draftType;
    draft;
    context;
    completeTasks = false;
    isLoading = false;
    errorMessage;

    // 빠른 작업 화면에서는 recordId가 렌더링 뒤에 들어올 수 있어 setter에서 추천 정보를 불러옵니다.
    @api
    get recordId() {
        return this._recordId;
    }
    set recordId(value) {
        this._recordId = value;
        if (value) {
            this.loadContext();
        }
    }

    async loadContext() {
        try {
            this.context = await getDraftContext({ projectId: this._recordId });
        } catch (error) {
            this.errorMessage = this.reduceError(error);
        }
    }

    get hasDraft() {
        return Boolean(this.draft) && !this.isLoading;
    }

    // 고른 메일에 포함되는 열린 할 일 개수
    get tasksToCloseCount() {
        const countByType = {
            reminder: this.context?.reminderTaskCount,
            dueSoon: this.context?.dueSoonTaskCount,
            revision: this.context?.revisionTaskCount,
            info: this.context?.infoTaskCount
        };
        return countByType[this.draftType] ?? 0;
    }

    // 보완 요청·정보 확인 메일은 닫을 할 일이 없어도 "보냈어요"를 기록할 수 있게 체크를 보여 줍니다.
    get showSentCheck() {
        return this.hasTasksToClose || this.draftType === 'revision' || this.draftType === 'info';
    }

    get hasTasksToClose() {
        return this.tasksToCloseCount > 0;
    }

    get completeLabel() {
        if (!this.hasTasksToClose) {
            return '메일을 보냈어요 → 발송 완료로 기록';
        }
        return `메일을 보냈어요 → 이 메일에 포함된 할 일 ${this.tasksToCloseCount}개도 완료 처리`;
    }

    handleCompleteChange(event) {
        this.completeTasks = event.target.checked;
    }

    get isReminderRecommended() {
        return this.context?.recommendedType === 'reminder';
    }

    get isDueSoonRecommended() {
        return this.context?.recommendedType === 'dueSoon';
    }

    get isRevisionRecommended() {
        return this.context?.recommendedType === 'revision';
    }

    get revisionClass() {
        return this.typeClass('revision');
    }

    handleRevision() {
        this.generate('revision');
    }

    get isInfoRecommended() {
        return this.context?.recommendedType === 'info';
    }

    get infoClass() {
        return this.typeClass('info');
    }

    handleInfo() {
        this.generate('info');
    }

    get hasMissingInfo() {
        return Boolean(this.context?.missingInfo?.length);
    }

    get missingInfoText() {
        return (this.context?.missingInfo ?? []).join(', ');
    }

    get recommendClass() {
        return this.context?.recommendedType ? 'draft__recommend' : 'draft__recommend draft__recommend--none';
    }

    get recommendText() {
        const ctx = this.context;
        if (!ctx?.recommendedType) {
            return '지금 고객사에 요청할 미제출 자료가 없어요. 메일을 보내지 않아도 됩니다.';
        }
        if (ctx.recommendedType === 'dueSoon') {
            return '마감 임박 자료만 있어요. "마감 임박 안내"를 추천해요.';
        }
        if (ctx.recommendedType === 'revision') {
            return '받은 자료 중 보완이 필요한 자료만 있어요. 고마움을 먼저 전하는 "보완 요청"을 추천해요.';
        }
        if (ctx.recommendedType === 'info') {
            return '프로젝트 기본 정보가 비어 있어요. 진행 전에 "정보 확인" 메일로 먼저 여쭤보는 것을 추천해요.';
        }
        if (ctx.dueSoonCount > 0) {
            return '마감 지난(또는 보완 필요) 자료와 임박 자료가 함께 있어요. 고객사가 메일을 두 번 받지 않도록 "독촉 메일" 한 통에 임박 자료까지 함께 안내하는 것을 추천해요.';
        }
        return '마감 지난(또는 보완 필요) 자료가 있어요. "독촉 메일"을 추천해요.';
    }

    get reminderClass() {
        return this.typeClass('reminder');
    }

    get dueSoonClass() {
        return this.typeClass('dueSoon');
    }

    typeClass(type) {
        return this.draftType === type ? 'draft__type draft__type--selected' : 'draft__type';
    }

    handleReminder() {
        this.generate('reminder');
    }

    handleDueSoon() {
        this.generate('dueSoon');
    }

    handleRegenerate() {
        this.generate(this.draftType);
    }

    async generate(type) {
        this.draftType = type;
        this.completeTasks = false;
        this.draft = undefined;
        this.errorMessage = undefined;
        this.isLoading = true;
        try {
            this.draft = await generateDraft({ projectId: this.recordId, draftType: type });
        } catch (error) {
            this.errorMessage = this.reduceError(error);
        } finally {
            this.isLoading = false;
        }
    }

    handleDraftChange(event) {
        this.draft = event.detail.value;
    }

    async handleSave() {
        this.isLoading = true;
        this.errorMessage = undefined;
        try {
            const closedCount = await saveDraft({
                projectId: this.recordId,
                draft: this.draft,
                draftType: this.draftType,
                completeTasks: this.completeTasks && this.showSentCheck
            });
            const changed = [{ recordId: this.context?.projectId ?? this.recordId }];
            if (this.context?.openedFromTask) {
                changed.push({ recordId: this.recordId });
            }
            await notifyRecordUpdateAvailable(changed);
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'AI 메일 초안을 저장했습니다',
                    message:
                        closedCount > 0
                            ? `관련 할 일 ${closedCount}개를 완료 처리했어요.`
                            : '내용을 검토한 뒤 메일 검토 상태를 바꿔 주세요.',
                    variant: 'success'
                })
            );
            this.handleClose();
        } catch (error) {
            this.errorMessage = this.reduceError(error);
        } finally {
            this.isLoading = false;
        }
    }

    handleClose() {
        this.dispatchEvent(new CloseActionScreenEvent());
    }

    handleOpenProject() {
        const projectId = this.context?.projectId;
        if (!projectId) {
            return;
        }
        this.handleClose();
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: { recordId: projectId, objectApiName: 'EPD_Certification_Project__c', actionName: 'view' }
        });
    }

    reduceError(error) {
        return error?.body?.message || error?.message || '알 수 없는 오류가 발생했습니다.';
    }
}
