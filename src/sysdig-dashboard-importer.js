const GRAFANA_COLUMN_COUNT = 24;
const SYSDIG_COLUMN_COUNT = 12;

export class SysdigDashboardImporter {
    static convertToGrafana(sysdigDashboard, datasourceName) {
        return buildGrafanaDashboard(sysdigDashboard, {
            datasourceName,
        });
    }

    static importFromSysdig(grafanaUrl, apiToken, grafanaDashboard) {
        httpPost(
            `${grafanaUrl}/api/dashboards/db`,
            apiToken,
            grafanaDashboard
        );
    }
}

function buildGrafanaDashboard(sysdigDashboard, options) {
    const grafanaVersion = grafanaBootData &&
        grafanaBootData.settings &&
        grafanaBootData.settings.buildInfo &&
        grafanaBootData.settings.buildInfo.version ?
        grafanaBootData.settings.buildInfo.version :
        'n.a.'
    ;

    const buildPanelFn = buildPanel.bind(null, sysdigDashboard, options);
    const panels = sysdigDashboard.items.map(buildPanelFn).filter((r) => r !== null);

    const isRowMandatory = grafanaVersion.indexOf('4.') === 0;
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
                    return [{
                        panels: [panel],
                    }];
                } else if (acc[acc.length - 1].panels[0].gridPos.x < panel.gridPos.x) {
                    acc[acc.length - 1].panels.push(panel);
                } else {
                    acc.push({
                        panels: [panel],
                    });
                }

                return acc;
            }, []),
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
            time: { // default Sysdig: last 1 hour
                from: 'now-1h',
                to: 'now',
            },
            graphTooltip: 1, // shared crosshair
        },
        dashboardPanelsConfiguration
    );

}

function buildPanel(sysdigDashboard, options, sysdigPanel, index) {
    switch (sysdigPanel.showAs) {
        case 'timeSeries':
            return buildTimeSeriesPanel(sysdigDashboard, options, sysdigPanel, index);

        case 'timeSeriesArea':
            return buildTimeSeriesAreaPanel(sysdigDashboard, options, sysdigPanel, index);

        case 'histogram':
            return buildHistogramPanel(sysdigDashboard, options, sysdigPanel, index);

        case 'top':
            return buildTopPanel(sysdigDashboard, options, sysdigPanel, index);

        case 'summary':
            return buildSummaryPanel(sysdigDashboard, options, sysdigPanel, index);

        default:
            console.warn(`${sysdigPanel.showAs} panels cannot be exported to Grafana`);

            return {
                type: 'text',
                datasource: options.datasourceName,
                id: index,
                title: sysdigPanel.name,
                gridPos: buildPanelGridLayout(sysdigDashboard, sysdigPanel),
                mode: 'markdown',
                content: buildTextContentForUnavailablePanel(sysdigPanel),
            };
    }
}

function buildTimeSeriesPanel(sysdigDashboard, options, sysdigPanel, index) {
    return {
        type: 'graph',
        datasource: options.datasourceName,
        id: index,
        title: sysdigPanel.name,
        gridPos: buildPanelGridLayout(sysdigDashboard, sysdigPanel),
        targets: buildTimeSeriesTargets(sysdigDashboard, sysdigPanel),
        legend: {
            show: false, // retain Sysdig layout
        },
        yaxes: buildPanelYAxes(sysdigPanel),
    };
}

function buildTimeSeriesAreaPanel(sysdigDashboard, options, sysdigPanel, index) {
    return Object.assign(
        {},
        buildTimeSeriesPanel(sysdigDashboard, options, sysdigPanel, index),
        {
            stack: true,
            fill: 7, // similar opacity used by Sysdig Monitor
        }
    );
}

function buildHistogramPanel(sysdigDashboard, options, sysdigPanel, index) {
    return Object.assign(
        {},
        buildTimeSeriesPanel(sysdigDashboard, options, sysdigPanel, index),
        {
            bars: true,
            lines: false,
            xaxis: {
                buckets: sysdigPanel.customDisplayOptions.histogram.numberOfBuckets,
                mode: 'histogram',
            },
        }
    );
}

