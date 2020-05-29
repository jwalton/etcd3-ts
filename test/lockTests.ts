import { expect } from 'chai';
import 'mocha';
import * as promiseTools from 'promise-tools';
import { EtcdClient } from '../src';

describe('lock', function () {
    it('should aquire a lock', async function () {
        const client = new EtcdClient({ hosts: ['localhost:2379'] });

        await client.withLock('mylock', async () => {
            await promiseTools.delay(10);
        });
    });

    it('should return a value from the lock fn', async function () {
        const client = new EtcdClient({ hosts: ['localhost:2379'] });

        const val = await client.withLock('mylock', async () => {
            return 10;
        });

        expect(val).to.equal(10);
    });
});
