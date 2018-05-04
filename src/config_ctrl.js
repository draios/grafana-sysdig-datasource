import { SysdigDashboardImporter } from './sysdig-dashboard-importer';

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

        const datasourceOptions = {
            url: `/api/datasources/proxy/${this.current.id}/ui/dashboards`,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Sysdig-Product': 'SDC',
                Authorization: `Bearer ${this.current.jsonData.apiToken}`
            }
        };

        console.info('Sysdig dashboards import: Starting...');

        this.backendSrv
            .datasourceRequest(datasourceOptions)
            .then(({ data }) => {
                const convertedDashboards = data.dashboards
                    .filter(filterDashboardBySetId.bind(dashboardSetId))
                    .map(convertDashboard.bind(this.current.name));

                const options = {
                    overwrite: true
                };

                return saveDashboards(this.backendSrv, convertedDashboards, options);
            })
            .then(() => {
                console.info('Sysdig dashboards import: Completed');
                dashboardSet.importStatus = 'success';
            })
            .catch((error) => {
                console.info('Sysdig dashboards import: Failed', error);
                dashboardSet.importStatus = 'error';
                dashboardSet.importMessage = error;
            });

        function filterDashboardBySetId(setId, dashboard) {
            switch (dashboardSetId) {
                case 'PRIVATE':
                    return dashboard.isShared === false;
                case 'SHARED':
                    return dashboard.isShared === true;
            }
        }

        function convertDashboard(datasourceName, dashboard) {
            return SysdigDashboardImporter.convertToGrafana(dashboard, datasourceName);
        }

        function saveDashboards(backendSrv, dashboards, options) {
            if (dashboards.length > 0) {
                const dashboard = dashboards[0];
                return backendSrv.saveDashboard(dashboard, options).then(() => {
                    console.log(`Sysdig dashboards import: Imported '${dashboard.title}'`);

                    return saveDashboards(backendSrv, dashboards.slice(1), options);
                });
            } else {
                return backendSrv.$q.when({});
            }
        }
    }
}

SysdigConfigCtrl.templateUrl = 'partials/config.html';
