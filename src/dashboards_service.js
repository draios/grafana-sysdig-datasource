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

        if (dashboardSetId === 'DEFAULT') {
            const tags = ['Sysdig', 'Default dashboard'];
            return backend.backendSrv.$q
                .all([
                    fetchDefaultDashboards(backend),
                    MetricsService.findMetrics(backend),
                    ApiService.send(backend, {
                        url: 'data/drilldownViewsCategories.json'
                    })
                ])
                .then((results) => {
                    const metrics = results[1];
                    const categories = results[2];

                    const applicableDashboards = results[0].defaultDashboards;

                    const usedCategories = categories.data.drilldownViewsCategories.filter(
                        (category) => {
                            return (
                                applicableDashboards.find(
                                    (dashboard) => dashboard.category === category.id
                                ) !== undefined
                            );
                        }
                    );

                    return {
                        metrics,
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
                                results.metrics,
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
                .all([fetchDashboards(backend), MetricsService.findMetrics(backend)])
                .then((results) => {
                    const metrics = results[1];
                    const convertedDashboards = results[0].dashboards
                        .filter(
                            SysdigDashboardHelper.filterDashboardBySetId.bind(
                                null,
                                results[0].version,
                                dashboardSetId
                            )
                        )
                        .map(
                            convertDashboard.bind(
                                null,
                                datasourceName,
                                results[0].version,
                                metrics,
                                [],
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
        }

        function convertDashboard(datasourceName, version, metrics, categories, tags, dashboard) {
            try {
                return SysdigDashboardHelper.convertToGrafana(version, dashboard, {
                    datasourceName,
                    metrics,
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
            .then((dashboards) => {
                console.log(`Sysdig dashboards: Delete ${dashboards.length} dashboards...`);
                removeDashboards(backendSrv, dashboards);
            });
    }
}

function fetchDefaultDashboards(backend) {
    return (
        // First try latest endpoint version
        ApiService.send(backend, {
            url: 'api/v2/defaultDashboards?excludeMissing=true'
        })
            // Return v2 dashboards
            .then((result) => {
                if (result.data.defaultDashboards) {
                    return {
                        defaultDashboards: result.data.defaultDashboards,
                        version: 'v2'
                    };
                } else {
                    //
                    // dev version of v2 detected, fallback to v1
                    // (api/v2/defaultDashboards returns an array and not and object with defaultDashboards array)
                    // NOTE: This is useful until onprem version X and SaaS version Y need to be supported
                    //
                    return backend.backendSrv.$q.reject('Dashboards API v2 not available');
                }
            })
            .catch(() => {
                return (
                    // Then try older endpoint version
                    ApiService.send(backend, {
                        url: 'api/defaultDashboards?excludeMissing=true'
                    })
                        // Return v1 dashboards
                        .then((result) => {
                            return {
                                defaultDashboards: result.data.defaultDashboards,
                                version: 'v1'
                            };
                        })
                );
            })
    );
}

function fetchDashboards(backend) {
    return (
        // First try latest endpoint version
        ApiService.send(backend, {
            url: 'api/v2/dashboards'
        })
            // Return v2 dashboards
            .then((result) => {
                if (Array.isArray(result.data.dashboards) && result.data.dashboards.length > 0) {
                    return {
                        dashboards: result.data.dashboards,
                        version: 'v2'
                    };
                } else {
                    //
                    // probable dev version of v2 detected, fallback to v1
                    // (api/v2/dashboards was not documented or used, it's supposed to be empty -- NOTE: could lead to false positive in case there are no dashboards to import)
                    // NOTE: This is useful until onprem version X and SaaS version Y need to be supported
                    //
                    return backend.backendSrv.$q.reject('Dashboards API v2 not available');
                }
            })
            .catch(() => {
                return (
                    // Then try older endpoint version
                    ApiService.send(backend, {
                        url: 'ui/dashboards'
                    })
                        // Return v1 dashboards
                        .then((result) => {
                            return {
                                dashboards: result.data.dashboards,
                                version: 'v1'
                            };
                        })
                );
            })
    );
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
