/* global grafanaBootData */

export default class SysdigDashboardHelper {
    static convertToGrafana(sysdigDashboard, options) {
        const panels = sysdigDashboard.items
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

        return Object.assign(
            {
                schemaVersion: 6,
                version: 0,
                title: sysdigDashboard.name,
                tags: ['sysdig'],
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
    static getTargetGridLayout(sysdigDashboard, sysdigPanel) {
        const index = sysdigDashboard.items.indexOf(sysdigPanel);
        const layout = sysdigDashboard.layout[index];

        // keep w/h ratio similar to Sysdig by reducing height by 80%
        return {
            h: Math.ceil(layout.size_y / SYSDIG_COLUMN_COUNT * GRAFANA_COLUMN_COUNT * 0.8),
            w: layout.size_x / SYSDIG_COLUMN_COUNT * GRAFANA_COLUMN_COUNT,
            x: (layout.col - 1) / SYSDIG_COLUMN_COUNT * GRAFANA_COLUMN_COUNT,
            y: Math.floor((layout.row - 1) / SYSDIG_COLUMN_COUNT * GRAFANA_COLUMN_COUNT * 0.8)
        };
    }

    static getTargetFilter(sysdigDashboard, sysdigPanel) {
        return sysdigPanel.scope || sysdigDashboard.filterExpression;
    }

    static getBasePanelConfiguration(sysdigDashboard, options, sysdigPanel, index, panelType) {
        return {
            type: panelType,
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
    static build(sysdigDashboard, options, sysdigPanel, index) {
        return Object.assign(
            {},
            this.getBasePanelConfiguration(sysdigDashboard, options, sysdigPanel, index, 'graph'),
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
        const values = sysdigPanel.metrics
            .filter((metric) => {
                return metric.metricId !== 'timestamp' && metric.aggregation !== undefined;
            })
            .map(parseSysdigPanelValue);
        if (values.length === 0) {
            console.warn('Expected at least one value metric');
        }

        return values;
    }

    static getKeys(sysdigDashboard, sysdigPanel) {
        const keys = sysdigPanel.metrics
            .filter((metric) => {
                return metric.metricId !== 'timestamp' && metric.aggregation === undefined;
            })
            .map(parseSysdigPanelKey);
        if (keys.length > 1) {
            console.warn('Expected at most one key metric');
        }

        return keys;
    }

    static isSingleDataPoint() {
        return false;
    }

    static buildTargets(sysdigDashboard, sysdigPanel) {
        const values = this.getValues(sysdigDashboard, sysdigPanel);
        const keys = this.getKeys(sysdigDashboard, sysdigPanel);

        return values.map((value, i) => {
            return {
                refId: i.toString(),
                isSingleDataPoint: this.isSingleDataPoint(),
                target: value.metricId,
                timeAggregation: value.aggregation,
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
        const normalizedDisplayOptions = sysdigPanel.customDisplayOptions
            ? sysdigPanel.customDisplayOptions
            : {
                  yAxisLeftDomain: {
                      from: null,
                      to: null
                  }
              };

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
    static build(sysdigDashboard, options, sysdigPanel, index) {
        return Object.assign({}, super.build(sysdigDashboard, options, sysdigPanel, index), {
            bars: true,
            lines: false,
            xaxis: {
                buckets: sysdigPanel.customDisplayOptions.histogram.numberOfBuckets,
                mode: 'histogram'
            }
        });
    }

    static isSingleDataPoint() {
        return true;
    }

    static getValueFormat() {
        // the axis will count items in each bucket
        return 'short';
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

    static isSingleDataPoint() {
        return true;
    }
}

class NumberBuilder extends BaseBuilder {
    static build(sysdigDashboard, options, sysdigPanel, index) {
        const value = this.getValue(sysdigDashboard, sysdigPanel);

        if (value) {
            // TODO set proper format
            const format = this.getValueFormat(value, options.metrics);

            return Object.assign(
                {},
                this.getBasePanelConfiguration(
                    sysdigDashboard,
                    options,
                    sysdigPanel,
                    index,
                    'singlestat'
                ),
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
                return metric.metricId !== 'timestamp' && metric.aggregation !== undefined;
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
                isSingleDataPoint: true,
                segmentBy: null,
                filter: this.getTargetFilter(sysdigDashboard, sysdigPanel),
                target: value.metricId,
                timeAggregation: value.aggregation,
                groupAggregation: value.groupAggregation
            }
        ];
    }
}

class DefaultBuilder extends BaseBuilder {
    static build(sysdigDashboard, options, sysdigPanel, index) {
        return Object.assign(
            {},
            this.getBasePanelConfiguration(sysdigDashboard, options, sysdigPanel, index, 'text'),
            {
                mode: 'markdown',
                content: this.getContent(sysdigPanel)
            }
        );
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

        return `**${panelType} panels** cannot be exported from Sysdig Monitor to Grafana.`;
    }
}

function parseSysdigPanelValue(metric) {
    return Object.assign({}, metric, {
        metricId: metric.metricId.replace(/%25/g, '.')
    });
}

function parseSysdigPanelKey(metric) {
    return parseSysdigPanelValue(metric);
}
