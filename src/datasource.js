import _ from "lodash";
import {SysdigDashboardImporter} from './sysdig-dashboard-importer';

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

export class GenericDatasource {

  constructor(instanceSettings, $q, backendSrv, templateSrv) {
    this.name = instanceSettings.name;
    this.q = $q;
    this.backendSrv = backendSrv; this.templateSrv = templateSrv;
    this.url = instanceSettings.url;
    this.access = 'proxy';

    this.apiToken = instanceSettings.jsonData ? instanceSettings.jsonData.apiToken : '';
    this.headers = {
      'Content-Type': 'application/json',
      'X-Sysdig-Product': 'SDC',
      'Authorization': `Bearer ${this.apiToken}`,
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
      },
    };
  }

  testDatasource() {
    return this.doRequest({
      url: this.url + '/api/login',
      method: 'GET',
    }).then(response => {
      if (response.status === 200) {
        return { status: "success", message: "Data source is working", title: "Success" };
      }
    });
  }

  query(options) {
    const query = this.buildQueryParameters(options);
    query.targets = query.targets.filter(t => !t.hide);

    if (query.targets.length <= 0) {
      return this.q.when({data: []});
    }

    const userTime = {
      from: Math.trunc(options.range.from.valueOf() / 1000),
      to: Math.trunc(options.range.to.valueOf() / 1000),
      sampling: Math.trunc(query.intervalMs / 1000),
    };

    return DataService.fetch(this.backendSrv, this.apiToken, this.url, query, userTime);

    // return this.q.all([
    //   this.doRequest({
    //     url: this.url + '/api/history/timelines',
    //     data: query,
    //     method: 'GET'
    //   }),
    //   this.doRequest({
    //     url: this.url + '/api/v2/history/timelines/alignments',
    //     data: query,
    //     method: 'GET'
    //   })
    // ]).then((responses) => {
    //   return getRequestTime(responses[0].data, responses[1].data, userTime);
    // }).then((requestTime) => {
    //   if (requestTime === null) {
    //     // time window not available
    //     return this.q.when({data: []});
    //   } else {
    //     const requests = getRequests(query, requestTime);

    //     return this.doRequest({
    //       url: this.url + '/api/data/batch',
    //       data: { requests },
    //       method: 'POST'
    //     });
    //   }
    // }).then((response) => {
    //   return parseResponses(query, response);
    // });
  }

  buildQueryParameters(options) {
    //remove placeholder targets
    options.targets = _.filter(options.targets, target => {
      return target.target !== 'select metric';
    });

    const targets = _.map(options.targets, target => {
      return Object.assign({}, target, {
        target: this.templateSrv.replace(target.target, options.scopedVars, 'regex'),
        filter: this.templateSrv.replace(target.filter, options.scopedVars, 'regex'),
        pageLimit: Number.parseInt(target.pageLimit) || 10,
      });
    });

    options.targets = targets;

    return options;
  }

  metricFindQuery(query) {
    const normQueryNoDefaults = typeof query === 'string' ? { metricLookup: query, type: 'METRIC_TYPE_TAG' } : query;
    const normQuery = Object.assign(
      {
        metricLookup: null,
        type: 'METRIC_TYPE_VALUE',
      },
      normQueryNoDefaults
    );

    if (normQuery.metricLookup) {
      const now = Date.now() / 1000;
      const userTime = {
        from: now - 24 * 60 * 60,
        to: now,
        sampling: 24 * 60 * 60,
      };

      return DataService.fetch(
          this.backendSrv,
          this.apiToken,
          this.url,
          {
            targets: [
              {
                target: normQuery.metricLookup
              }
            ]
          },
          userTime
        )
        .then((response) => {
          debugger;
        })
      ;
    } else {
      if (this.metricsCache.isValid()) {
        return this.q.when(this.metricsCache.data);
      } else if (this.metricsCache.isLoading()) {
        return this.metricsCache.promise;
      } else {
        return this.metricsCache.load(
          this.doRequest({
            url: this.url + '/api/data/metrics?light=true',
            method: 'GET',
          })
            .then((result) => {
              const plottableMetricTypes = ['%', 'byte', 'date', 'int', 'number', 'relativeTime'];

              return Object.values(result.data)
                .map((m) => _.assign(m, { isNumeric: plottableMetricTypes.indexOf(m.type) >= 0}))
                .filter((m) => {
                  return (
                    normQuery.type === 'METRIC_TYPE_VALUE' && m.isNumeric === true ||
                    normQuery.type === 'METRIC_TYPE_TAG' && m.isNumeric === false ||
                    normQuery.type === 'METRIC_TYPE_ANY'
                  );
                })
                .sort((a, b) =>  a.id.localeCompare(b.id))
              ;
            })
            .then((data) => {
              this.metricsCache.setData(data);

              return data;
            })
        );
      }
    }
  }

  findSegmentBy(target) {
    if (target === 'select metric') {
      return this.q.when([]);
    } else {
      return this.doRequest({
        url: this.url + '/api/data/metrics/' + target + '/segmentationMetrics',
        method: 'GET',
      }).then((result) => {
        return result.data.segmentationMetrics
          .sort((a, b) => a.localeCompare(b))
        ;
      });
    }
  }

  annotationQuery(options) {
    var query = this.templateSrv.replace(options.annotation.query, {}, 'glob');
    var annotationQuery = {
      range: options.range,
      annotation: {
        name: options.annotation.name,
        datasource: options.annotation.datasource,
        enable: options.annotation.enable,
        iconColor: options.annotation.iconColor,
        query: query
      },
      rangeRaw: options.rangeRaw
    };

    return this.doRequest({
      url: this.url + '/annotations',
      method: 'POST',
      data: annotationQuery
    }).then(result => {
      return result.data;
    });
  }

  doRequest(options) {
    options.withCredentials = this.withCredentials;
    options.headers = this.headers;

    return this.backendSrv.datasourceRequest(options);
  }
}

