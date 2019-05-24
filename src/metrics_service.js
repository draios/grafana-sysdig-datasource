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
import _ from 'lodash';
import ApiService from './api_service';
import TimeService from './time_service';
import TemplatingService from './templating_service';
import Cache from './cache';

export default class MetricsService {
    static findMetrics(backend, options) {
        const normOptions = Object.assign(
            {
                areLabelsIncluded: false,
                match: null,
                plottableMetricTypes: ['%', 'byte', 'int', 'double', 'number', 'relativeTime']
            },
            options
        );

        if (normOptions.match && normOptions.match.trim() === '') {
            normOptions.match = null;
        }

        return getMetricsCache(backend).values.get(normOptions, async () => {
            const response = await ApiService.fetchMetricsDescriptors(backend, normOptions);

            return response
                .map((metric) =>
                    _.assign(metric, {
                        isNumeric: normOptions.plottableMetricTypes.indexOf(metric.type) >= 0
                    })
                )
                .sort((a, b) => a.id.localeCompare(b.id));
        });
    }

    static findSegmentations(backend, options) {
        const normOptions = Object.assign({ metric: false, match: null }, options);

        if (normOptions.match && normOptions.match.trim() === '') {
            normOptions.match = null;
        }

        return getMetricsCache(backend).labels.get(normOptions, async () => {
            const result = await ApiService.fetchLabelDescriptors(backend, normOptions);

            return result.sort((a, b) => a.id.localeCompare(b.id));
        });
    }

    static findSegmentValues(backend, filter, queryOptions, userTime) {
        let evaluateUserTime;
        if (userTime === null) {
            evaluateUserTime = TimeService.queryTimelines(backend).then(({ timelines }) => {
                if (timelines.agents.filter((t) => t.from !== null && t.to !== null).length > 0) {
                    return {
                        from: (timelines.agents[0].to - timelines.agents[0].sampling) / 1000000,
                        to: timelines.agents[0].to / 1000000,
                        sampling: timelines.agents[0].sampling / 1000000
                    };
                } else {
                    return backend.backendSrv.$q.reject(
                        'Unable to query metrics (data not available)'
                    );
                }
            });
        } else {
            evaluateUserTime = backend.backendSrv.$q.resolve(userTime);
        }

        return evaluateUserTime
            .then((userTime) => TimeService.validateTimeWindow(backend, userTime))
            .then((requestTime) => {
                return ApiService.send(backend, {
                    method: 'POST',
                    url: 'api/data/entity/metadata',
                    data: {
                        time: {
                            from: requestTime.from * 1000000,
                            to: requestTime.to * 1000000
                        },
                        metrics: [queryOptions.labelName],
                        filter,
                        paging: { from: queryOptions.from, to: queryOptions.to }
                    }
                });
            });
    }

    static queryMetrics(backend, templateSrv, query, options) {
        let queryOptions;
        if ((queryOptions = TemplatingService.validateLabelValuesQuery(query)) !== null) {
            //
            // return list of label values
            //
            return this.findSegmentValues(
                backend,
                TemplatingService.resolveQueryVariables(queryOptions.filter, templateSrv),
                queryOptions,
                options.userTime
            ).then((result) => result.data.data.map((d) => d[queryOptions.labelName]));
        } else if ((queryOptions = TemplatingService.validateLabelNamesQuery(query)) !== null) {
            //
            // return list of label names
            //
            return this.findSegmentations(backend, { match: queryOptions.pattern }).then((result) =>
                result.map((metric) => metric.id)
            );
        } else if ((queryOptions = TemplatingService.validateMetricsQuery(query)) !== null) {
            //
            // return list of metric names
            //
            return this.findMetrics(backend, { match: queryOptions.pattern }).then((result) =>
                result.map((metric) => metric.id)
            );
        } else {
            return backend.backendSrv.$q.when([]);
        }
    }

    static reset() {
        resetMetricsCache();
    }
}

class MetricsCache extends Cache {
    constructor($q) {
        super($q, 10, 60000);
    }

    getItemId(id) {
        return Object.keys(id)
            .map((k) => id[k])
            .join(',');
    }
}

let metricsCaches;

function getMetricsCache(backend) {
    if (metricsCaches === undefined) {
        metricsCaches = {};
    }

    if (metricsCaches[backend.url] === undefined) {
        metricsCaches[backend.url] = {
            values: new MetricsCache(backend.backendSrv.$q),
            labels: new MetricsCache(backend.backendSrv.$q)
        };
    }

    return metricsCaches[backend.url];
}

function resetMetricsCache() {
    metricsCaches = undefined;
}