function buildTopPanel(sysdigDashboard, options, sysdigPanel, index) {
    console.warn(`top panels will be converted to time series`);

    return {
        type: 'graph',
        datasource: options.datasourceName,
        id: index,
        title: sysdigPanel.name,
        gridPos: buildPanelGridLayout(sysdigDashboard, sysdigPanel),
        targets: buildTimeSeriesTargets(sysdigDashboard, sysdigPanel),
        legend: {
            show: false, // retain Sysdig layout
        },
        yaxes: buildPanelYAxes(sysdigPanel),
    };
}

function buildSummaryPanel(sysdigDashboard, options, sysdigPanel, index) {
    console.warn(`top panels will be converted to time series`);

    return {
        type: 'graph',
        datasource: options.datasourceName,
        id: index,
        title: sysdigPanel.name,
        gridPos: buildPanelGridLayout(sysdigDashboard, sysdigPanel),
        targets: buildTimeSeriesTargets(sysdigDashboard, sysdigPanel),
        legend: {
            show: false, // retain Sysdig layout
        },
        yaxes: buildPanelYAxes(sysdigPanel),
    };
}

function buildTextContentForUnavailablePanel(sysdigPanel) {
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

function buildTimeSeriesTargets(sysdigDashboard, sysdigPanel) {
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
            target: value.metricId.replace(/%25/g, '.'),
            timeAggregation: value.aggregation,
            groupAggregation: value.groupAggregation,
            segmentBy: keys.length === 1 ? keys[0].metricId.replace(/%25/g, '.') : null,
            filter: buildPanelFilter(sysdigDashboard, sysdigPanel),
            sortDirection: buildPanelSortDirection(sysdigPanel),
            pageLimit: buildPanelPageLimit(sysdigPanel),
        };
    });
}

function buildPanelSortDirection(sysdigPanel) {
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

function buildPanelPageLimit(sysdigPanel) {
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

function buildPanelFilter(sysdigDashboard, sysdigPanel) {
    return sysdigPanel.scope || sysdigDashboard.filterExpression;
}

function buildPanelGridLayout(sysdigDashboard, sysdigPanel) {
    const index = sysdigDashboard.items.indexOf(sysdigPanel);
    const layout = sysdigDashboard.layout[index];

    // keep w/h ratio similar to Sysdig by reducing height by 50%
    return {
        h: (layout.size_y) / SYSDIG_COLUMN_COUNT * GRAFANA_COLUMN_COUNT / 2,
        w: (layout.size_x) / SYSDIG_COLUMN_COUNT * GRAFANA_COLUMN_COUNT,
        x: (layout.col - 1) / SYSDIG_COLUMN_COUNT * GRAFANA_COLUMN_COUNT,
        y: (layout.row - 1) / SYSDIG_COLUMN_COUNT * GRAFANA_COLUMN_COUNT / 2
    };
}

function buildPanelYAxes(sysdigPanel) {
    const baseAxisConfig = {
        format: 'short',
        label: null,
        logBase: 1,
        min: null,
        max: null,
        show: false,
    }
    const normalizedDisplayOptions = sysdigPanel.customDisplayOptions ?
        sysdigPanel.customDisplayOptions :
        {
            yAxisLeftDomain: {
                from: null,
                to: null,
            },
        }
    ;

    return [
        // left axis
        _.assign({}, baseAxisConfig, {
            show: true,
            min: normalizedDisplayOptions.yAxisLeftDomain.from,
            max: normalizedDisplayOptions.yAxisLeftDomain.to,
            logBase: getPanelYAxisScale(normalizedDisplayOptions.yAxisScale
),
        }),
        // right axis
        _.assign({}, baseAxisConfig)
    ];
}

function getPanelYAxisScale(type) {
    switch (type) {
        case 'logarithmic2':
            return 2;
        case 'logarithmic10':
            return 2;
        case 'logarithmic32':
            return 2;
        case 'logarithmic1024':
            return 2;
        default:
            return 1;
    }
}

function httpPost(url, apiToken, data, success) {
    const xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
    xhr.open('POST', url);
    xhr.onreadystatechange = function() {
        if (xhr.readyState > 3 && xhr.status === 200) {
            if (success) {
                success(xhr.responseText);
            }
        }
    };
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', `Bearer ${apiToken}`);
    xhr.send(JSON.stringify(data));
    return xhr;
}
