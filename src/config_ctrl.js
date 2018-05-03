import { SysdigDashboardImporter } from './sysdig-dashboard-importer';

const CLOUD_URL = 'https://app.sysdigcloud.com';

export class SysdigConfigCtrl {
    /** @ngInject */
    constructor($q, backendSrv) {
        this.planOptions = [
            { id: 'cloud', text: 'Basic/Pro Cloud' },
            { id: 'onprem', text: 'Pro Software' }
        ];

        this.dashboards = [
            { id: 'PRIVATE', title: 'My dashboards', importStatus: 'none' },
            { id: 'SHARED', title: 'Shared dashboards', importStatus: 'none' }
        ];

        this.current.url = this.current.url || CLOUD_URL;
        this.isOnprem = this.current.url !== CLOUD_URL;
        this.plan = this.isOnprem ? this.planOptions[1] : this.planOptions[0];

        this.q = $q;
        this.backendSrv = backendSrv;
    }

    handlePlanChange() {
        this.isOnprem = this.plan.id === 'onprem';

        if (this.isOnprem && this.current.url === CLOUD_URL) {
            this.current.url = 'https://your-sysdig.local';
        }
    }

    isDashboardsImportDisabled() {
        return this.current.id === undefined;
    }

    importDashboards(id) {
        this.testing = null;

        const dashboardSet = this.dashboards.filter((set) => set.id === id)[0];
        dashboardSet.importStatus = 'executing';

        const options = {
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
            .datasourceRequest(options)
            .then(({ data }) => {
                const convertedDashboards = data.dashboards
                    .filter((sysdigDashboard) => {
                        switch (id) {
                            case 'PRIVATE':
                                return sysdigDashboard.isShared === false;
                            case 'SHARED':
                                return sysdigDashboard.isShared === true;
                        }
                    })
                    .map((sysdigDashbaord) => {
                        return SysdigDashboardImporter.convertToGrafana(
                            sysdigDashbaord,
                            this.current.name
                        );
                    });

                const options = {
                    overwrite: true
                };

                return saveDashboards.call(this, convertedDashboards, options);
            })
            .then(() => {
                console.info('Sysdig dashboards import: Completed');
                dashboardSet.importStatus = 'success';
            })
            .catch((error) => {
                dashboardSet.importStatus = 'error';
                dashboardSet.importMessage = error;
            });

        function saveDashboards(dashboards, options) {
            if (dashboards.length > 0) {
                const dashboard = dashboards[0];
                return this.backendSrv.saveDashboard(dashboard, options).then(() => {
                    console.log(`Sysdig dashboards import: Imported '${dashboard.title}'`);

                    return saveDashboards.call(this, dashboards.slice(1), options);
                });
            } else {
                return this.q.when({});
            }
        }
    }
}

SysdigConfigCtrl.templateUrl = 'partials/config.html';
