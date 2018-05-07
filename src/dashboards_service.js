import ApiService from './api_service';
import SysdigDashboardHelper from './sysdig_dashboard_helper';

export default class DashboardsService {
    static importFromSysdig(backend, datasourceName, dashboardSetId) {
        console.info('Sysdig dashboards import: Starting...');

        return ApiService.send(backend, {
            url: 'ui/dashboards'
        })
            .then(({ data }) => {
                const convertedDashboards = data.dashboards
                    .filter(filterDashboardBySetId.bind(null, dashboardSetId))
                    .map(convertDashboard.bind(null, datasourceName));

                const options = {
                    overwrite: true
                };

                return saveDashboards(backend.backendSrv, convertedDashboards, options);
            })
            .then((result) => {
                console.info('Sysdig dashboards import: Completed');

                return result;
            })
            .catch((error) => {
                console.info('Sysdig dashboards import: Failed', error);

                return backend.backendSrv.$q.reject(error);
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
            return SysdigDashboardHelper.convertToGrafana(dashboard, datasourceName);
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
