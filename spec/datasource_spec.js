import { SysdigDatasource } from '../datasource';
import Q from 'q';

describe('SysdigDatasource', () => {
    var ctx = {};

    beforeEach(() => {
        ctx.$q = Q;
        ctx.backendSrv = {};
        ctx.templateSrv = {};
        ctx.ds = new SysdigDatasource({}, ctx.$q, ctx.backendSrv, ctx.templateSrv);
    });

    it('should return an empty array when no targets are set', async () => {
        const result = await ctx.ds.query({ targets: [] });
        expect(result.data).to.have.length(0);
    });
});
