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

export default class MetricsService {
    static findMetrics(backend) {
        if (metricsCache.isValid()) {
            return backend.backendSrv.$q.when(metricsCache.data);
        } else if (metricsCache.isLoading()) {
            return metricsCache.promise;
        } else {
            return metricsCache.load(
                ApiService.send(backend, {
                    url: 'api/data/metrics?light=true'
                })
                    .then((result) => {
                        const plottableMetricTypes = [
                            '%',
                            'byte',
                            'date',
                            'int',
                            'number',
                            'relativeTime'
                        ];

                        return Object.values(result.data)
                            .map((m) =>
                                _.assign(m, {
                                    isNumeric: plottableMetricTypes.indexOf(m.type) >= 0
                                })
                            )
                            .filter((m) => {
                                return m.isNumeric;
                            })
                            .sort((a, b) => a.id.localeCompare(b.id));
                    })
                    .then((data) => {
                        metricsCache.setData(data);

                        return data;
                    })
            );
        }
    }

    static findSegmentations(backend, metric) {
        if (metric) {
            return ApiService.send(backend, {
                url: `api/data/metrics/${metric}/segmentationMetrics`
            }).then((result) => {
                return result.data.segmentationMetrics.sort((a, b) => a.localeCompare(b));
            });
        } else {
            return backend.backendSrv.$q.when([]);
        }
    }

    static findLabelValues(backend, templateSrv, query, options) {
        const interpolated = templateSrv.replace(query, {}, this.interpolateQueryExpr);
        const labelNameRegex = '([A-Za-z][A-Za-z0-9]*(?:[\\._\\-:][a-zA-Z0-9]+)*)';
        const labelValuesExprRegex = `label_values\\((?:${labelNameRegex})\\)`;
        const labelValuesQuery = interpolated.match(`^${labelValuesExprRegex}$`);
        if (labelValuesQuery) {
            const labelName = labelValuesQuery[1];
            return TimeService.validateTimeWindow(backend, options.userTime).then((requestTime) => {
                return ApiService.send(backend, {
                    method: 'POST',
                    url: 'api/data/entity/metadata',
                    data: {
                        time: { from: requestTime.from * 1000000, to: requestTime.to * 1000000 },
                        metrics: [labelName],
                        filter: null,
                        paging: { from: 0, to: 99 }
                    }
                }).then((result) => result.data.data.map((d) => d[labelName]));
            });
        } else {
            return backend.backendSrv.$q.when([]);
        }
        // var metricFindQuery = new PrometheusMetricFindQuery(this, interpolated, this.timeSrv);
        // return metricFindQuery.process();
    }

    interpolateQueryExpr(value, variable) {
        // if no multi or include all do not regexEscape
        if (!variable.multi && !variable.includeAll) {
            return prometheusRegularEscape(value);
        }

        if (typeof value === 'string') {
            return prometheusSpecialRegexEscape(value);
        }

        var escapedValues = _.map(value, prometheusSpecialRegexEscape);
        return escapedValues.join('|');
    }
}

function prometheusSpecialRegexEscape(value) {
    return prometheusRegularEscape(
        value.replace(/\\/g, '\\\\\\\\').replace(/[$^*{}[]+?.()]/g, '\\\\$&')
    );
}

function prometheusRegularEscape(value) {
    return value.replace(/'/g, "\\\\'");
}

const metricsCache = {
    timestamp: null,
    data: null,
    promise: null,
    load(promise) {
        this.promise = promise;
        return promise;
    },
    setData(data) {
        this.timestamp = Date.now();
        this.data = data;
        this.promise = null;
    },
    isLoading() {
        return this.isValid() === false && this.promise !== null;
    },
    isValid() {
        return this.timestamp !== null && this.timestamp >= Date.now() - 60000;
    }
};
