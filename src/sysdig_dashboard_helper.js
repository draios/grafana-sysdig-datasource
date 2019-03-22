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
/* global grafanaBootData */

export default class SysdigDashboardHelper {
    static convertToGrafana(sysdigDashboard, options) {
        const panels = (sysdigDashboard.items || sysdigDashboard.widgets)
            .map((panel, index) => {
                const builder = this.getPanelBuilder(panel);
                return builder.build(sysdigDashboard, options, panel, index);
            })
            .filter((r) => r !== null);

        const isRowMandatory = this.getGrafanaVersion().indexOf('4.') === 0;
        let dashboardPanelsConfiguration;
        if (isRowMandatory) {
            // convert grid layout to row spans
            panels.forEach((panel) => {
                panel.span = panel.gridPos.w / 2;
            });

            // define rows
            dashboardPanelsConfiguration = {
                rows: panels.reduce((acc, panel) => {
                    if (acc.length === 0) {
                        return [
                            {
                                panels: [panel]
                            }
                        ];
                    } else if (acc[acc.length - 1].panels[0].gridPos.x < panel.gridPos.x) {
                        acc[acc.length - 1].panels.push(panel);
                    } else {
                        acc.push({
                            panels: [panel]
                        });
                    }

                    return acc;
                }, [])
            };

            // remove grid layout
            panels.forEach((panel) => {
                delete panel.gridPos;
            });
        } else {
            dashboardPanelsConfiguration = { panels };
        }

        let categoryTags;
        if (sysdigDashboard.category) {
            categoryTags = sysdigDashboard.category
                .split('.')
                .reduce((acc, part) => {
                    if (acc === null) {
                        return [part];
                    } else {
                        return [...acc, `${acc[acc.length - 1]}.${part}`];
                    }
                }, null)
                .map((categoryId) => {
                    const category = options.categories.find(
                        (category) => category.id === categoryId
                    );

                    if (category) {
                        return category.name;
                    } else {
                        return null;
                    }
                })
                .filter((category) => category !== null);
        } else {
            categoryTags = [];
        }

        return Object.assign(
            {
                schemaVersion: 6,
                version: 0,
                title: sysdigDashboard.name,
                tags: [...(options.tags || []), ...categoryTags],
                timezone: 'browser',
                time: {
                    // default Sysdig: last 1 hour
                    from: 'now-1h',
                    to: 'now'
                },
                graphTooltip: 1 // shared crosshair
            },
            dashboardPanelsConfiguration
        );
    }

    static getPanelBuilder(panel) {
        switch (panel.showAs) {
            case 'timeSeries':
                return TimeSeriesBuilder;

            case 'timeSeriesArea':
                return TimeSeriesAreaBuilder;

            case 'histogram':
                return HistogramBuilder;

            case 'top':
                return BarChartBuilder;

            case 'summary':
                return NumberBuilder;

            case 'table':
                return TableBuilder;

            case 'text':
                return TextBuilder;

            default:
                console.warn(`${panel.showAs} panels cannot be exported to Grafana`);
                return DefaultBuilder;
        }
    }

    static getGrafanaVersion() {
        return grafanaBootData &&
            grafanaBootData.settings &&
            grafanaBootData.settings.buildInfo &&
            grafanaBootData.settings.buildInfo.version
            ? grafanaBootData.settings.buildInfo.version
            : 'n.a.';
    }
}

const GRAFANA_COLUMN_COUNT = 24;
const SYSDIG_COLUMN_COUNT = 12;

class BaseBuilder {
    static getPanelType() {
        return null;
    }

    static isSingleDataPoint() {
        return false;
    }

    static isTabularFormat() {
        return false;
    }

    static getTargetGridLayout(sysdigDashboard, sysdigPanel) {
        let layout;
        if (sysdigDashboard.items) {
            const index = (sysdigDashboard.items || sysdigDashboard.widgets).indexOf(sysdigPanel);
            layout = sysdigDashboard.layout[index];
        } else {
            layout = sysdigPanel.gridConfiguration;
        }

        // keep w/h ratio similar to Sysdig by reducing height by 80%
        return {
            h: Math.ceil((layout.size_y / SYSDIG_COLUMN_COUNT) * GRAFANA_COLUMN_COUNT * 0.8),
            w: (layout.size_x / SYSDIG_COLUMN_COUNT) * GRAFANA_COLUMN_COUNT,
            x: ((layout.col - 1) / SYSDIG_COLUMN_COUNT) * GRAFANA_COLUMN_COUNT,
            y: Math.floor(((layout.row - 1) / SYSDIG_COLUMN_COUNT) * GRAFANA_COLUMN_COUNT * 0.8)
        };
    }

