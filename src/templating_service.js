import FormatterService from './formatter_service';

export default class TemplatingService {
    static validateLabelValuesQuery(query) {
        const parsed = parseFunction(query, 'label_values');
        if (parsed) {
            return parseOptions(parsed.options, 'label_values');
        } else {
            return null;
        }
    }

    static validateLabelNamesQuery(query) {
        const parsed = parseFunction(query, 'label_names');
        if (parsed) {
            return { pattern: parsed.options, regex: new RegExp(parsed.options) };
        } else {
            return null;
        }
    }

    static validateMetricsQuery(query) {
        const parsed = parseFunction(query, 'metrics');
        if (parsed) {
            return { pattern: parsed.options, regex: new RegExp(parsed.options) };
        } else {
            return null;
        }
    }

    static resolveQueryVariables(query, templateSrv) {
        if (query) {
            return this.replace(templateSrv, query, null);
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

function parseFunction(value, functionName) {
    if (value) {
        const functionPattern = `${functionName}\\((?:(.*))\\)`;
        const regex = value.match(`^${functionPattern}$`);
        if (regex) {
            const options = regex[1];

            return { options };
        } else {
            return null;
        }
    } else {
        return null;
    }
}

function parseOptions(value, functionName) {
    switch (functionName) {
        case 'label_values': {
            const parseConfiguration = {
                namelessOption: {
                    name: 'labelName',
                    pattern: '([A-Za-z][A-Za-z0-9]*(?:[\\._\\-:][a-zA-Z0-9]+)*)'
                },
                namedOptions: [
                    {
                        name: 'filter',
                        patterns: [`"([^"]+)"`, `'([^']+)'`],
                        validate: (value) => value.trim(),
                        defaultValue: null
                    },
                    {
                        name: 'from',
                        pattern: '(\\d+)',
                        validate: (value) => Number(value),
                        defaultValue: 0
                    },
                    {
                        name: 'to',
                        pattern: '(\\d+)',
                        validate: (value) => Number(value),
                        defaultValue: undefined
                    },
                    {
                        name: 'limit',
                        pattern: '(\\d+)',
                        validate: (value) => Number(value),
                        defaultValue: 99
                    }
                ],
                validate: (options) => {
                    // to overrides limit
                    if (options.to !== undefined && options.limit !== undefined) {
                        delete options.limit;
                    }

                    // to is always derived from from + limit
                    if (options.limit !== undefined) {
                        options.to = options.from + options.limit;
                        delete options.limit;
                    }

                    // ensure both from+to are always set
                    if (options.from !== undefined && options.to === undefined) {
                        options.to = options.from + 99;
                    } else if (options.to !== undefined && options.from === undefined) {
                        options.from = options.to - 99;
                    }

                    // don't let download too much data, but not even too few
                    if (options.from !== undefined && options.to !== undefined) {
                        options.from = Math.max(options.from, 0);

                        options.to = Math.min(options.to, options.from + 1000);
                        options.to = Math.max(options.to, options.from + 1);
                    }

                    return options;
                }
            };

            const functionMatch = value.match(
                `^${parseConfiguration.namelessOption.pattern}(?:\\s*,\\s*(.+))?$`
            );

            if (functionMatch) {
                const parsedOptions = {};
                parsedOptions[parseConfiguration.namelessOption.name] = functionMatch[1];

                const namedOptions = functionMatch[2];
                const namedOptionsPattern = parseConfiguration.namedOptions
                    .reduce((acc, option) => {
                        if (option.patterns) {
                            return [
                                ...acc,
                                ...option.patterns.map((pattern) => ({
                                    name: option.name,
                                    pattern
                                }))
                            ];
                        } else {
                            return [...acc, option];
                        }
                    }, [])
                    .map((option) => {
                        return `(?:(${option.name})=${option.pattern})`;
                    })
                    .join('|');
                const namedOptionsRegex = RegExp(namedOptionsPattern, 'g');
                const namedOptionsValidators = parseConfiguration.namedOptions.reduce((acc, d) => {
                    acc[d.name] = d.validate;
                    return acc;
                }, {});

                let matches;
                while ((matches = namedOptionsRegex.exec(namedOptions)) !== null) {
                    for (let i = 1; i < matches.length; i = i + 2) {
                        if (matches[i]) {
                            parsedOptions[matches[i]] = namedOptionsValidators[matches[i]](
                                matches[i + 1]
                            );
                        }
                    }
                }

                parseConfiguration.namedOptions.forEach((option) => {
                    if (parsedOptions[option.name] === undefined) {
                        parsedOptions[option.name] = option.defaultValue;
                    }
                });

                const validatedOptions = parseConfiguration.validate(parsedOptions);

                return validatedOptions;
            } else {
                return null;
            }
        }

        default:
            console.assert(
                false,
                'Options are not supported for any variable function other than "label_values"'
            );
            return null;
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
