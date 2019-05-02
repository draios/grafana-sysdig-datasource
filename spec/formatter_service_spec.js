import FormatterService from '../formatter_service';

describe('FormatterService', () => {
    it('format non-empty value', () => {
        expect(FormatterService.formatLabelValue('test')).to.be.equal('test');
    });

    it('format empty value', () => {
        expect(FormatterService.formatLabelValue(null)).to.be.equal('n/a');
        expect(FormatterService.formatLabelValue(undefined)).to.be.equal('n/a');
    });

    it('should get series name for non-segmented query', () => {
        expect(
            FormatterService.getSeriesName({}, { target: 'metric', segmentBy: [] }, false, [])
        ).to.be.equal('metric');
    });

    it('should get series name for segmented query', () => {
        expect(
            FormatterService.getSeriesName(
                { k: 'value' },
                { target: 'metric', segmentBy: ['segment'] },
                false,
                ['k']
            )
        ).to.be.equal('metric (value)');
    });

    it('should get series name for non-segmented table query', () => {
        expect(
            FormatterService.getSeriesName({}, { target: 'metric', segmentBy: [] }, true, [])
        ).to.be.equal('metric');
    });

    it('should get series name for segmented table query', () => {
        expect(
            FormatterService.getSeriesName(
                { k: 'value' },
                { target: 'metric', segmentBy: ['segment'] },
                true,
                ['k']
            )
        ).to.be.equal('segment');
    });

    it('should get series name with {{metric}} alias', () => {
        expect(
            FormatterService.getSeriesName(
                { k: 'value' },
                { alias: '{{metric}}', target: 'metric', segmentBy: ['segment'] },
                false,
                ['k']
            )
        ).to.be.equal('metric');
        expect(
            FormatterService.getSeriesName(
                {},
                { alias: '{{metric}}', target: 'metric', segmentBy: [] },
                false,
                []
            )
        ).to.be.equal('metric');
        expect(
            FormatterService.getSeriesName(
                { k: 'value' },
                { alias: '{{metric}}', target: 'metric', segmentBy: ['segment'] },
                true,
                ['k']
            )
        ).to.be.equal('metric');
    });

    it('should get series name with {{segment_name}} alias', () => {
        expect(
            FormatterService.getSeriesName(
                { k: 'value' },
                { alias: '{{segment_name}}', target: 'metric', segmentBy: ['segment'] },
                false,
                ['k']
            )
        ).to.be.equal('segment');
        expect(
            FormatterService.getSeriesName(
                { k: 'value' },
                { alias: '{{segment_name}}', target: 'metric', segmentBy: ['segment'] },
                true,
                ['k']
            )
        ).to.be.equal('segment');

        // fallback
        expect(
            FormatterService.getSeriesName(
                {},
                { alias: '{{segment_name}}', target: 'metric', segmentBy: [] },
                false,
                []
            )
        ).to.be.equal('[all]');
    });

    it('should get series name with {{segment_value}} alias', () => {
        expect(
            FormatterService.getSeriesName(
                { k: 'value' },
                { alias: '{{segment_value}}', target: 'metric', segmentBy: ['segment'] },
                false,
                ['k']
            )
        ).to.be.equal('value');
        expect(
            FormatterService.getSeriesName(
                { k: 'value' },
                { alias: '{{segment_value}}', target: 'metric', segmentBy: ['segment'] },
                true,
                ['k']
            )
        ).to.be.equal('value');

        // fallback
        expect(
            FormatterService.getSeriesName(
                {},
                { alias: '{{segment_value}}', target: 'metric', segmentBy: [] },
                false,
                []
            )
        ).to.be.equal('[all]');
    });

    it('should get series name with {{segment_value:x:y}} alias', () => {
        expect(
            FormatterService.getSeriesName(
                { k: 'value' },
                { alias: '{{segment_value:2}}', target: 'metric', segmentBy: ['segment'] },
                false,
                ['k']
            )
        ).to.be.equal('va..');
        expect(
            FormatterService.getSeriesName(
                { k: 'value' },
                { alias: '{{segment_value::2}}', target: 'metric', segmentBy: ['segment'] },
                false,
                ['k']
            )
        ).to.be.equal('..ue');
        expect(
            FormatterService.getSeriesName(
                { k: 'value' },
                { alias: '{{segment_value:2:2}}', target: 'metric', segmentBy: ['segment'] },
                false,
                ['k']
            )
        ).to.be.equal('va..ue');
    });
});
