import { SysdigDatasource } from '../datasource';

describe('SysdigDatasource', () => {
    var ctx = {};

    beforeEach(() => {
        ctx.backendSrv = {};
        ctx.templateSrv = {};
        ctx.ds = new SysdigDatasource({}, ctx.backendSrv, ctx.templateSrv);
    });

    it('should return an empty array when no targets are set', async () => {
        const result = await ctx.ds.query({ targets: [] });
        expect(result.data).to.have.length(0);
    });
});
