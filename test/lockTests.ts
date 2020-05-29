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
});
