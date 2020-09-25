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
import ApiService from './api_service';

export default class DataService {
    static async validateTimeWindow(backend, userTime) {
        return Promise.all([
            ApiService.send(backend, {
                url: `api/history/timelines`
            }),
            ApiService.send(backend, {
                url: `api/v2/history/timelines/alignments`
            })
        ]).then((responses) => {
            const requestTime = getRequestTime(responses[0].data, responses[1].data, userTime);

            if (requestTime) {
                return requestTime;
            } else {
                throw 'Unable to validate request time';
            }
        });
    }

    static async queryTimelines(backend) {
        return Promise.all([
            ApiService.send(backend, {
                url: `api/history/timelines`
            }),
            ApiService.send(backend, {
                url: `api/v2/history/timelines/alignments`
            })
        ]).then((responses) => {
            return {
                timelines: responses[0].data,
                alignments: responses[1].data
            };
        });
    }
}

function getRequestTime(timelines, alignments, userTime) {
    console.assert(userTime && userTime.from && userTime.to, 'Argument userTime is missing');
    if (!(userTime && userTime.from && userTime.to)) {
        return null;
    }

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
    const alignedFrom = Math.trunc((Math.trunc(fromUs / alignTo) * alignTo) / 1000000);
    const alignedTo = Math.trunc((Math.trunc(toUs / alignTo) * alignTo) / 1000000);

    //
    // Adjust time window according to timeline (might miss first or last portion)
    //
    const requestTime = {
        from: Math.max(alignedFrom, validTimelines[0].from / 1000000),
        to: Math.min(alignedTo, validTimelines[0].to / 1000000)
    };

    if (userTime.sampling) {
        // use the highest data resolution available to display data
        // this comes from the valid timeline with lowest sampling time
        // (NOTE: timelines.agents is assumed to be sorted by `sampling` property in ascending mode)
        requestTime.sampling = Math.trunc(validTimelines[0].sampling / 1000000);
    }

    return requestTime;
}