const DataService = {
  queues: {},

  fetch(backendSrv, apiToken, url, query, userTime) {
    const queue = this.getQueue(apiToken);
    const batch = this.getBatch(queue, backendSrv, apiToken, url, userTime);

    const promise = backendSrv.$q.defer();
    batch.requests.push({
      query,
      promise,
    });

    const fetchQueueFn = _.debounce(this.fetchQueue.bind(this), 1000);
    fetchQueueFn();

    return promise.promise;
  },

  getBatch(queue, backendSrv, apiToken, url, userTime) {
    const batchId = this.getBatchId(userTime);

    if (queue[batchId] === undefined) {
      queue[batchId] = {
        backendSrv,
        apiToken,
        url,
        userTime,
        requests: [],
      };
    }

    return queue[batchId];
  },

  fetchQueue() {
    const queues = Object.values(this.queues);

    // clear queue, requests will be now processed
    this.queues = {};

    queues.forEach((queue) => {
      Object.values(queue).forEach((batch) => this.fetchBatch(batch));
    });
  },

  fetchBatch(batch) {
    const backendSrv = batch.backendSrv;
    const url = batch.url;
    const apiToken = batch.apiToken;
    const userTime = batch.userTime;
    const q = backendSrv.$q;

    q.all([
      doRequest(
        backendSrv,
        apiToken,
        {
          url: `${url}/api/history/timelines`,
          method: 'GET'
        }
      ),
      doRequest(
        backendSrv,
        apiToken,
        {
          url: `${url}/api/v2/history/timelines/alignments`,
          method: 'GET'
        }
      )
    ]).then((responses) => {
      return getRequestTime(responses[0].data, responses[1].data, userTime);
    }).then((requestTime) => {
      if (requestTime === null) {
        // time window not available
        batch.requests.forEach((request) => {
          request.promise.resolve({ data: [] });
        });
      } else {
        const apiRequests = batch.requests.reduce((acc, item) => {
          return [
            ...acc,
            ...getRequests(item.query, requestTime)
          ];
        }, []);

        return doRequest(
          backendSrv,
          apiToken,
          {
            url: `${url}/api/data/batch`,
            data: { requests: apiRequests },
            method: 'POST'
          }
        );
      }
    }).then(
      (response) => {
        let responses = response.data.responses.slice();
        batch.requests.forEach((item) => {
          const requestCount = item.query.targets.length;
          const itemResponses = responses.slice(0, requestCount);

          item.promise.resolve(parseResponses(item.query, itemResponses));

          responses = responses.slice(requestCount);
        });
      },
      (error) => {
          // time window not available
          batch.requests.forEach((request) => {
            request.promise.reject(error);
          });
      }
    );
  },

  getBatchId(userTime) {
    return `${userTime.from} - ${userTime.to} - ${userTime.sampling}`;
  },

  getQueue(apiToken) {
    if (this.queues[apiToken] === undefined) {
      this.queues[apiToken] = {};
    }

    return this.queues[apiToken];
  },
};