    static getTargetFilter(sysdigDashboard, sysdigPanel) {
        return sysdigPanel.scope || sysdigDashboard.filterExpression;
    }

    static getBasePanelConfiguration(sysdigDashboard, options, sysdigPanel, index) {
        return {
            type: this.getPanelType(),
            datasource: options.datasourceName,
            id: index,
            title: sysdigPanel.name,
            gridPos: this.getTargetGridLayout(sysdigDashboard, sysdigPanel)
        };
    }

    static getValueFormat(value, metrics) {
        const metricConfiguration = _.find(metrics, (m) => m.id === value.metricId);

        if (metricConfiguration === undefined) {
            // metric not found, return default format
            return 'short';
        } else {
            // NOTE: For unit mapping, refer to public/app/core/utils/kbn.ts
            const isRate = value.aggregation === 'timeAvg';
            switch (metricConfiguration.type) {
                case 'string':
                case 'providerServiceEnum':
                case 'bool':
                    return 'none';

                case 'int':
                case 'number':
                case 'double':
                    return 'short';

                case 'byte':
                    if (isRate) {
                        return 'Bps';
                    } else {
                        return 'bytes';
                    }

                case 'relativeTime':
                    return 'ns';

                case '%':
                case 'ratio':
                    return 'percent';

                case 'date':
                case 'dateTime':
                case 'absoluteTime':
                    return 'dateTimeAsIso';

                default:
                    return 'short';
            }
        }
    }
}

class TimeSeriesBuilder extends BaseBuilder {
    static getPanelType() {
        return 'graph';
    }

    static build(sysdigDashboard, options, sysdigPanel, index) {
        return Object.assign(
            {},
            this.getBasePanelConfiguration(sysdigDashboard, options, sysdigPanel, index),
            {
                targets: this.buildTargets(sysdigDashboard, sysdigPanel),
                legend: {
                    show: false // retain Sysdig layout
                },
                yaxes: this.buildPanelYAxes(sysdigDashboard, sysdigPanel, options)
            }
        );
    }

    static getValues(sysdigDashboard, sysdigPanel) {
        const values = sysdigPanel.metrics.map(parseSysdigPanelValue).filter((metric) => {
            return metric.metricId !== 'timestamp' && metric.timeAggregation !== undefined;
        });
        if (values.length === 0) {
            console.warn('Expected at least one value metric');
        }

        return values;
    }

    static getKeys(sysdigDashboard, sysdigPanel) {
        const keys = sysdigPanel.metrics.map(parseSysdigPanelKey).filter((metric) => {
            return metric.metricId !== 'timestamp' && metric.timeAggregation === undefined;
        });
        if (keys.length > 1) {
            console.warn('Expected at most one key metric');
        }

        return keys;
    }

    static buildTargets(sysdigDashboard, sysdigPanel) {
        const values = this.getValues(sysdigDashboard, sysdigPanel);
        const keys = this.getKeys(sysdigDashboard, sysdigPanel);

        return values.map((value, i) => {
            return {
                refId: i.toString(),
                isSingleDataPoint: this.isSingleDataPoint(),
                isTabularFormat: this.isTabularFormat(),
                target: value.metricId,
                timeAggregation: value.timeAggregation,
                groupAggregation: value.groupAggregation,
                segmentBy: keys.length === 1 ? keys[0].metricId : null,
                filter: this.getTargetFilter(sysdigDashboard, sysdigPanel),
                sortDirection: this.getTargetSortDirection(sysdigPanel),
                pageLimit: this.getTargetPageLimit(sysdigPanel)
            };
        });
    }

    static getTargetSortDirection(sysdigPanel) {
        const normalizedDisplayOptions = Object.assign(
            {
                valueLimit: {
                    direction: null,
                    count: null
                }
            },
            sysdigPanel.customDisplayOptions
        );

        return normalizedDisplayOptions.valueLimit.direction || null;
    }

    static parseValueLimitCount(sysdigPanel) {
        return sysdigPanel.customDisplayOptions &&
            sysdigPanel.customDisplayOptions.valueLimit &&
            Number.parseInt(sysdigPanel.customDisplayOptions.valueLimit.count, 10)
            ? Number.parseInt(sysdigPanel.customDisplayOptions.valueLimit.count, 10)
            : 10;
    }

