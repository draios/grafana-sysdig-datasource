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
}

class TimeSeriesBuilder extends BaseBuilder {
    static build(sysdigDashboard, options, sysdigPanel, index) {
        return {
            type: 'graph',
            datasource: options.datasourceName,
            id: index,
            title: sysdigPanel.name,
            gridPos: this.getTargetGridLayout(sysdigDashboard, sysdigPanel),
            targets: this.buildTargets(sysdigDashboard, sysdigPanel),
            legend: {
                show: false // retain Sysdig layout
            },
            yaxes: this.buildPanelYAxes(sysdigPanel, options)
        };
    }

    static buildTargets(sysdigDashboard, sysdigPanel) {
        const values = sysdigPanel.metrics.filter((metric) => {
            return metric.metricId !== 'timestamp' && metric.aggregation !== undefined;
        });
        if (values.length === 0) {
            console.warn('Expected at least one value metric');
        }

        const keys = sysdigPanel.metrics.filter((metric) => {
            return metric.metricId !== 'timestamp' && metric.aggregation === undefined;
        });
        if (keys.length > 1) {
            console.warn('Expected at most one key metric');
        }

        return values.map((value, i) => {
            return {
                refId: i.toString(),
                isSingleDataPoint: false,
                target: value.metricId.replace(/%25/g, '.'),
                timeAggregation: value.aggregation,
                groupAggregation: value.groupAggregation,
                segmentBy: keys.length === 1 ? keys[0].metricId.replace(/%25/g, '.') : null,
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

    static getTargetPageLimit(sysdigPanel) {
        const normalizedDisplayOptions = Object.assign(
            {
                valueLimit: {
                    direction: null,
                    count: null
                }
            },
            sysdigPanel.customDisplayOptions
        );

        return Number.parseInt(normalizedDisplayOptions.valueLimit.count) || null;
    }

    static buildPanelYAxes(sysdigPanel) {
        // TODO set proper format
        const baseAxisConfig = {
            format: 'short',
            label: null,
            logBase: 1,
            min: null,
            max: null,
            show: false
        };
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

        return [
            // left axis
            _.assign({}, baseAxisConfig, {
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
}

class BarChartBuilder extends TimeSeriesBuilder {
    static build(...args) {
        console.warn(`top panels will be converted to time series`);

        return super.build(...args);
    }
}

class NumberBuilder extends BaseBuilder {
    static build(sysdigDashboard, options, sysdigPanel, index) {
        // TODO set proper format
        return {
            type: 'singlestat',
            datasource: options.datasourceName,
            id: index,
            title: sysdigPanel.name,
            gridPos: this.getTargetGridLayout(sysdigDashboard, sysdigPanel),
            targets: this.buildTargets(sysdigDashboard, sysdigPanel),
            format: 'short'
        };
    }

    static buildTargets(sysdigDashboard, sysdigPanel) {
        const values = sysdigPanel.metrics.filter((metric) => {
            return metric.metricId !== 'timestamp' && metric.aggregation !== undefined;
        });
        if (values.length !== 1) {
            console.warn('Expected exactly one value metric');
        }

        return values.map((value, i) => {
            return {
                refId: i.toString(),
                isSingleDataPoint: true,
                target: value.metricId.replace(/%25/g, '.'),
                timeAggregation: value.aggregation,
                groupAggregation: value.groupAggregation,
                segmentBy: null,
                filter: this.getTargetFilter(sysdigDashboard, sysdigPanel)
            };
        });
    }
}

class DefaultBuilder extends BaseBuilder {
    static build(sysdigDashboard, options, sysdigPanel, index) {
        return {
            type: 'text',
            datasource: options.datasourceName,
            id: index,
            title: sysdigPanel.name,
            gridPos: this.getTargetGridLayout(sysdigDashboard, sysdigPanel),
            mode: 'markdown',
            content: this.getContent(sysdigPanel)
        };
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
