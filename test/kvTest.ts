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

    it('should work if host starts with http://', async function () {
        const client = new EtcdClient({ hosts: ['http://localhost:2379'] });

        await client.kvPut('/testkey', 'foobar');
        const result = await client.kvGet('/testkey');
        expect(result, 'get result').to.equal('foobar');

        await client.kvDelete('/testkey');
    });

    it('should delete a key that does not exist', async function () {
        const client = new EtcdClient({ hosts: ['localhost:2379'] });
        const value = await client.kvDelete('/i-do-not-exist');
        expect(value).to.be.undefined;
    });

    it('should watch a value', async function () {
        const client = new EtcdClient({ hosts: ['localhost:2379'] });

        let latestVal: string | undefined;
        let callCount = 0;
        const watch = client.kvWatch('/testwatch');
        watch.on('put', (val) => {
            latestVal = val;
            callCount++;
        });

        // Wait for initial call
        await promiseTools.whilst(
            () => callCount == 0,
            () => promiseTools.delay(10)
        );

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

    it('should call the watch function for a value immediately', async function () {
        const client = new EtcdClient({ hosts: ['localhost:2379'] });

        await client.kvPut('/testwatch', 'value');

        let latestVal: string | undefined;
        const watch = client.kvWatch('/testwatch');
        watch.on('put', (val) => (latestVal = val));

        await promiseTools.whilst(
            () => latestVal === undefined,
            () => promiseTools.delay(10)
        );
        expect(latestVal).to.equal('value');

        watch.end();

        await client.kvDelete('/testwatch');
    });

    it('should watch a key that does not exist', async function () {
        let called = false;
        const client = new EtcdClient({ hosts: ['localhost:2379'] });
        const watch = await client.kvWatch('/i-do-not-exist');
        watch.on('put', () => (called = true));

        await promiseTools.whilst(
            () => !called,
            () => promiseTools.delay(10)
        );
        watch.end();
    });
});
