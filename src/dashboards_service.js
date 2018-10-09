//
//  Copyright 2018 Draios Inc.
//
//  Licensed under the Apache License, Version 2.0 (the "License");
//  you may not use this file except in compliance with the License.
//  You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing, software
//  distributed under the License is distributed on an "AS IS" BASIS,
//  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  See the License for the specific language governing permissions and
//  limitations under the License.
//
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
                    .map(convertDashboard.bind(null, datasourceName, metrics))
                    .filter((dashboard) => dashboard !== null);

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
            try {
                return SysdigDashboardHelper.convertToGrafana(dashboard, {
                    datasourceName,
                    metrics
                });
            } catch (error) {
                console.error(
                    'An error occurred during the dashboard conversion',
                    error,
                    arguments
                );
                return null;
            }
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
