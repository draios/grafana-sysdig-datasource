import _ from 'lodash';
import DataService from './data_service';
import ApiService from './api_service';

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

        this.metricsCache = {
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

        const userTime = {
            from: Math.trunc(options.range.from.valueOf() / 1000),
            to: Math.trunc(options.range.to.valueOf() / 1000),
            sampling: Math.trunc(query.intervalMs / 1000)
        };

        return DataService.fetch(this.getBackendConfiguration(), query, userTime);
    }

    buildQueryParameters(options) {
        //remove placeholder targets
        options.targets = _.filter(options.targets, (target) => {
            return target.target !== 'select metric';
        });

        const targets = _.map(options.targets, (target) => {
            return Object.assign({}, target, {
                target: this.templateSrv.replace(target.target, options.scopedVars, 'regex'),
                filter: this.templateSrv.replace(target.filter, options.scopedVars, 'regex'),
                pageLimit: Number.parseInt(target.pageLimit) || 10
            });
        });

        options.targets = targets;

        return options;
    }

    metricFindQuery() {
        if (this.metricsCache.isValid()) {
            return this.q.when(this.metricsCache.data);
        } else if (this.metricsCache.isLoading()) {
            return this.metricsCache.promise;
        } else {
            return this.metricsCache.load(
                ApiService.send(this.getBackendConfiguration(), {
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
                        this.metricsCache.setData(data);

                        return data;
                    })
            );
        }
    }

    findSegmentBy(target) {
        if (target === 'select metric') {
            return this.q.when([]);
        } else {
            return ApiService.send(this.getBackendConfiguration(), {
                url: `api/data/metrics/${target}/segmentationMetrics`
            }).then((result) => {
                return result.data.segmentationMetrics.sort((a, b) => a.localeCompare(b));
            });
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
