import { expect } from 'chai';
import 'mocha';
import * as promiseTools from 'promise-tools';
import { EtcdClient } from '../src';

describe('KV', function () {
    it('should put/get/delete a key', async function () {
        const client = new EtcdClient({ hosts: ['localhost:2379'] });

        await client.kvPut('/testkey', 'foobar');
        const result = await client.kvGet('/testkey');
        expect(result, 'get result').to.equal('foobar');

        await client.kvDelete('/testkey');
        const result2 = await client.kvGet('/testkey');
        expect(result2, 'should be undefined after a delete').to.be.undefined;
    });

    it('should watch a value', async function () {
        const client = new EtcdClient({ hosts: ['localhost:2379'] });

        let latestVal: string | undefined;
        const watch = client.kvWatch('/testwatch');
        watch.on('put', (val) => (latestVal = val));

        await client.kvPut('/testwatch', 'value');

        await promiseTools.whilst(
            () => latestVal === undefined,
            () => promiseTools.delay(10)
        );
        expect(latestVal).to.equal('value');

        await client.kvDelete('/testwatch');

        await promiseTools.whilst(
            () => latestVal !== undefined,
            () => promiseTools.delay(10)
        );
        expect(latestVal).to.be.undefined;

        watch.end();

        await client.kvDelete('/testwatch');
    });
});
