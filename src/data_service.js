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
        const userTime = batch.userTime;
        const q = batch.backend.backendSrv.$q;

        q
            .all([
                ApiService.send(batch.backend, {
                    url: `api/history/timelines`
                }),
                ApiService.send(batch.backend, {
                    url: `api/v2/history/timelines/alignments`
                })
            ])
            .then((responses) => {
                return getRequestTime(responses[0].data, responses[1].data, userTime);
            })
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

function getRequestTime(timelines, alignments, userTime) {
    const fromUs = userTime.from * 1000000;
    const toUs = userTime.to * 1000000;
    const timespan = toUs - fromUs;

    //
    // Use alignments that allow the required timespan
    //
    const validAlignments = alignments.filter((a) => {
        return timespan <= a.max * 1000000;
    });

    if (validAlignments.length === 0) {
        return null;
    }

    //
    // Set min sampling
    //
    const minSampling = validAlignments[0].sampling * 1000000;

    //
    // Filter timelines so that sampling is valid, and the requested time window is partially or
    // entirely overlapping with a given timeline
    //
    const validTimelines = timelines.agents.filter((t) => {
        return (
            t.from !== null &&
            t.to !== null &&
            minSampling <= t.sampling &&
            ((fromUs <= t.from && toUs >= t.from) ||
                (fromUs >= t.from && toUs <= t.to) ||
                (fromUs <= t.to && toUs >= t.to))
        );
    });

    if (validTimelines.length === 0) {
        return null;
    }

    //
    // Align time window with required alignment
    //
    const alignTo = validAlignments[0].alignTo * 1000000;
    const alignedFrom = Math.trunc(Math.trunc(fromUs / alignTo) * alignTo / 1000000);
    const alignedTo = Math.trunc(Math.trunc(toUs / alignTo) * alignTo / 1000000);

    //
    // Adjust time window according to timeline (might miss first or last portion)
    //
    return {
        from: Math.max(alignedFrom, validTimelines[0].from / 1000000),
        to: Math.min(alignedTo, validTimelines[0].to / 1000000),
        sampling: Math.trunc(minSampling / 1000000)
    };
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

            if (target.segmentBy) {
                metrics.k0 = target.segmentBy;
            }

            return metrics;
        } else {
            const metrics = {
                k0: 'timestamp',
                v0: target.target
            };

            if (target.segmentBy) {
                metrics.k1 = target.segmentBy;
            }

            return metrics;
        }
    }

    function getSort() {
        const sortDirection = target.sortDirection || 'desc';

        const sort = [{ v0: sortDirection }, { k0: sortDirection }];

        if (target.segmentBy) {
            sort.push({ k1: sortDirection });
        }

        return sort;
    }

    function getPaging() {
        return {
            from: 0,
            to: (target.pageLimit || 10) - 1
        };
    }

    function getGroupBy() {
        if (target.isSingleDataPoint) {
            const groupBy = [];

            if (target.segmentBy) {
                groupBy.push({
                    metric: 'k0'
                });
            }

            return groupBy;
        } else {
            const groupBy = [
                {
                    metric: 'k0',
                    value: requestTime.sampling * 1000000
                }
            ];

            if (target.segmentBy) {
                groupBy.push({
                    metric: 'k1'
                });
            }

            return groupBy;
        }
    }
}

function parseResponses(options, response) {
    const data = options.targets.map((target, i) => {
        const isSingleDataPoint = target.isSingleDataPoint;

        if (response[i].data) {
            const map = response[i].data.reduce((acc, d) => {
                let t;

                const segmentPropName = isSingleDataPoint ? 'k0' : 'k1';
                if (target.segmentBy) {
                    t =
                        options.targets.length === 1
                            ? targetToString(d[segmentPropName])
                            : `${targetToString(target.target)} (${d[segmentPropName]})`;
                } else {
                    t = targetToString(target.target);
                }

                if (acc[t] === undefined) {
                    acc[t] = {
                        target: t,
                        datapoints: []
                    };
                }

                if (isSingleDataPoint) {
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

    return {
        data: Array.concat(...data)
    };
}

function targetToString(target) {
    return target || 'n/a';
}
