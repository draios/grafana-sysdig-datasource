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
    static async importFromSysdig(backend, datasourceName, dashboardSetId) {
        console.info('Sysdig dashboards import: Starting...');

        if (dashboardSetId === 'DEFAULT') {
            const tags = ['Sysdig', 'Default dashboard'];
            const fetchResults = await Promise.all([
                ApiService.fetchDefaultDashboards(backend),
                ApiService.send(backend, {
                    url: 'data/drilldownViewsCategories.json'
                })
            ]);

            const applicableDashboards = fetchResults[0].defaultDashboards;

            const usedCategories = fetchResults[1].data.drilldownViewsCategories.filter(
                (category) => {
                    return (
                        applicableDashboards.find(
                            (dashboard) => dashboard.category === category.id
                        ) !== undefined
                    );
                }
            );

            const categories = usedCategories;
            const defaultDashboards = applicableDashboards;
            const version = fetchResults[0].version;

            const convertedDashboards = defaultDashboards
                .map(convertDashboard.bind(null, datasourceName, version, categories, tags))
                .filter((dashboard) => dashboard !== null);

            const options = {
                overwrite: true
            };

            try {
                const result = await saveDashboards(
                    backend.backendSrv,
                    convertedDashboards,
                    options
                );

                console.info('Sysdig dashboards import: Completed');

                return result;
            } catch (error) {
                console.info('Sysdig dashboards import: Failed', error);

                throw error;
            }
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

            const fetchResult = await ApiService.fetchDashboards(backend);

            const convertedDashboards = fetchResult.dashboards
                .filter(
                    SysdigDashboardHelper.filterDashboardBySetId.bind(
                        null,
                        fetchResult.version,
                        dashboardSetId
                    )
                )
                .map(convertDashboard.bind(null, datasourceName, fetchResult.version, [], tags))
                .filter((dashboard) => dashboard !== null);

            const options = {
                overwrite: true
            };

            try {
                const saveResult = await saveDashboards(
                    backend.backendSrv,
                    convertedDashboards,
                    options
                );

                console.info('Sysdig dashboards import: Completed');

                return saveResult;
            } catch (error) {
                console.info('Sysdig dashboards import: Failed', error);

                throw error;
            }
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

        async function saveDashboards(backendSrv, dashboards, options) {
            if (dashboards.length > 0) {
                const dashboard = dashboards[0];

                await backendSrv.saveDashboard(dashboard, options);

                console.log(`Sysdig dashboards import: Imported '${dashboard.title}'`);

                return saveDashboards(backendSrv, dashboards.slice(1), options);
            } else {
                return {};
            }
        }
    }

    static async delete(backendSrv) {
        return backendSrv
            .search({
                type: 'dash-db',
                tags: ['Sysdig', 'sysdig']
            })
            .then(filterSysdigDashboards)
            .then((dashboards) => {
                console.log(`Sysdig dashboards: Delete ${dashboards.length} dashboards...`);

                return removeDashboards(backendSrv, dashboards);
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

async function removeDashboards(backendSrv, dashboards) {
    if (dashboards.length > 0) {
        return removeNextDashboard(backendSrv, dashboards[0], dashboards.slice(1));
    } else {
        return;
    }
}

async function removeNextDashboard(backendSrv, dashboard, nextDashboards) {
    await backendSrv.deleteDashboard(dashboard.uid);

    try {
        await removeDashboards(backendSrv, nextDashboards);
    } catch (error) {
        console.error('Error deleting dashboard', dashboard.uid, error);
        await removeDashboards(backendSrv, nextDashboards);
    }
}
