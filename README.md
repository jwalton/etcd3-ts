# etcd3-ts

[![NPM version](https://badge.fury.io/js/etcd3-ts.svg)](https://npmjs.org/package/etcd3-ts)
[![Build Status](https://travis-ci.org/jwalton/etcd3-ts.svg)](https://travis-ci.org/jwalton/etcd3-ts)
[![Coverage Status](https://coveralls.io/repos/jwalton/etcd3-ts/badge.svg)](https://coveralls.io/r/jwalton/etcd3-ts)

This is an etcd client. It's very incomplete, but it has support for basic
key-value operations, watches, and locks.

**Note that this is no longer maintained.**  This was written because [etcd3](https://github.com/microsoft/etcd3) was not being maintained, but that library seems to have moved into the microsoft github account, so hopefully we'll see more frequent updates to it.  And if not, this can always be resurrected.

## Usage

```sh
$ npm install etcd3-ts
```

Then in your code:

```ts
import { EtcdClient } from 'etcd3-ts';
import { delay } from 'promise-tools';

const client = new EtcdClient('localhost:2379');

async myFunction() {
  await client.withLock('mylock', async () => {
    console.log('Do work here...');
    await delay(2000);
  });

  await client.kvPut('key', 'value');
  const value = await client.kvGet('key');
  await client.kvDelete('key');
}
```

## How to build this?

Checkout etcd, and then run `genGrpc.sh`.

```sh
$ git clone git@github.com:etcd-io/etcd.git
$ cd etcd
$ git checkout v3.4.9
$ go mod vendor
$ cd ..
$ ./scripts/genGrpc.sh
$ npm run build
```