function doRequest(backendSrv, apiToken, options) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Sysdig-Product': 'SDC',
    'Authorization': `Bearer ${apiToken}`,
  };

  return backendSrv.datasourceRequest(Object.assign({}, { headers }, options));
}

function getRequestTime(timelines, alignments, userTime) {
  const fromUs = userTime.from * 1000000;
  const toUs = userTime.to * 1000000;
  const timespan = toUs - fromUs;
  const validTimelines = timelines.agents.filter((t) => {
    return t.from !== null && t.to !== null &&
      userTime.sampling <= t.sampling &&
      (
        (
          fromUs <= t.from &&
          toUs >= t.from
        ) ||
        (
          fromUs <= t.to &&
          toUs >= t.to
        ) ||
        (
          fromUs >= t.from &&
          toUs <= t.to
        )
      )
    ;
  });
  const validAlignments = alignments.filter((a) => {
    return timespan <= a.max * 1000000;
  });

  if (validTimelines.length === 0 || validAlignments.length === 0) {
    return null;
  } else {
    const alignTo = validAlignments[0].alignTo * 1000000;
    const sampling = validAlignments[0].sampling * 1000000;

    return {
      from: Math.trunc(Math.trunc(fromUs / alignTo) * alignTo / 1000000),
      to: Math.trunc(Math.trunc(toUs / alignTo) * alignTo / 1000000),
      sampling: Math.trunc(sampling / 1000000),
    };
  }
}

function getRequests(options, requestTime) {
  return options.targets.map((target) => getRequest(target, requestTime));
}

function getRequest(target, requestTime) {
  return {
    format: {
      type: 'data'
    },
    time: {
      from: requestTime.from * 1000000,
      to: requestTime.to * 1000000,
      sampling: requestTime.sampling * 1000000,
    },
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

  function getMetrics() {
    const metrics = {
      k0: 'timestamp',
      v0: target.target,
    };

    if (target.segmentBy) {
      metrics.k1 = target.segmentBy;
    }

    return metrics;
  }

  function getSort() {
    const sortDirection = target.sortDirection || 'desc';

    const sort = [
      { v0: sortDirection },
      { k0: sortDirection }
    ];

    if (target.segmentBy) {
      sort.push({ k1: sortDirection });
    }

    return sort;
  }

  function getPaging() {
    return {
      from: 0,
      to: (target.pageLimit || 10) - 1,
    };
  }

  function getGroupBy() {
    const groupBy = [
      {
        metric: 'k0',
        value: requestTime.sampling * 1000000
      }
    ];

    if (target.segmentBy) {
      groupBy.push({
        metric: 'k1',
      });
    }
    return groupBy;
  }
}

function parseResponses(options, response) {
  const data = options.targets.map((target, i) => {
    const map = response[i].data.reduce((acc, d) => {
      let t;

      if (target.segmentBy) {
        t = options.targets.length === 1 ? d.k1 : `${target.target} (${d.k1})`;
      } else {
        t = target.target;
      }

      if (acc[t] === undefined) {
        acc[t] = {
          target: t,
          datapoints: [],
        };
      }

      acc[t].datapoints.push([
        d.v0,
        d.k0 / 1000
      ]);

      return acc;
    }, {});

    return Object.values(map).sort((a, b) => a.target.localeCompare(b.target));
  });

  return {
    data: Array.concat(...data),
  };
}
