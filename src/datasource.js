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
import DataService from './data_service';
import ApiService from './api_service';
import MetricsService from './metrics_service';
import TemplatingService from './templating_service';
import FormatterService from './formatter_service';

export const DEFAULT_PAGE_LIMIT = 20;

const SORT_OPTIONS = {
    asc: 'asc',
    bottom: 'asc',
    desc: 'desc',
    top: 'desc'
};

export class SysdigDatasource {
    constructor(instanceSettings, $q, backendSrv, templateSrv) {
        this.name = instanceSettings.name;
        this.$q = $q;
        this.backendSrv = backendSrv;
        this.templateSrv = templateSrv;
        this.url = instanceSettings.url;
        this.access = 'proxy';

        this.apiToken = instanceSettings.jsonData ? instanceSettings.jsonData.apiToken : '';
        this.headers = {
            'Content-Type': 'application/json',
            'X-Sysdig-Product': 'SDC',
            Authorization: `Bearer ${this.apiToken}`
        };
    }

    getBackendConfiguration() {
        return {
            backendSrv: this.backendSrv,
            withCredentials: this.withCredentials,
            headers: this.headers,
            apiToken: this.apiToken,
            url: this.url
        };
    }

    testDatasource() {
        return this.$q
            .when(
                ApiService.send(this.getBackendConfiguration(), {
                    url: 'api/login'
                })
            )
            .then((response) => {
                if (response.status === 200) {
                    return {
                        status: 'success',
                        message: 'Data source is working',
                        title: 'Success'
                    };
                }
            });
    }

    query(options) {
        const query = this.buildQueryParameters(options);
        query.targets = query.targets.filter((t) => !t.hide);

        if (query.targets.length <= 0) {
            return this.$q.when({ data: [] });
        }

        return this.$q.when(
            DataService.fetch(
                this.getBackendConfiguration(),
                query,
                convertRangeToUserTime(options.range, query.intervalMs)
            )
        );
    }

    buildQueryParameters(options) {
        //remove placeholder targets
        options.targets = _.filter(options.targets, (target) => {
            return target.target !== 'select metric';
        });

        const targets = _.map(options.targets, (target, i, targets) => {
            if (target.target === undefined) {
                // here's the query control panel sending the first request with empty configuration
                return Object.assign({}, target, {
                    target: 'cpu.used.percent',
                    timeAggregation: 'timeAvg',
                    groupAggregation: 'avg',
                    filter: undefined,
                    pageLimit: DEFAULT_PAGE_LIMIT
                });
            } else {
                const isTabularFormat = targets[0].isTabularFormat;
                const targetOptions = {
                    segmentBy: isTabularFormat === false ? target.segmentBy : targets[0].segmentBy,
                    filter: isTabularFormat === false ? target.filter : targets[0].filter,

                    // pagination configuration is set for first target only
                    pageLimit: targets[0].pageLimit,
                    sortDirection: targets[0].sortDirection,

                    // "single data point" configuration is set for first target only
                    isSingleDataPoint: isTabularFormat || targets[0].isSingleDataPoint
                };

                if (targetOptions.segmentBy && Array.isArray(targetOptions.segmentBy) === false) {
                    // backwards compatibility: up to v0.3 one segmentation was supported only
                    targetOptions.segmentBy = [targetOptions.segmentBy];
                }

                return Object.assign({}, target, targetOptions, {
                    segmentBy: targetOptions.segmentBy
                        ? targetOptions.segmentBy.map((segmentBy) =>
                              this.resolveTemplate(segmentBy, true, options)
                          )
                        : [],
                    filter: this.resolveTemplate(targetOptions.filter, true, options),

                    pageLimit: this.resolveTemplate(
                        targetOptions.pageLimit,
                        true,
                        options,
                        (d) => Number.parseInt(d) || DEFAULT_PAGE_LIMIT
                    ),
                    sortDirection: this.resolveTemplate(
                        targetOptions.sortDirection,
                        true,
                        options,
                        (d) => SORT_OPTIONS[d.toLowerCase()] || SORT_OPTIONS['top']
                    ),

                    target: this.resolveTemplate(target.target, true, options),
                    timeAggregation: this.resolveTemplate(target.timeAggregation, true, options),
                    groupAggregation: this.resolveTemplate(target.groupAggregation, true, options),

                    alias: this.resolveTemplate(target.alias, true, options)
                });
            }
        });

        options.targets = targets;

        return options;
    }

