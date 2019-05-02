export default class FormatterService {
    static formatLabelValue(labelValue) {
        return labelValue || FormatterService.NULL_TEXT;
    }

    static getSeriesName(dataPoint, target, isTabularFormat, keys) {
        let alias;
        if (target.alias) {
            alias = target.alias;
        } else {
            if (target.segmentBy.length === 0) {
                // single entity
                alias = '{{metric}}';
            } else if (isTabularFormat === false) {
                // non-segmented and non-table
                alias = '{{metric}} ({{segment_value}})';
            } else {
                alias = '{{segment_name}}';
            }
        }

        const pattern = /\{\{((?:metric|segment_name|segment_value))(?::(\d*))?(?::(\d*))?\}\}/g;

        return alias.replace(pattern, (match, token, startTrim, endTrim) => {
            const startTrimIndex = Number.parseInt(startTrim);
            const endTrimIndex = Number.parseInt(endTrim);
            console.log('replace', token, startTrimIndex, endTrimIndex);

            let output;
            const trimmedGroup = token.trim();
            if (trimmedGroup.startsWith('metric')) {
                output = target.target;
            }

            if (trimmedGroup.startsWith('segment_name')) {
                if (target.segmentBy.length > 0) {
                    output = target.segmentBy.join(' - ');
                } else {
                    return '[all]';
                }
            }

            if (trimmedGroup.startsWith('segment_value')) {
                if (target.segmentBy.length > 0) {
                    output = keys
                        .map((segment) => FormatterService.formatLabelValue(dataPoint[segment]))
                        .join(' - ');
                } else {
                    return '[all]';
                }
            }

            if (startTrimIndex) {
                if (endTrimIndex) {
                    output =
                        output.substring(0, startTrimIndex) +
                        '..' +
                        output.substring(output.length - endTrimIndex);
                } else {
                    output = output.substring(0, startTrimIndex) + '..';
                }
            } else if (endTrimIndex) {
                output = '..' + output.substring(output.length - endTrimIndex);
            }

            return output;
        });
    }
}

FormatterService.NULL_TEXT = 'n/a';
