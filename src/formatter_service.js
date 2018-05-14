export default class FormatterService {
    static formatLabelValue(labelValue) {
        return labelValue || FormatterService.NULL_TEXT;
    }
}

FormatterService.NULL_TEXT = 'n/a';
