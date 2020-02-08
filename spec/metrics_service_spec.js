import MetricsService from '../metrics_service';

describe('MetricsService', () => {
    let backendMock;
    let backendRequestArgs;
    let backendResponseStubs;

    beforeEach(() => {
        MetricsService.reset();

        backendRequestArgs = [];
        backendResponseStubs = [];

        backendMock = {
            url: 'dummy://localhost',
            apiToken: '42',
            backendSrv: {
                datasourceRequest(options) {
                    backendRequestArgs.push(options);

                    return new Promise((resolve) =>
                        resolve(backendResponseStubs[backendRequestArgs.length - 1])
                    );
                }
            }
        };
    });

    it('should set proper default GET parameters', async () => {
        backendResponseStubs = [
            {
                data: {
                    metricDescriptors: []
                }
            }
        ];

        const metrics = await MetricsService.findMetrics(backendMock, {});
        expect(metrics).to.be.an('array');
        expect(metrics).to.have.length(0);

        expect(backendRequestArgs).to.have.length(1);
        expect(backendRequestArgs[0].url).to.match(/filter=&/);
    });

    it('should not make the same request twice', async () => {
        backendResponseStubs = [
            {
                data: {
                    metricDescriptors: []
                }
            }
        ];

        await MetricsService.findMetrics(backendMock, {});
        await MetricsService.findMetrics(backendMock, {});

        expect(backendRequestArgs).to.have.length(1);
    });

    it('should set filter when match is specified', async () => {
        backendResponseStubs = [
            {
                data: {
                    metricDescriptors: []
                }
            }
        ];

        await MetricsService.findMetrics(backendMock, { match: 'test' });

        expect(backendRequestArgs[0].url).to.match(/filter=test&/);
    });

    it('should use separate caches for different backends', async () => {
        backendResponseStubs = [
            {
                data: {
                    metricDescriptors: []
                }
            },
            {
                data: {
                    metricDescriptors: []
                }
            }
        ];

        await Promise.all([
            MetricsService.findMetrics(backendMock, { match: 'test' }),
            MetricsService.findMetrics(
                Object.assign({}, backendMock, { url: 'dummy://localhost-2' }),
                { match: 'test' }
            )
        ]);

        expect(backendRequestArgs).to.have.length(2);
        expect(backendRequestArgs[0].url).not.to.be.equal(backendRequestArgs[1].url);
    });
});
