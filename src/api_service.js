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
export default class ApiService {
    static send(backend, options) {
        const headers = {
            'Content-Type': 'application/json',
            'X-Sysdig-Product': 'SDC',
            Authorization: `Bearer ${backend.apiToken}`
        };

        return backend.backendSrv.datasourceRequest(
            Object.assign({}, options, {
                headers,
                url: `${backend.url}/${options.url}`,
                method: options.method || 'GET'
            })
        );
    }

    static async fetchDefaultDashboards(backend) {
        try {
            //
            // Try latest version
            //
            const result = await this.send(backend, {
                url: 'api/v2/defaultDashboards?excludeMissing=true'
            });

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
                throw {
                    status: 404
                };
            }
        } catch (ex) {
            //
            // Check that latest version is not supported
            //
            if (ex.status === 404) {
                //
                // Try previous version
                // (supported from v1245 released on 5/11/2018)
                //
                const result = await this.send(backend, {
                    url: 'api/defaultDashboards?excludeMissing=true'
                });

                return {
                    defaultDashboards: result.data.defaultDashboards,
                    version: 'v1'
                };
            }
        }
    }

    static async fetchDashboards(backend) {
        try {
            //
            // Try latest version
            //
            const result = await ApiService.send(backend, {
                url: 'api/v2/dashboards'
            });

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
                throw {
                    status: 404
                };
            }
        } catch (ex) {
            //
            // Check that latest version is not supported
            //
            if (ex.status === 404) {
                //
                // Try previous version
                // (supported from v1245 released on 5/11/2018)
                //
                const result = await ApiService.send(backend, {
                    url: 'ui/dashboards'
                });

                return {
                    dashboards: result.data.dashboards,
                    version: 'v1'
                };
            }
        }
    }

    static async fetchMetricsDescriptors(backend, options) {
        const metricTypes = options.areLabelsIncluded ? [] : ['counter', 'gauge', 'histogram'];

        try {
            //
            // Try latest version
            //
            const typesFilter = options.areLabelsIncluded ? [] : options.plottableMetricTypes;

            const response = await ApiService.send(backend, {
                url: `api/v2/metrics/descriptors?offset=0&limit=100&filter=${options.match ||
                    ''}&types=${encodeURIComponent(
                    typesFilter.join(',')
                )}&metricTypes=${encodeURIComponent(metricTypes.join(','))}`
            });

            return response.data.metricDescriptors;
        } catch (ex) {
            //
            // Check that latest version is not supported
            //
            if (ex.status === 500) {
                //
                // Try previous version
                //
                const response = await ApiService.send(backend, {
                    url: 'api/data/metrics?light=true'
                });

                return Object.values(response.data).map((d) =>
                    Object.assign({}, d, {
                        timeAggregations: d.aggregations,
                        groupAggregations: getGroupAggregations(d, metricTypes)
                    })
                );
            } else {
                throw ex;
            }
        }
    }

    static async fetchLabelDescriptors(backend, options) {
        try {
            //
            // Try latest version
            //
            const result = await this.send(backend, {
                url: `api/v2/labels/descriptors?offset=0&limit=100&filter=${options.match ||
                    ''}&pids=${options.metric || ''}&scope=`
            });

            return result.data.labelDescriptors;
        } catch (ex) {
            //
            // Check that latest version is not supported
            //
            if (ex.status === 404) {
                //
                // Try previous version
                //
                if (options.metric) {
                    try {
                        const result = await this.send(backend, {
                            url: `api/data/metrics/${options.metric}/segmentationMetrics`
                        });

                        if (result.data.segmentationMetrics) {
                            return result.data.segmentationMetrics.map((d) => ({ id: d }));
                        } else {
                            return [];
                        }
                    } catch (ex) {
                        //
                        // Previous versions no longer supported
                        //
                    }
                } else {
                    return [];
                }
            } else {
                throw ex;
            }
        }
    }
}

function getGroupAggregations(metric, metricTypes) {
    if (metric.groupAggregations && metric.groupAggregations.length > 0) {
        return metric.groupAggregations;
    } else if (metricTypes.indexOf(metric.metricType) >= 0) {
        return ['avg', 'sum', 'min', 'max'];
    } else {
        return [];
    }
}
