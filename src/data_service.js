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
import FormatterService from './formatter_service';

let fetchQueue;

export default class DataService {
    static fetch(backend, query, userTime) {
        const queue = this.setupTokenRequestQueue(backend.apiToken);
        const batch = this.setupDataBatchQueue(queue, backend, userTime);

        const promise = backend.backendSrv.$q.defer();
        batch.requests.push({
            query,
            promise
        });

        //
        // Debounce fetch so that all panels' requests can be batched together
        // Note that this function will be called synchronously once per panel
        //
        const scheduleFetchFn = _.debounce(this.scheduleFetch.bind(this), 0);
        scheduleFetchFn();

        return promise.promise;
    }

    static setupDataBatchQueue(queue, backend, userTime) {
        const batchId = getBatchId(userTime);

        if (queue[batchId] === undefined) {
            queue[batchId] = {
                backend,
                userTime,
                requests: []
            };
        }

        return queue[batchId];
    }

    static scheduleFetch() {
        const queues = Object.values(fetchQueue);

        // clear queue, requests will be now processed
        fetchQueue = {};

        queues.forEach((queue) => {
            Object.values(queue).forEach((batch) => this.fetchBatch(batch));
        });
    }

    static fetchBatch(batch) {
        const q = batch.backend.backendSrv.$q;

        TimeService.validateTimeWindow(batch.backend, batch.userTime)
            .then((requestTime) => {
                //
                // get list of data requests to batch
                //
                const apiRequests = batch.requests.reduce((acc, item) => {
                    return [...acc, ...getRequests(item.query, requestTime)];
                }, []);

                //
                // break list into 20-request chunks
                //
                const maxRequestCountPerChunk = 20;
                const chunks = apiRequests.reduce((acc, request) => {
                    if (
                        acc.length === 0 ||
                        acc[acc.length - 1].length === maxRequestCountPerChunk
                    ) {
                        acc.push([request]);
                    } else {
                        acc[acc.length - 1].push(request);
                    }

                    return acc;
                }, []);

                if (requestTime) {
                    //
                    // send all batch requests
                    //
                    return q.all(
                        chunks.map((chunk) =>
                            ApiService.send(batch.backend, {
                                url: `api/data/batch`,
                                data: { requests: chunk },
                                method: 'POST'
                            })
                        )
                    );
                } else {
                    //
                    // pretend the backend returned all empty datasets
                    //
                    return chunks.map((chunk) => ({
                        data: {
                            responses: chunk.map(() => ({ data: [] }))
                        }
                    }));
                }
            })
            .then(
                (chunks) => {
                    //
                    // flatten responses
                    //
                    let responses = chunks.reduce(
                        (acc, chunk) => [...acc, ...chunk.data.responses],
                        []
                    );

                    //
                    // process and resolve each query with its response(s)
                    //
                    batch.requests.forEach((item) => {
                        const targetResponseCount = item.query.targets.length;
                        const targetResponses = responses.slice(0, targetResponseCount);

                        const parseResult = parseResponses(item.query, targetResponses);
                        const failedResults = parseResult.data.filter((d) => d.error);
                        if (
                            parseResult.data.length > 0 &&
                            failedResults.length === parseResult.data.length
                        ) {
                            const error = failedResults[0].error;
                            item.promise.reject({
                                message: `${error.reason} (${error.message})`
                            });
                        } else {
                            item.promise.resolve(parseResult);
                        }

                        responses = responses.slice(targetResponseCount);
                    });
                },
                (error) => {
                    // time window not available
                    batch.requests.forEach((request) => {
                        request.promise.reject(error);
                    });
                }
            );

        //
        // TODO
        //
        // 1. Handle 200 OK with error response
        // {
        //   "responses" : [ {
        //     "errors" : [ {
        //       "reason" : "Metric not found",
        //       "message" : "'sysdigcloud-backend.events_dropped_total' is not a Sysdig Cloud metric",
        //       "field" : "metrics",
        //       "rejectedValue" : [ {
        //         "groupAggregation" : null,
        //         "alias" : "k0",
        //         "aggregations" : {
        //           "time" : null,
        //           "group" : null
        //         },
        //         "timeAggregation" : null,
        //         "metric" : "timestamp"
        //       }, {
        //         "groupAggregation" : "concat",
        //         "alias" : "v0",
        //         "aggregations" : {
        //           "time" : "concat",
        //           "group" : "concat"
        //         },
        //         "timeAggregation" : "concat",
        //         "metric" : "sysdigcloud-backend.events_dropped_total"
        //       } ]
        //     } ]
        //   } ]
        // }
        //
        // 2. Handle error like 500 Internal Server Error
        //
    }

    static setupTokenRequestQueue(apiToken) {
        if (fetchQueue === undefined) {
            fetchQueue = {};
        }

        if (fetchQueue[apiToken] === undefined) {
            fetchQueue[apiToken] = {};
        }

        return fetchQueue[apiToken];
    }
}

function getBatchId(userTime) {
    return `${userTime.from} - ${userTime.to} - ${userTime.sampling}`;
}

function getRequests(options, requestTime) {
    return options.targets.map((target) => getRequest(target, requestTime));
}

