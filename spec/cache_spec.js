import Cache from '../cache';
import Q from 'q';

describe('Cache', () => {
    it('should store items', async () => {
        const cache = new Cache(Q);

        await cache.get('test-1', () => 'res-1');
        const res1 = await cache.get('test-1');
        expect(res1).to.be.equal('res-1');

        await cache.get('test-2', () => 'res-2');
        const res2 = await cache.get('test-2');
        expect(res2).to.be.equal('res-2');
    });

    it('should store up to MAX items', async () => {
        const cache = new Cache(Q, 2);

        await cache.get('test-1', () => 'res-1');
        await cache.get('test-2', () => 'res-2');
        await cache.get('test-3', () => 'res-3');
        await cache.get('test-4', () => 'res-4');

        const array = cache.toArray();
        expect(array).to.have.length(2);
        expect(array[0]).to.be.equal('res-3');
        expect(array[1]).to.be.equal('res-4');
    });

    it('should store up to MAX recently read items', async () => {
        const cache = new Cache(Q, 2);

        await cache.get('test-1', () => 'res-1');
        await cache.get('test-2', () => 'res-2');
        await cache.get('test-1');
        await cache.get('test-4', () => 'res-4');

        const array = cache.toArray();
        expect(array).to.have.length(2);
        expect(array[0]).to.be.equal('res-1');
        expect(array[1]).to.be.equal('res-4');
    });

    it('should evict expired items', async () => {
        const cache = new Cache(Q, 10, 10);

        cache.now = () => 0;
        await cache.get('test-1', () => 'res-1');

        cache.now = () => 10;
        await cache.get('test-2', () => 'res-2');

        cache.now = () => 20;
        await cache.get('test-3', () => 'res-3');

        const array = cache.toArray();
        expect(array).to.have.length(2);
        expect(array[0]).to.be.equal('res-2');
        expect(array[1]).to.be.equal('res-3');
    });

    it('should evict expired items', async () => {
        const cache = new Cache(Q, 10, 10);

        cache.now = () => 0;
        await cache.get('test-1', () => 'res-1');

        cache.now = () => 10;
        await cache.get('test-2', () => 'res-2');

        cache.now = () => 20;
        await cache.get('test-3', () => 'res-3');

        const array = cache.toArray();
        expect(array).to.have.length(2);
        expect(array[0]).to.be.equal('res-2');
        expect(array[1]).to.be.equal('res-3');
    });

    it('should evict expired items based on creation time', async () => {
        const cache = new Cache(Q, 10, 10);

        cache.now = () => 0;
        await cache.get('test-1', () => 'res-1');

        cache.now = () => 10;
        await cache.get('test-1');

        cache.now = () => 20;
        await cache.get('test-3', () => 'res-3');

        const array = cache.toArray();
        expect(array).to.have.length(1);
        expect(array[0]).to.be.equal('res-3');
    });
});
