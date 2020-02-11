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
import { QueryCtrl } from 'app/plugins/sdk';
import './css/query-editor.css!';
import { DEFAULT_PAGE_LIMIT } from './datasource';

const DEFAULT_TIME_AGGREGATIONS = [
    { value: 'timeAvg', text: 'Time average' },
    { value: 'rateOfChange', text: 'Rate of change' },
    { value: 'avg', text: 'Average' },
    { value: 'sum', text: 'Sum' },
    { value: 'min', text: 'Min' },
    { value: 'max', text: 'Max' },
    { value: 'count', text: 'Count' },
    { value: 'concat', text: 'Concat' },
    { value: 'distinct', text: 'Distinct' }
];
const DEFAULT_TIME_AGGREGATIONS_MAP = DEFAULT_TIME_AGGREGATIONS.reduce((acc, d) => {
    acc[d.value] = d;
    return acc;
}, {});

const DEFAULT_GROUP_AGGREGATIONS = [
    { value: 'avg', text: 'Average' },
    { value: 'sum', text: 'Sum' },
    { value: 'min', text: 'Min' },
    { value: 'max', text: 'Max' },
    { value: 'count', text: 'Count' },
    { value: 'concat', text: 'Concat' },
    { value: 'distinct', text: 'Distinct' }
];
const DEFAULT_GROUP_AGGREGATIONS_MAP = DEFAULT_GROUP_AGGREGATIONS.reduce((acc, d) => {
    acc[d.value] = d;
    return acc;
}, {});

export class SysdigDatasourceQueryCtrl extends QueryCtrl {
    constructor($scope, $injector) {
        super($scope, $injector);

        this.scope = $scope;
        this.target.target = this.target.target || 'cpu.used.percent';
        this.target.timeAggregation = this.target.timeAggregation || 'timeAvg';
        this.target.groupAggregation = this.target.groupAggregation || 'avg';

        if (this.target.segmentBy) {
            if (Array.isArray(this.target.segmentBy) === false) {
                this.target.segmentBy = [this.target.segmentBy];
            }
        } else {
            this.target.segmentBy = [];
        }

        this.target.sortDirection = this.target.sortDirection || 'desc';

        // enforce tabular format to be applied when the panel type is a table
        this.target.isTabularFormat = this.panel.type === 'table';

        this.segmentByItems = this.calculateSegmentByItems();
    }

    isFirstTarget() {
        return this.panel.targets.indexOf(this.target) === 0;
    }

    getLimitPlaceholder() {
        return `${DEFAULT_PAGE_LIMIT} (element count)`;
    }

    getVariableItems() {
        return this.datasource.templateSrv.variables.map((variable) => {
            const text = `\${${variable.name}}`;
            return { text, value: text };
        });
    }

    getMetricOptions(query) {
        let parseMetric;
        let options = {
            areLabelsIncluded: this.panel.type === 'table',
            match: query
        };

        if (this.panel.type !== 'table') {
            parseMetric = (m) => ({ text: m.id, value: m.id });
        } else {
            parseMetric = (m) => {
                if (m.isNumeric) {
                    return { text: `(#) ${m.id}`, value: m.id };
                } else {
                    return { text: `(A) ${m.id}`, value: m.id };
                }
            };
        }

        return this.datasource.metricFindQuery(null, options).then((data) => {
            return [...this.getVariableItems(), ...data.map(parseMetric)];
        });
    }

    getAggregationOptions() {
        return this.datasource.metricFindQuery(null, { match: this.target.target }).then((data) => {
            return data.length > 0 ? data[0] : null;
        });
    }

    getTimeAggregationOptions() {
        return this.getAggregationOptions().then((m) => {
            if (m) {
                return getAggregationList(
                    m.timeAggregations,
                    DEFAULT_TIME_AGGREGATIONS,
                    DEFAULT_TIME_AGGREGATIONS_MAP
                );
            } else {
                return [];
            }
        });
    }

    getGroupAggregationOptions() {
        return this.getAggregationOptions().then((m) => {
            if (m) {
                return getAggregationList(
                    m.groupAggregations,
                    DEFAULT_GROUP_AGGREGATIONS,
                    DEFAULT_GROUP_AGGREGATIONS_MAP
                );
            } else {
                return [];
            }
        });
    }

    getSortDirectionOptions() {
        return [
            { value: 'desc', text: 'Top' },
            { value: 'asc', text: 'Bottom' }
        ];
    }

    getSegmentByOptions(item, query) {
        return this.datasource
            .findSegmentBy(
                this.target.target,
                query !== 'select metric' && query !== '' ? query : null
            )
            .then((data) => {
                return [
                    { text: 'no segmentation', value: null },
                    ...this.getVariableItems(),
                    ...data.map((m) => ({ text: m.id, value: m.id }))
                ];
            });
    }

    removeSegmentBy(item) {
        const index = this.segmentByItems.indexOf(item);

        // remove segmentation from list
        this.target.segmentBy = [
            ...this.target.segmentBy.slice(0, index),
            ...this.target.segmentBy.slice(index + 1)
        ];

        // update UI list
        this.segmentByItems = this.calculateSegmentByItems();

        // update data
        this.panelCtrl.refresh();
    }

    addSegmentBy(item) {
        const index = this.segmentByItems.indexOf(item);

        // add new item after the one where + has been clicked
        this.segmentByItems = [
            ...this.segmentByItems.slice(0, index + 1),
            {
                isFirst: false,
                canAdd: true,
                segmentBy: null
            },
            ...this.segmentByItems.slice(index + 1)
        ];

        // don't update the UI: the change is temporary until the user picks a segmentation
    }

    onChangeParameter() {
        this.panelCtrl.refresh();

        this.target.segmentBy = this.segmentByItems
            .filter((item) => item.segmentBy !== null)
            .map((item) => item.segmentBy);

        this.segmentByItems = this.calculateSegmentByItems();
    }

    calculateSegmentByItems() {
        if (this.panel.type !== 'table' || this.isFirstTarget()) {
            if (this.target.segmentBy.length === 0) {
                return [
                    {
                        isFirst: true,
                        canAdd: false,
                        segmentBy: null
                    }
                ];
            } else {
                return this.target.segmentBy.map((segmentBy, i) => ({
                    isFirst: i === 0,
                    canAdd: i === this.target.segmentBy.length - 1,
                    segmentBy
                }));
            }
        } else {
            return [];
        }
    }

    toggleEditorMode() {
        // noop
    }
}

SysdigDatasourceQueryCtrl.templateUrl = 'partials/query.editor.html';

function getAggregationList(aggregations, knownList, knownMap) {
    return aggregations
        .map((d) => {
            const descr = knownMap[d];

            return descr || { text: d, value: d };
        })
        .sort((a, b) => {
            const indexA = knownList.indexOf(a);
            const indexB = knownList.indexOf(b);

            if (indexA !== indexB) {
                return indexA - indexB;
            } else {
                return a.text.localeCompare(b.text);
            }
        });
}
