import ApiService from './api_service';
import MetricsService from './metrics_service';
import SysdigDashboardHelper from './sysdig_dashboard_helper';

export default class DashboardsService {
    static importFromSysdig(backend, datasourceName, dashboardSetId) {
        console.info('Sysdig dashboards import: Starting...');

        return backend.backendSrv.$q
            .all([
                ApiService.send(backend, {
                    url: 'ui/dashboards'
                }),
                MetricsService.findMetrics(backend)
            ])
            .then((results) => {
                const metrics = results[1];
                const convertedDashboards = results[0].data.dashboards
                    .filter(filterDashboardBySetId.bind(null, dashboardSetId))
                    .map(convertDashboard.bind(null, datasourceName, metrics));

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

        function convertDashboard(datasourceName, metrics, dashboard) {
            return SysdigDashboardHelper.convertToGrafana(dashboard, { datasourceName, metrics });
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
