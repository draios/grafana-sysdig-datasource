import FormatterService from './formatter_service';

export default class TemplatingService {
    static validateLabelValuesQuery(query) {
        if (query) {
            const labelNamePattern = '([A-Za-z][A-Za-z0-9]*(?:[\\._\\-:][a-zA-Z0-9]+)*)';
            const functionPattern = `label_values\\((?:${labelNamePattern})\\)`;
            const regex = query.match(`^${functionPattern}$`);
            if (regex) {
                return { labelName: regex[1] };
            } else {
                return null;
            }
        } else {
            return null;
        }
    }

    static validateLabelNamesQuery(query) {
        if (query) {
            const functionPattern = `label_names\\((?:(.*))\\)`;
            const regex = query.match(`^${functionPattern}$`);
            if (regex) {
                const pattern = regex[1];
                const patternRegex = new RegExp(pattern);

                return { pattern, regex: patternRegex };
            } else {
                return null;
            }
        } else {
            return null;
        }
    }

    static validateMetricsQuery(query) {
        if (query) {
            const functionPattern = `metrics\\((?:(.*))\\)`;
            const regex = query.match(`^${functionPattern}$`);
            if (regex) {
                const pattern = regex[1];
                const patternRegex = new RegExp(pattern);

                return { pattern, regex: patternRegex };
            } else {
                return null;
            }
        } else {
            return null;
        }
    }

    static replaceSingleMatch(templateSrv, input, scopedVars) {
        return templateSrv.replace(input, scopedVars);
    }

    static replace(templateSrv, input, scopedVars) {
        return templateSrv.replace(input, scopedVars, (...args) =>
            this.formatTemplateValue(...args)
        );
    }

    static formatTemplateValue(value, variable) {
        const format = this.validateLabelValuesQuery(variable.query)
            ? formatQuotedValue
            : formatValue;

        if (typeof value === 'string') {
            //
            // single selection
            //
            return format(value);
        } else {
            //
            // "all"
            //
            return value.map(format).join(', ');
        }
    }
}

function formatValue(value) {
    return parseLabelValue(value);
}

function formatQuotedValue(value) {
    const parsed = parseLabelValue(value);

    // encapsulate value within double-quotes to make the output valid with both strings and null values
    // also, null values must be returned as "null" strings
    return parsed ? `"${parsed}"` : `${parsed}`;
}

function parseLabelValue(labelValue) {
    return labelValue === FormatterService.NULL_TEXT ? null : labelValue;
}
