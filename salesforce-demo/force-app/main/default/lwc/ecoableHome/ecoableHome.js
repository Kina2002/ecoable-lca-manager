import { LightningElement, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { refreshApex } from '@salesforce/apex';
import getSummary from '@salesforce/apex/EcoAbleHomeController.getSummary';
import getProjects from '@salesforce/apex/EcoAbleHomeController.getProjects';

const PAGE_STEP = 10;
const SEARCH_DELAY_MS = 350;
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const KIND_CLASS = {
    overdue: 'home__badge home__badge--overdue',
    revision: 'home__badge home__badge--revision',
    dueSoon: 'home__badge home__badge--soon',
    info: 'home__badge home__badge--info'
};
const KIND_LABEL = { overdue: '기한 초과', dueSoon: '마감 임박', revision: '보완 요청', info: '정보 확인' };
const LIST_PAGES = {
    projects: { objectApiName: 'EPD_Certification_Project__c', filterName: 'All' },
    overdue: { objectApiName: 'Data_Request_Item__c', filterName: 'Overdue_Requests' },
    dueSoon: { objectApiName: 'Data_Request_Item__c', filterName: 'Due_Soon_Requests' },
    items: { objectApiName: 'Data_Request_Item__c', filterName: 'All' },
    tasks: { objectApiName: 'Task', filterName: 'EcoAble_Reminder_Tasks' }
};

// 에코에이블 홈 탭: 전체 현황 + 거르기·더 보기로 프로젝트가 많아도 필요한 것만 보여 줍니다.
export default class EcoableHome extends NavigationMixin(LightningElement) {
    // 숫자 칸·주의 항목·할 일
    summary;
    summaryResult;
    attentionLimit = PAGE_STEP;
    taskLimit = PAGE_STEP;

    // 프로젝트 현황표 거르기
    attentionOnly = true;
    includeCompleted = false;
    selectedStage = '';
    researcherId = '';
    searchText = '';
    searchInput = '';
    pageSize = PAGE_STEP;
    projectPage;
    projectResult;
    isProjectsLoading = true;

    errorMessage;
    isRefreshing = false;
    searchTimer;

    @wire(getSummary, { attentionLimit: '$attentionLimit', taskLimit: '$taskLimit' })
    wiredSummary(result) {
        this.summaryResult = result;
        if (result.data) {
            this.summary = result.data;
            this.errorMessage = undefined;
        } else if (result.error) {
            this.errorMessage = result.error?.body?.message || '현황을 불러오지 못했습니다.';
        }
    }

    @wire(getProjects, {
        attentionOnly: '$attentionOnly',
        includeCompleted: '$includeCompleted',
        stage: '$selectedStage',
        researcherId: '$researcherId',
        searchText: '$searchText',
        pageSize: '$pageSize'
    })
    wiredProjects(result) {
        this.projectResult = result;
        if (result.data) {
            this.projectPage = result.data;
            this.isProjectsLoading = false;
        } else if (result.error) {
            this.isProjectsLoading = false;
            this.errorMessage = result.error?.body?.message || '프로젝트를 불러오지 못했습니다.';
        }
    }

    get isLoading() {
        return !this.summary && !this.errorMessage;
    }

    get todayLabel() {
        const d = this.summary?.today;
        if (!d) {
            return '';
        }
        const [y, m, day] = d.split('-').map(Number);
        return `${y}년 ${m}월 ${day}일 (${WEEKDAYS[new Date(y, m - 1, day).getDay()]}) 기준`;
    }

    // ---------- 숫자 칸 ----------
    get tiles() {
        const k = this.summary?.kpis;
        if (!k) {
            return [];
        }
        return [
            { key: 'active', label: '진행 중 프로젝트', value: k.activeProjects, sub: `인증 완료 ${k.completedProjects}건`, tone: 'neutral', target: 'projects' },
            {
                key: 'rate',
                label: '전체 데이터 수집률',
                value: k.collectionRate == null ? '-' : `${k.collectionRate}%`,
                sub: `진행 중 요청 ${k.activeRequests}건 중 ${k.receivedRequests}건 수령`,
                tone: 'good',
                target: 'items'
            },
            { key: 'overdue', label: '기한 초과 요청', value: k.overdueItems, sub: '바로 독촉이 필요해요', tone: 'overdue', target: 'overdue' },
            { key: 'soon', label: '3일 안에 마감', value: k.dueSoonItems, sub: '미리 안내하면 좋아요', tone: 'soon', target: 'dueSoon' },
            { key: 'revision', label: '보완 요청', value: k.revisionItems, sub: '받은 자료 중 다시 받을 것', tone: 'revision', target: 'items' },
            { key: 'missing', label: '정보가 빈 프로젝트', value: k.missingInfoProjects, sub: '담당자·목표일·요청 항목', tone: 'info', target: 'projects' },
            { key: 'tasks', label: '열린 메일 할 일', value: k.openMailTasks, sub: '보내야 할 안내·독촉 메일', tone: 'neutral', target: 'tasks' }
        ].map((t) => ({ ...t, className: `home__tile home__tile--${t.tone}` }));
    }

    // ---------- 단계 화살표 (누르면 그 단계만) ----------
    get stages() {
        const list = this.summary?.stages ?? [];
        const last = list.length - 1;
        return list.map((s, i) => {
            const selected = s.stage === this.selectedStage;
            let className = 'home__stage';
            if (s.count > 0) className += ' home__stage--filled';
            if (selected) className += ' home__stage--selected';
            if (i === last) className += ' home__stage--last';
            return { ...s, className, pressed: selected ? 'true' : 'false' };
        });
    }

    get stageHint() {
        return this.selectedStage ? `"${this.selectedStage}" 단계만 보는 중 · 다시 누르면 전체` : '단계를 누르면 그 단계 프로젝트만 보여요';
    }

    handleStageClick(event) {
        const stage = event.currentTarget.dataset.stage;
        this.selectedStage = this.selectedStage === stage ? '' : stage;
        this.resetPaging();
    }

    // ---------- 거르기 줄 ----------
    get researcherOptions() {
        return [{ label: '전체 연구원', value: '' }, ...(this.summary?.researchers ?? [])];
    }

    // 검색 중에는 서버가 "주의 필요만"·"인증 완료 숨기기"를 무시하고 모든 프로젝트에서 찾습니다.
    get isSearching() {
        return Boolean(this.searchText);
    }

    get attentionDisabled() {
        return this.isSearching;
    }

    get completedDisabled() {
        return Boolean(this.selectedStage) || this.isSearching;
    }

    handleAttentionOnly(event) {
        this.attentionOnly = event.target.checked;
        this.resetPaging();
    }

    handleIncludeCompleted(event) {
        this.includeCompleted = event.target.checked;
        this.resetPaging();
    }

    handleResearcher(event) {
        this.researcherId = event.detail.value;
        this.resetPaging();
    }

    handleSearch(event) {
        this.searchInput = event.target.value;
        clearTimeout(this.searchTimer);
        // 글자를 칠 때마다 서버에 묻지 않도록 잠깐 기다렸다가 찾습니다.
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this.searchTimer = setTimeout(() => {
            this.searchText = (this.searchInput ?? '').trim();
            this.resetPaging();
        }, SEARCH_DELAY_MS);
    }

    get hasActiveFilter() {
        return !this.attentionOnly || this.includeCompleted || this.selectedStage || this.researcherId || this.searchText;
    }

    handleClearFilters() {
        this.attentionOnly = true;
        this.includeCompleted = false;
        this.selectedStage = '';
        this.researcherId = '';
        this.searchText = '';
        this.searchInput = '';
        this.resetPaging();
    }

    resetPaging() {
        this.pageSize = PAGE_STEP;
    }

    // ---------- 프로젝트 현황표 ----------
    get projects() {
        return (this.projectPage?.rows ?? []).map((p) => {
            const badges = [];
            if (p.overdue) badges.push({ key: 'o', label: `기한 초과 ${p.overdue}`, className: KIND_CLASS.overdue });
            if (p.revision) badges.push({ key: 'r', label: `보완 ${p.revision}`, className: KIND_CLASS.revision });
            if (p.dueSoon) badges.push({ key: 's', label: `임박 ${p.dueSoon}`, className: KIND_CLASS.dueSoon });
            if (p.missingInfo) badges.push({ key: 'i', label: '정보 누락', className: KIND_CLASS.info });
            return {
                ...p,
                badges,
                hasBadges: badges.length > 0,
                rateValue: p.collectionRate ?? 0,
                rateText: p.totalRequests ? `${p.collectionRate ?? 0}% (${p.receivedRequests}/${p.totalRequests})` : '요청 항목 없음',
                nextDue: this.formatDate(p.nextDueDate),
                target: this.formatDate(p.targetDate),
                recommendText: p.recommendedLabel ?? '보낼 메일 없음',
                recommendClass: p.recommendedType ? 'home__recommend' : 'home__recommend home__recommend--none',
                stageClass: p.stage === '인증 완료' ? 'home__stage-pill home__stage-pill--done' : 'home__stage-pill'
            };
        });
    }

    get hasProjects() {
        return this.projects.length > 0;
    }

    get projectCountText() {
        const page = this.projectPage;
        if (!page) {
            return '';
        }
        return `${page.totalCount}개 중 ${page.rows.length}개 표시`;
    }

    get emptyProjectsText() {
        if (this.isSearching) {
            return `"${this.searchText}"에 맞는 프로젝트가 없어요. 프로젝트 번호, 고객사, 제품 이름으로 찾아보세요.`;
        }
        return this.attentionOnly && !this.researcherId && !this.selectedStage
            ? '손이 많이 가는 프로젝트가 없어요. "주의 필요만"을 끄면 전체가 보여요.'
            : '조건에 맞는 프로젝트가 없어요.';
    }

    get hasMoreProjects() {
        return Boolean(this.projectPage?.hasMore);
    }

    handleMoreProjects() {
        this.pageSize += PAGE_STEP;
    }

    // ---------- 주의 항목 · 메일 할 일 ----------
    get attentionItems() {
        return (this.summary?.attentionItems ?? []).map((i) => ({
            ...i,
            badgeClass: KIND_CLASS[i.kind],
            due: this.formatDate(i.dueDate)
        }));
    }

    get hasAttentionItems() {
        return this.attentionItems.length > 0;
    }

    get attentionTotal() {
        const k = this.summary?.kpis;
        return k ? k.overdueItems + k.dueSoonItems + k.revisionItems : 0;
    }

    get attentionCountText() {
        return `${this.attentionTotal}개 중 ${this.attentionItems.length}개 표시`;
    }

    get hasMoreAttention() {
        return this.attentionItems.length < this.attentionTotal;
    }

    handleMoreAttention() {
        this.attentionLimit += PAGE_STEP;
    }

    get tasks() {
        return (this.summary?.tasks ?? []).map((t) => ({
            ...t,
            badgeClass: KIND_CLASS[t.kind] ?? 'home__badge',
            kindLabel: KIND_LABEL[t.kind] ?? '할 일',
            due: this.formatDate(t.activityDate),
            title: (t.subject ?? '').replace(/^\[[^\]]+\]\s*/, '')
        }));
    }

    get hasTasks() {
        return this.tasks.length > 0;
    }

    get taskCountText() {
        return `${this.summary?.kpis?.openMailTasks ?? 0}개 중 ${this.tasks.length}개 표시`;
    }

    get hasMoreTasks() {
        return this.tasks.length < (this.summary?.kpis?.openMailTasks ?? 0);
    }

    handleMoreTasks() {
        this.taskLimit += PAGE_STEP;
    }

    // ---------- 공통 ----------
    formatDate(value) {
        if (!value) {
            return '-';
        }
        const [y, m, d] = value.split('-').map(Number);
        return `${y}. ${m}. ${d}.`;
    }

    async handleRefresh() {
        this.isRefreshing = true;
        try {
            await Promise.all([refreshApex(this.summaryResult), refreshApex(this.projectResult)]);
        } finally {
            this.isRefreshing = false;
        }
    }

    handleNewProject() {
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: { objectApiName: 'EPD_Certification_Project__c', actionName: 'new' }
        });
    }

    handleOpenList(event) {
        const page = LIST_PAGES[event.currentTarget.dataset.target];
        if (!page) {
            return;
        }
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: { objectApiName: page.objectApiName, actionName: 'list' },
            state: { filterName: page.filterName }
        });
    }

    handleOpenRecord(event) {
        event.preventDefault();
        const recordId = event.currentTarget.dataset.id;
        if (!recordId) {
            return;
        }
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: { recordId, actionName: 'view' }
        });
    }

    disconnectedCallback() {
        clearTimeout(this.searchTimer);
    }
}
