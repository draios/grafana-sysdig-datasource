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

export class SysdigDatasource {
    constructor(instanceSettings, $q, backendSrv, templateSrv) {
        this.name = instanceSettings.name;
        this.q = $q;
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
        return ApiService.send(this.getBackendConfiguration(), {
            url: 'api/login'
        }).then((response) => {
            if (response.status === 200) {
                return { status: 'success', message: 'Data source is working', title: 'Success' };
            }
        });
    }

    query(options) {
        const query = this.buildQueryParameters(options);
        query.targets = query.targets.filter((t) => !t.hide);

        if (query.targets.length <= 0) {
            return this.q.when({ data: [] });
        }

        return DataService.fetch(
            this.getBackendConfiguration(),
            query,
            convertRangeToUserTime(options.range, query.intervalMs)
        );
    }

    buildQueryParameters(options) {
        //remove placeholder targets
        options.targets = _.filter(options.targets, (target) => {
            return target.target !== 'select metric';
        });

        const targets = _.map(options.targets, (target) => {
            if (target.target === undefined) {
                // here's the query control panel sending the first request with empty configuration
                return Object.assign({}, target, {
                    target: 'net.bytes.total',
                    timeAggregation: 'timeAvg',
                    groupAggregation: 'avg',
                    filter: undefined,
                    pageLimit: 10
                });
            } else {
                return Object.assign({}, target, {
                    target: this.templateSrv.replace(target.target, options.scopedVars),
                    filter: this.templateSrv.replace(
                        target.filter,
                        options.scopedVars,
                        this.formatTemplateValue
                    ),
                    pageLimit: Number.parseInt(target.pageLimit) || 10
                });
            }
        });

        options.targets = targets;

        return options;
    }

    formatTemplateValue(value) {
        if (typeof value === 'string') {
            //
            // single selection
            //
            return format(value);
        } else {
            //
            // "all"
            //
            return value.map(format).join(', ');
        }

        function format(value) {
            const parsed = parseLabelValue(value);

            // encapsulate value within double-quotes to make the output valid with both strings and null values
            // also, null values must be returned as "null" strings
            return parsed ? `"${parsed}"` : `${parsed}`;
        }
    }

    metricFindQuery(query, options) {
        if (query) {
            return MetricsService.queryMetrics(
                this.getBackendConfiguration(),
                this.templateSrv,
                query,
                { userTime: convertRangeToUserTime(options.range) }
            ).then((result) =>
                result
                    // NOTE: The backend doesn't support multi-value scope expressions with null (see https://sysdig.atlassian.net/browse/SMBACK-1745)
                    .filter((v) => v !== null)
                    .sort(this.getLabelValuesSorter(options.variable.sort))
                    .map((labelValue) => ({
                        text: formatLabelValue(labelValue)
                    }))
            );
        } else {
            return MetricsService.findMetrics(this.getBackendConfiguration());
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

    findSegmentBy(target) {
        if (target === undefined || target === 'select metric') {
            return MetricsService.findSegmentations(this.getBackendConfiguration(), null);
        } else {
            return MetricsService.findSegmentations(
                this.getBackendConfiguration(),
                this.templateSrv.replace(target)
            );
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
        return this.q.when([]);
    }

    doRequest(options) {
        return ApiService.send(this.getBackendConfiguration(), options);
    }
}

function convertRangeToUserTime(range, intervalMs) {
    if (range) {
        const userTime = {
            from: Math.trunc(range.from.valueOf() / 1000),
            to: Math.trunc(range.to.valueOf() / 1000)
        };

        if (intervalMs) {
            userTime.sampling = Math.trunc(intervalMs / 1000);
        }

        return userTime;
    } else {
        return null;
    }
}

function formatLabelValue(labelValue) {
    return labelValue || 'n/a';
}

function parseLabelValue(labelValue) {
    return labelValue === 'n/a' ? null : labelValue;
}
