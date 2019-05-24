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
import SysdigDashboardHelper from './sysdig_dashboard_helper';

export default class DashboardsService {
    static importFromSysdig(backend, datasourceName, dashboardSetId) {
        console.info('Sysdig dashboards import: Starting...');

        if (dashboardSetId === 'DEFAULT') {
            const tags = ['Sysdig', 'Default dashboard'];
            return backend.backendSrv.$q
                .all([
                    ApiService.fetchDefaultDashboards(backend),
                    ApiService.send(backend, {
                        url: 'data/drilldownViewsCategories.json'
                    })
                ])
                .then((results) => {
                    const applicableDashboards = results[0].defaultDashboards;

                    const usedCategories = results[1].data.drilldownViewsCategories.filter(
                        (category) => {
                            return (
                                applicableDashboards.find(
                                    (dashboard) => dashboard.category === category.id
                                ) !== undefined
                            );
                        }
                    );

                    return {
                        categories: usedCategories,
                        defaultDashboards: applicableDashboards,
                        version: results[0].version
                    };
                })
                .then((results) => {
                    const convertedDashboards = results.defaultDashboards
                        .map(
                            convertDashboard.bind(
                                null,
                                datasourceName,
                                results.version,
                                results.categories,
                                tags
                            )
                        )
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
        } else {
            let tags;
            switch (dashboardSetId) {
                case 'PRIVATE':
                    tags = ['Sysdig', 'Private dashboard'];
                    break;
                case 'SHARED':
                    tags = ['Sysdig', 'Shared dashboard'];
                    break;
                default:
                    throw {
                        name: 'Invalid argument',
                        message: `Invalid dashboard set ID ('${dashboardSetId}')`
                    };
            }

            return backend.backendSrv.$q
                .when(ApiService.fetchDashboards(backend))
                .then((result) => {
                    const convertedDashboards = result.dashboards
                        .filter(
                            SysdigDashboardHelper.filterDashboardBySetId.bind(
                                null,
                                result.version,
                                dashboardSetId
                            )
                        )
                        .map(convertDashboard.bind(null, datasourceName, result.version, [], tags))
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
        }

        function convertDashboard(datasourceName, version, categories, tags, dashboard) {
            try {
                return SysdigDashboardHelper.convertToGrafana(version, dashboard, {
                    datasourceName,
                    categories,
                    tags
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

    static delete(backendSrv) {
        backendSrv
            .search({
                type: 'dash-db',
                tags: ['Sysdig', 'sysdig']
            })
            .then(filterSysdigDashboards)
            .then((dashboards) => {
                console.log(`Sysdig dashboards: Delete ${dashboards.length} dashboards...`);

                removeDashboards(backendSrv, dashboards);
            });

        function filterSysdigDashboards(dashboards) {
            // NOTE: Up to Grafana v6.1, search over 2 tags doesn't work, the list will include dashboards without tags as well
            // Current workaround is to filter based on tags returned by each dashboard configuration
            return dashboards.filter(
                (dashboard) =>
                    dashboard.tags &&
                    (dashboard.tags.indexOf('sysdig') >= 0 || dashboard.tags.indexOf('Sysdig') >= 0)
            );
        }
    }
}

function removeDashboards(backendSrv, dashboards) {
    if (dashboards.length > 0) {
        return removeNextDashboard(backendSrv, dashboards[0], dashboards.slice(1));
    } else {
        return backendSrv.$q.resolve();
    }
}

function removeNextDashboard(backendSrv, dashboard, nextDashboards) {
    return backendSrv
        .deleteDashboard(dashboard.uid)
        .then(() => removeDashboards(backendSrv, nextDashboards))
        .catch((error) => {
            console.error('Error deleting dashboard', dashboard.uid, error);
            removeDashboards(backendSrv, nextDashboards);
        });
}
