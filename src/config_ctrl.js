import DashboardsService from './dashboards_service';
import './css/config-editor.css!';

const CLOUD_URL = 'https://app.sysdigcloud.com';
const DEFAULT_ONPREM_URL = 'https://your-sysdig.local';

export class SysdigConfigCtrl {
    /** @ngInject */
    constructor($q, backendSrv) {
        this.planOptions = [
            { id: 'cloud', text: 'Basic/Pro Cloud' },
            { id: 'onprem', text: 'Pro Software' }
        ];

        this.dashboardSets = [
            { id: 'PRIVATE', title: 'My dashboards', importStatus: 'none', importMessage: null },
            { id: 'SHARED', title: 'Shared dashboards', importStatus: 'none', importMessage: null }
        ];

        this.current.access = 'proxy';
        this.current.url =
            this.current.url && /^\s*$/.test(this.current.url) ? this.current.url : CLOUD_URL;
        this.isOnprem = this.current.url !== CLOUD_URL;
        this.plan = this.isOnprem ? this.planOptions[1] : this.planOptions[0];

        this.q = $q;
        this.backendSrv = backendSrv;
    }

    getBackendConfiguration() {
        return {
            backendSrv: this.backendSrv,
            withCredentials: this.current.withCredentials,
            headers: {
                'Content-Type': 'application/json',
                'X-Sysdig-Product': 'SDC',
                Authorization: `Bearer ${this.current.jsonData.apiToken}`
            },
            apiToken: this.current.jsonData.apiToken,
            url: `/api/datasources/proxy/${this.current.id}`
        };
    }

    changePlan() {
        this.isOnprem = this.plan.id === 'onprem';

        if (this.isOnprem && this.current.url === CLOUD_URL) {
            this.current.url = DEFAULT_ONPREM_URL;
        }
    }

    isDashboardsImportDisabled() {
        return this.current.id === undefined;
    }

    importDashboards(dashboardSetId) {
        this.testing = null;

        const dashboardSet = this.dashboardSets.filter((set) => set.id === dashboardSetId)[0];
        dashboardSet.importStatus = 'executing';
        dashboardSet.importMessage = null;

        DashboardsService.importFromSysdig(
            this.getBackendConfiguration(),
            this.current.name,
            dashboardSetId
        )
            .then(() => {
                dashboardSet.importStatus = 'success';
            })
            .catch((error) => {
                dashboardSet.importStatus = 'error';
                dashboardSet.importMessage = error;
            });
    }
}

SysdigConfigCtrl.templateUrl = 'partials/config.html';
