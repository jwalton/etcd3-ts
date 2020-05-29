import 'mocha';
import { expect } from 'chai';
import { EtcdClient } from '../src';

describe('KV', function() {
    it('should put/get/delete a key', async function() {
        const client = new EtcdClient('localhost:2379');

        await client.kvPut('testkey', 'foobar');
        const result = await client.kvGet('testkey');
        expect(result, 'get result').to.equal('foobar');

        await client.kvDelete('testkey');
        const result2 = await client.kvGet('testkey');
        expect(result2, 'should be undefined after a delete').to.be.undefined;

    });
});