    resolveTemplate(input, isSingleMatch, options, parser) {
        const normParser = parser || ((d) => d);

        if (typeof input === 'string') {
            const fn = isSingleMatch
                ? TemplatingService.replaceSingleMatch
                : TemplatingService.replace;

            return normParser(
                fn.call(TemplatingService, this.templateSrv, input, (options || {}).scopedVars)
            );
        } else {
            return normParser(input);
        }
    }

    metricFindQuery(query, options) {
        const normOptions = Object.assign(
            { areLabelsIncluded: false, range: null, variable: null, match: '' },
            options
        );

        if (query) {
            //
            // variable query
            //
            return this.$q
                .when(
                    MetricsService.queryMetrics(
                        this.getBackendConfiguration(),
                        this.templateSrv,
                        query,
                        { userTime: convertRangeToUserTime(normOptions.range) }
                    )
                )
                .then((result) =>
                    result
                        .sort(this.getLabelValuesSorter(normOptions.variable.sort))
                        .map((labelValue) => ({
                            text: FormatterService.formatLabelValue(labelValue)
                        }))
                );
        } else {
            //
            // panel configuration query
            //
            return (
                this.$q
                    .when(
                        MetricsService.findMetrics(this.getBackendConfiguration(), {
                            areLabelsIncluded: normOptions.areLabelsIncluded,
                            match: normOptions.match
                        })
                    )
                    // filter out all tags/labels/other string metrics
                    .then((result) => {
                        if (normOptions.areLabelsIncluded) {
                            return result;
                        } else {
                            return result.filter((metric) => metric.isNumeric);
                        }
                    })
            );
        }
    }

    findSegmentBy(metric, query) {
        if (metric) {
            return this.$q.when(
                MetricsService.findSegmentations(this.getBackendConfiguration(), {
                    metric,
                    match: this.resolveTemplate(query, true)
                })
            );
        } else {
            return this.$q.when([]);
        }
    }

    getLabelValuesSorter(mode) {
        switch (mode) {
            case 0: // disabled
            case 1: // alphabetical (asc)
                return (a, b) => {
                    if (a === null) return -1;
                    else if (b === null) return 1;
                    else return a.localeCompare(b);
                };

            case 3: // numerical (asc)
                return (a, b) => {
                    if (a === null) return -1;
                    else if (b === null) return 1;
                    else return a - b;
                };

            case 2: // alphabetical (desc)
                return (a, b) => {
                    if (a === null) return -1;
                    else if (b === null) return 1;
                    else return a.localeCompare(b);
                };

            case 4: // numerical (desc)
                return (a, b) => {
                    if (a === null) return -1;
                    else if (b === null) return 1;
                    else return a - b;
                };

            case 5: // alphabetical, case insensitive (asc)
                return (a, b) => {
                    if (a === null) return -1;
                    else if (b === null) return 1;
                    else return a.localeCompare(b);
                };

            case 6: // alphabetical, case insensitive (desc)
                return (a, b) => {
                    if (a === null) return -1;
                    else if (b === null) return 1;
                    else return a.toLowerCase().localeCompare(b.toLowerCase());
                };
        }
    }

    annotationQuery() {
        // const query = this.templateSrv.replace(options.annotation.query, {}, 'glob');
        // const annotationQuery = {
        //     range: options.range,
        //     annotation: {
        //         name: options.annotation.name,
        //         datasource: options.annotation.datasource,
        //         enable: options.annotation.enable,
        //         iconColor: options.annotation.iconColor,
        //         query: query
        //     },
        //     rangeRaw: options.rangeRaw
        // };

        // TODO Not supported yet
        return this.$q.when([]);
    }
}

function convertRangeToUserTime(range, intervalMs) {
    if (range) {
        const userTime = {
            from: Math.trunc(range.from.valueOf() / 1000),
            to: Math.trunc(range.to.valueOf() / 1000)
        };

        if (intervalMs) {
            userTime.sampling = Math.max(Math.trunc(intervalMs / 1000), 1);
        }

        return userTime;
    } else {
        return null;
    }
}