    static getTargetPageLimit(sysdigPanel) {
        return this.parseValueLimitCount(sysdigPanel);
    }

    static buildPanelYAxes(sysdigDashboard, sysdigPanel, options) {
        const normalizedDisplayOptions = Object.assign(
            {
                yAxisLeftDomain: {
                    from: null,
                    to: null
                }
            },
            sysdigPanel.customDisplayOptions
        );

        let yAxisLogBase;
        switch (normalizedDisplayOptions.yAxisScale) {
            case 'logarithmic2':
                yAxisLogBase = 2;
                break;
            case 'logarithmic10':
                yAxisLogBase = 10;
                break;
            case 'logarithmic32':
                yAxisLogBase = 32;
                break;
            case 'logarithmic1024':
                yAxisLogBase = 1024;
                break;
            default:
                yAxisLogBase = 1;
                break;
        }

        const baseAxisConfig = {
            label: null,
            logBase: 1,
            min: null,
            max: null,
            show: false
        };

        const values = this.getValues(sysdigDashboard, sysdigPanel);

        return [
            // left axis
            _.assign({}, baseAxisConfig, {
                format: this.getValueFormat(values[0], options.metrics),
                show: true,
                min: normalizedDisplayOptions.yAxisLeftDomain.from,
                max: normalizedDisplayOptions.yAxisLeftDomain.to,
                logBase: yAxisLogBase
            }),
            // right axis
            _.assign({}, baseAxisConfig)
        ];
    }
}

class TimeSeriesAreaBuilder extends TimeSeriesBuilder {
    static build(...args) {
        return Object.assign({}, super.build(...args), {
            stack: true,
            fill: 7 // similar opacity used by Sysdig Monitor
        });
    }
}

class HistogramBuilder extends TimeSeriesBuilder {
    static isSingleDataPoint() {
        return true;
    }

    static getValueFormat() {
        // the axis will count items in each bucket
        return 'short';
    }

    static build(sysdigDashboard, options, sysdigPanel, index) {
        return Object.assign({}, super.build(sysdigDashboard, options, sysdigPanel, index), {
            bars: true,
            lines: false,
            xaxis: {
                buckets: sysdigPanel.customDisplayOptions
                    ? sysdigPanel.customDisplayOptions.histogram.numberOfBuckets
                    : 10,
                mode: 'histogram'
            }
        });
    }

    static getTargetPageLimit(sysdigPanel) {
        // apply a "premium" x10 to limit the effect of data pagination to bucket values
        // Grafana will get all the entities and will define buckets on top of that
        // However, if pagination limits the number of entries exported via API, bucket values
        // will not be correct.
        return this.parseValueLimitCount(sysdigPanel) * 10;
    }
}

class BarChartBuilder extends TimeSeriesBuilder {
    static isSingleDataPoint() {
        return true;
    }

    static build(sysdigDashboard, options, sysdigPanel, index) {
        return Object.assign({}, super.build(sysdigDashboard, options, sysdigPanel, index), {
            bars: true,
            lines: false,
            xaxis: {
                mode: 'series',
                values: ['total']
            }
        });
    }
}

class NumberBuilder extends BaseBuilder {
    static getPanelType() {
        return 'singlestat';
    }

    static isSingleDataPoint() {
        return true;
    }

    static build(sysdigDashboard, options, sysdigPanel, index) {
        const value = this.getValue(sysdigDashboard, sysdigPanel);

        if (value) {
            // TODO set proper format
            const format = this.getValueFormat(value, options.metrics);

            return Object.assign(
                {},
                this.getBasePanelConfiguration(sysdigDashboard, options, sysdigPanel, index),
                {
                    targets: this.buildTargets(sysdigDashboard, sysdigPanel),
                    format
                }
            );
        } else {
            console.warn('number panel configuration not valid (missing value)');
            return this.getBasePanelConfiguration(
                sysdigDashboard,
                options,
                sysdigPanel,
                index,
                'singlestat'
            );
        }
    }

    static getValue(sysdigDashboard, sysdigPanel) {
        const values = sysdigPanel.metrics
            .filter((metric) => {
                return metric.metricId !== 'timestamp' && metric.timeAggregation !== undefined;
            })
            .map(parseSysdigPanelValue);
        if (values.length !== 1) {
            console.warn('Expected exactly one value metric');
        }

        return values[0];
    }