function getRequest(target, requestTime) {
    if (requestTime) {
        return {
            format: {
                type: 'data'
            },
            time: getTime(),
            metrics: getMetrics(),
            sort: getSort(),
            paging: getPaging(),
            scope: target.filter,
            group: {
                aggregations: {
                    v0: target.timeAggregation
                },
                groupAggregations: {
                    v0: target.groupAggregation
                },
                by: getGroupBy(),
                configuration: {
                    groups: []
                }
            }
        };
    } else {
        return null;
    }

    function getTime() {
        return {
            from: requestTime.from * 1000000,
            to: requestTime.to * 1000000,
            sampling:
                (target.isSingleDataPoint
                    ? requestTime.to - requestTime.from
                    : requestTime.sampling) * 1000000
        };
    }
    function getMetrics() {
        if (target.isSingleDataPoint) {
            const metrics = {
                v0: target.target
            };

            target.segmentBy.forEach((segmentBy, i) => {
                metrics[`k${i}`] = segmentBy;
            });

            return metrics;
        } else {
            const metrics = {
                k0: 'timestamp',
                v0: target.target
            };

            target.segmentBy.forEach((segmentBy, i) => {
                metrics[`k${i + 1}`] = segmentBy;
            });

            return metrics;
        }
    }

    function getSort() {
        const sortDirection = target.sortDirection || 'desc';

        let sort;

        if (target.isTabularFormat === false) {
            sort = [{ v0: sortDirection }, { k0: sortDirection }];

            if (target.segmentBy.length > 0) {
                sort.push({ k1: sortDirection });
            }
        } else {
            // sort table by first label, let Grafana to sort the final table then
            sort = [{ k0: sortDirection }];
        }

        return sort;
    }

    function getPaging() {
        return {
            from: 0,
            to: target.pageLimit - 1
        };
    }

    function getGroupBy() {
        if (target.isSingleDataPoint) {
            const groupBy = [];

            target.segmentBy.forEach((segmentBy, i) => {
                groupBy.push({
                    metric: `k${i}`
                });
            });

            return groupBy;
        } else {
            const groupBy = [
                {
                    metric: 'k0',
                    value: requestTime.sampling * 1000000
                }
            ];

            target.segmentBy.forEach((segmentBy, i) => {
                groupBy.push({
                    metric: `k${i + 1}`
                });
            });

            return groupBy;
        }
    }
}

function parseResponses(options, response) {
    const isTabularFormat = options.targets[0].isTabularFormat;
    const isSingleTarget = options.targets.length === 1;
    const data = options.targets.map((target, i) => {
        const isSingleDataPoint = target.isSingleDataPoint;

        if (response[i].data) {
            const map = response[i].data.reduce((acc, d) => {
                const keys = response[i].group.by
                    .map((group) => group['metric'])
                    // assume timestamp is always the first one, ie. k0
                    .slice(isSingleDataPoint ? 0 : 1);

                let t;
                if (target.segmentBy.length > 0) {
                    const segmentNames = keys
                        .map((segment) => FormatterService.formatLabelValue(d[segment]))
                        .join(' - ');

                    if (isTabularFormat || isSingleTarget) {
                        t = segmentNames;
                    } else {
                        t = `${FormatterService.formatLabelValue(target.target)} (${segmentNames})`;
                    }
                } else {
                    t = FormatterService.formatLabelValue(target.target);
                }

                if (acc[t] === undefined) {
                    acc[t] = {
                        target: FormatterService.getSeriesName(d, target, isTabularFormat, keys),
                        datapoints: []
                    };
                }

                if (isTabularFormat) {
                    acc[t].datapoints.push([
                        ...keys.map((key) => d[key]),
                        d.v0,
                        response[i].time.from
                    ]);
                } else if (isSingleDataPoint) {
                    acc[t].datapoints.push([d.v0, response[i].time.from]);
                } else {
                    acc[t].datapoints.push([d.v0, d.k0 / 1000]);
                }

                return acc;
            }, {});

            if (isSingleDataPoint) {
                return Object.values(map).sort((a, b) => {
                    if (a.datapoints[0][0] === b.datapoints[0][0]) {
                        return a.target.localeCompare(b.target);
                    } else {
                        if (target.sortDirection === 'desc') {
                            return b.datapoints[0][0] - a.datapoints[0][0];
                        } else {
                            return a.datapoints[0][0] - b.datapoints[0][0];
                        }
                    }
                });
            } else {
                return Object.values(map).sort((a, b) => a.target.localeCompare(b.target));
            }
        } else {
            return {
                target: target.target,
                error: response[i].errors[0]
            };
        }
    });

    if (isTabularFormat && data.length > 0) {
        const failures = data.filter((d) => d.error);
        if (failures.length > 0) {
            return { data: failures };
        }

        const targetsDataset = data[0];
        const segments = options.targets[0].segmentBy;
        const metrics = options.targets.map((target) => target.target);

        const tabularDataset = Object.assign({}, targetsDataset, {
            type: 'table',
            columns: [
                ...segments.map((segmentBy) => ({ text: segmentBy })),
                ...metrics.map((metric) => ({ text: metric }))
            ],
            rows: targetsDataset.map((referenceRow, i) => {
                const referenceData = referenceRow.datapoints[0];

                return [
                    ...referenceData.slice(0, segments.length),
                    referenceData[segments.length],
                    ...data.slice(1).map((d) => {
                        if (d[i].target === referenceRow.target) {
                            return d[i].datapoints[0][segments.length];
                        } else {
                            // datasets could have different sets of segments; currently, no merge is performed
                            return null;
                        }
                    })
                ];
            })
        });

        return {
            data: [Object.assign({}, data[0], tabularDataset)]
        };
    } else {
        return {
            data: _.flatten(data)
        };
    }
}
