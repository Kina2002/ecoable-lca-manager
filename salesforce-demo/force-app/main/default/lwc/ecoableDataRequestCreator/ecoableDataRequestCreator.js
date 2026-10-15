import { LightningElement, api } from 'lwc';
import { CloseActionScreenEvent } from 'lightning/actions';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { notifyRecordUpdateAvailable } from 'lightning/uiRecordApi';
import { RefreshEvent } from 'lightning/refresh';
import getSetup from '@salesforce/apex/EcoAbleDataRequestController.getSetup';
import createRequests from '@salesforce/apex/EcoAbleDataRequestController.createRequests';

// 프로젝트 화면의 "요청 항목 만들기" 빠른 작업. 데이터 구분 목록을 읽어 와 고른 자료만 요청 항목으로 만듭니다.
export default class EcoableDataRequestCreator extends LightningElement {
    _recordId;
    setup;
    rows = [];
    dueDate;
    isLoading = false;
    isSaving = false;
    errorMessage;

    // 빠른 작업 화면에서는 recordId가 렌더링 뒤에 들어올 수 있어 setter에서 불러옵니다.
    @api
    get recordId() {
        return this._recordId;
    }
    set recordId(value) {
        this._recordId = value;
        if (value) {
            this.loadSetup();
        }
    }

    async loadSetup() {
        this.isLoading = true;
        try {
            this.setup = await getSetup({ projectId: this._recordId });
            this.dueDate = this.setup.defaultDueDate;
            // 이미 있는 구분은 체크를 풀고 건너뜀으로 표시합니다.
            this.rows = this.setup.options.map((option) => ({
                category: option.category,
                detail: option.defaultDetail,
                exists: option.exists,
                selected: !option.exists
            }));
        } catch (error) {
            this.errorMessage = this.reduceError(error);
        } finally {
            this.isLoading = false;
        }
    }

    get displayRows() {
        return this.rows.map((row) => ({
            ...row,
            showDetail: row.selected && !row.exists,
            rowClass: row.exists ? 'req__row req__row--exists' : 'req__row'
        }));
    }

    get isIntake() {
        return this.setup?.stage === '접수';
    }

    get today() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    }

    get selectedRows() {
        return this.rows.filter((row) => row.selected && !row.exists);
    }

    get createLabel() {
        return `요청 항목 ${this.selectedRows.length}개 만들기`;
    }

    get isCreateDisabled() {
        return this.isSaving || this.selectedRows.length === 0 || !this.dueDate;
    }

    handleToggle(event) {
        const category = event.target.dataset.category;
        const checked = event.target.checked;
        this.rows = this.rows.map((row) => (row.category === category ? { ...row, selected: checked } : row));
    }

    handleDetail(event) {
        const category = event.target.dataset.category;
        const value = event.target.value;
        this.rows = this.rows.map((row) => (row.category === category ? { ...row, detail: value } : row));
    }

    handleDue(event) {
        this.dueDate = event.target.value;
    }

    async handleCreate() {
        const dueInput = this.template.querySelector('.req__due');
        if (dueInput && !dueInput.reportValidity()) {
            return;
        }
        this.isSaving = true;
        this.errorMessage = undefined;
        try {
            const result = await createRequests({
                projectId: this._recordId,
                dueDate: this.dueDate,
                requests: this.selectedRows.map((row) => ({ category: row.category, detail: row.detail }))
            });
            await notifyRecordUpdateAvailable([{ recordId: this._recordId }]);
            this.dispatchEvent(new RefreshEvent());
            this.dispatchEvent(
                new ShowToastEvent({
                    title: `데이터 요청 항목 ${result.createdCount}개를 만들었어요`,
                    message: this.resultMessage(result),
                    variant: result.createdCount > 0 ? 'success' : 'info'
                })
            );
            this.handleClose();
        } catch (error) {
            this.errorMessage = this.reduceError(error);
        } finally {
            this.isSaving = false;
        }
    }

    resultMessage(result) {
        const parts = [];
        if (result.movedToDataCollection) {
            parts.push('진행 단계를 "데이터 수집"으로 바꿨어요.');
        }
        if (result.skippedCategories?.length) {
            parts.push(`이미 있어서 건너뛴 항목: ${result.skippedCategories.join(', ')}`);
        }
        return parts.length ? parts.join(' ') : '요청 내용은 데이터 요청 항목 목록에서 언제든 고칠 수 있어요.';
    }

    handleClose() {
        this.dispatchEvent(new CloseActionScreenEvent());
    }

    reduceError(error) {
        return error?.body?.message || error?.message || '알 수 없는 오류가 발생했습니다.';
    }
}
