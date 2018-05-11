import FormatterService from './formatter_service';

export default class TemplatingService {
    static validateLabelValuesQuery(templateSrv, query) {
        const labelNamePattern = '([A-Za-z][A-Za-z0-9]*(?:[\\._\\-:][a-zA-Z0-9]+)*)';
        const functionPattern = `label_values\\((?:${labelNamePattern})\\)`;
        const regex = query.match(`^${functionPattern}$`);
        if (regex) {
            return { labelName: regex[1] };
        } else {
            return null;
        }
    }

    static validateLabelNamesQuery(templateSrv, query) {
        const functionPattern = `label_names\\((?:(.+))\\)`;
        const regex = query.match(`^${functionPattern}$`);
        if (regex) {
            const pattern = regex[1];
            const patternRegex = new RegExp(pattern);

            return { pattern, regex: patternRegex };
        } else {
            return null;
        }
    }

    static validateMetricsQuery(templateSrv, query) {
        const functionPattern = `metrics\\((?:(.+))\\)`;
        const regex = query.match(`^${functionPattern}$`);
        if (regex) {
            const pattern = regex[1];
            const patternRegex = new RegExp(pattern);

            return { pattern, regex: patternRegex };
        } else {
            return null;
        }
    }

    static simpleReplace(templateSrv, input, scopedVars) {
        return templateSrv.replace(input, scopedVars);
    }

    static replace(templateSrv, input, scopedVars) {
        return templateSrv.replace(input, scopedVars, formatTemplateValue);
    }
}

function formatTemplateValue(value, variable) {
    const format = variable.multi === true ? formatMultiValue : formatSingleValue;

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

function formatSingleValue(value) {
    return parseLabelValue(value);
}

function formatMultiValue(value) {
    const parsed = parseLabelValue(value);

    // encapsulate value within double-quotes to make the output valid with both strings and null values
    // also, null values must be returned as "null" strings
    return parsed ? `"${parsed}"` : `${parsed}`;
}

function parseLabelValue(labelValue) {
    return labelValue === FormatterService.NULL_TEXT ? null : labelValue;
}