    static buildTargets(sysdigDashboard, sysdigPanel) {
        const value = this.getValue(sysdigDashboard, sysdigPanel);

        return [
            {
                refId: '0',
                isSingleDataPoint: this.isSingleDataPoint(),
                isTabularFormat: this.isTabularFormat(),
                segmentBy: null,
                filter: this.getTargetFilter(sysdigDashboard, sysdigPanel),
                target: value.metricId,
                timeAggregation: value.timeAggregation,
                groupAggregation: value.groupAggregation
            }
        ];
    }
}

class TableBuilder extends TimeSeriesBuilder {
    static getPanelType() {
        return 'table';
    }

    static isSingleDataPoint() {
        return true;
    }

    static isTabularFormat() {
        return true;
    }

    static build(sysdigDashboard, options, sysdigPanel, index) {
        return Object.assign({}, super.build(sysdigDashboard, options, sysdigPanel, index), {
            transform: 'timeseries_aggregations',
            sort: {
                col: 1,
                desc: true
            },
            styles: [
                ...sysdigPanel.metrics.map((metric) => {
                    const format = this.getValueFormat(metric, options.metrics);
                    if (format === 'none') {
                        return {
                            pattern: metric.metricId,
                            type: 'string'
                        };
                    } else {
                        return {
                            pattern: metric.metricId,
                            type: 'number',
                            unit: format,
                            decimals: 2
                        };
                    }
                }),
                {
                    pattern: '/.*/',
                    type: 'string'
                }
            ]
        });
    }

    static buildTargets(sysdigDashboard, sysdigPanel) {
        const keys = this.getKeys(sysdigDashboard, sysdigPanel);
        const filterMetrics = (metric) => metric.metricId !== keys[0].metricId;

        return sysdigPanel.metrics
            .map(parseSysdigPanelValue)
            .filter(filterMetrics)
            .map((value, i) => {
                return {
                    refId: i.toString(),
                    isSingleDataPoint: this.isSingleDataPoint(),
                    isTabularFormat: this.isTabularFormat(),
                    target: value.metricId,
                    timeAggregation: value.timeAggregation || 'concat',
                    groupAggregation: value.groupAggregation || 'concat',
                    segmentBy: keys.length >= 1 ? keys[0].metricId : null,
                    filter: this.getTargetFilter(sysdigDashboard, sysdigPanel),
                    sortDirection: this.getTargetSortDirection(sysdigPanel),
                    pageLimit: this.getTargetPageLimit(sysdigPanel)
                };
            });
    }

    static getKeys(sysdigDashboard, sysdigPanel) {
        return sysdigPanel.metrics.map(parseSysdigPanelKey).filter((metric) => {
            return metric.timeAggregation === undefined;
        });
    }
}

class TextBuilder extends BaseBuilder {
    static getPanelType() {
        return 'text';
    }

    static build(sysdigDashboard, options, sysdigPanel, index) {
        return Object.assign(
            {},
            this.getBasePanelConfiguration(sysdigDashboard, options, sysdigPanel, index),
            {
                mode: 'markdown',
                content: this.getContent(sysdigPanel),
                transparent: sysdigPanel.hasTransparentBackground === true
            }
        );
    }

    static getContent(sysdigPanel) {
        return sysdigPanel.markdownSource;
    }
}

class DefaultBuilder extends BaseBuilder {
    static build(sysdigDashboard, options, sysdigPanel, index) {
        return Object.assign(
            {},
            this.getBasePanelConfiguration(sysdigDashboard, options, sysdigPanel, index),
            {
                mode: 'html',
                content: this.getContent(sysdigPanel)
            }
        );
    }

    static getPanelType() {
        return 'text';
    }

    static getContent(sysdigPanel) {
        let panelType;
        switch (sysdigPanel.showAs) {
            case 'timeSeriesArea':
                panelType = 'Area';
                break;
            case 'top':
                panelType = 'Top list';
                break;
            case 'histogram':
                panelType = 'Histogram';
                break;
            case 'map':
                panelType = 'Topology';
                break;
            case 'summary':
                panelType = 'Number';
                break;
            case 'table':
                panelType = 'Table';
                break;
            default:
                panelType = sysdigPanel.showAs;
                break;
        }

        return `<div class="text-center muted"><strong>${panelType}</strong> cannot be exported from Sysdig Monitor to Grafana.</div>`;
    }
}

function parseSysdigPanelValue(metric) {
    return Object.assign({}, metric, {
        metricId: metric.metricId.replace(/%25/g, '.'),
        timeAggregation: metric.timeAggregation || metric.aggregation
    });
}

function parseSysdigPanelKey(metric) {
    return parseSysdigPanelValue(metric);
}
