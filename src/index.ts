import * as grpc from 'grpc';
import pb from 'promise-breaker';
import promiseTools from 'promise-tools';
import { LockClient } from './client/etcd/etcdserver/api/v3lock/v3lockpb/v3lock_grpc_pb';
import {
    LockRequest,
    LockResponse,
    UnlockRequest,
} from './client/etcd/etcdserver/api/v3lock/v3lockpb/v3lock_pb';
import { KVClient, LeaseClient } from './client/etcd/etcdserver/etcdserverpb/rpc_grpc_pb';
import {
    DeleteRangeRequest,
    DeleteRangeResponse,
    LeaseGrantRequest,
    LeaseGrantResponse,
    LeaseKeepAliveRequest,
    LeaseKeepAliveResponse,
    LeaseRevokeRequest,
    PutRequest,
    RangeRequest,
    RangeResponse,
} from './client/etcd/etcdserver/etcdserverpb/rpc_pb';

const LEASE_RETRY_COUNT = 1000;
const MIN_LEASE_NUMBER = 100000;

function sample<T>(arr: T[]): T {
    const index = Math.floor(Math.random() * arr.length);
    return arr[index];
}

export class EtcdClient {
    private hosts: string[];
    private credentials: grpc.ChannelCredentials;
    private _nextLeaseNumber: number = Math.max(
        Math.floor((Number.MAX_SAFE_INTEGER / 2) * Math.random()),
        MIN_LEASE_NUMBER
    );

    constructor(options: { hosts: string[] } | string) {
        if (typeof options === 'string') {
            this.hosts = [options];
        } else {
            this.hosts = options.hosts;
        }
        this.credentials = grpc.credentials.createInsecure();
    }

    private async _getLease(leaseClient: LeaseClient, ttl: number) {
        return await promiseTools.retry({ times: LEASE_RETRY_COUNT }, async () => {
            // Pick a lease ID.  We can't just leave this as 0 and let etcd
            // pick a lease ID for us, because it might pick a number bigger
            // than `Number.MAX_SAFE_INTEGER`, and then none of this will work.
            const leaseId = this._nextLeaseNumber++;
            if (this._nextLeaseNumber >= Number.MAX_SAFE_INTEGER) {
                this._nextLeaseNumber = MIN_LEASE_NUMBER;
            }

            // Obtain a lease
            const leaseRequest = new LeaseGrantRequest();
            leaseRequest.setTtl(ttl);
            leaseRequest.setId(leaseId);
            const leaseResponse: LeaseGrantResponse = await pb.call(
                (done: (error: grpc.ServiceError | null, response: LeaseGrantResponse) => void) =>
                    leaseClient.leaseGrant(leaseRequest, done)
            );

            return leaseResponse;
        });
    }

    private _keepLeaseAlive(leaseClient: LeaseClient, leaseId: number, ttl: number) {
        let alive = true;

        const keepAlive = new LeaseKeepAliveRequest();
        keepAlive.setId(leaseId);
        const stream = leaseClient.leaseKeepAlive();

        stream.on('data', (_data: LeaseKeepAliveResponse) => {
            // console.log(`Got keepalive for ${data.getId()}`);
        });
        stream.on('error', (err) => {
            // TODO: How do we publish this error?
            stream.destroy(err);
            alive = false;
        });

        function sendKeepAlive() {
            if (!alive) {
                return;
            }
            stream.write(keepAlive, {}, () => {
                setTimeout(sendKeepAlive, (ttl * 1000) / 2);
            });
        }

        sendKeepAlive();

        return {
            stream,
            stop: (): void => {
                alive = false;
                stream.end();
                stream.destroy();
            },
        };
    }

    async withLease(
        options: { ttl?: number; host?: string },
        fn: (leaseId: number) => void | Promise<void>
    ): Promise<void>;
    async withLease(fn: (leaseId: number) => void | Promise<void>): Promise<void>;

    async withLease(
        p1: { ttl?: number; host?: string } | ((leaseId: number) => void | Promise<void>),
        p2?: (leaseId: number) => void | Promise<void>
    ): Promise<void> {
        const fn = p2 ? p2 : typeof p1 === 'function' ? p1 : () => void 0;
        const options = typeof p1 === 'function' ? {} : p1;
        const ttl = options.ttl || 30;
        const host = options.host || sample(this.hosts);

        const leaseClient = new LeaseClient(host, this.credentials);
        const leaseResponse = await this._getLease(leaseClient, ttl);

        // Keep automatically renewing the lease in the background.
        const { stop } = this._keepLeaseAlive(leaseClient, leaseResponse.getId(), ttl);

        try {
            await fn(leaseResponse.getId());
        } finally {
            stop();
            const leaseRevokeRequest = new LeaseRevokeRequest();
            leaseRevokeRequest.setId(leaseResponse.getId());
            await pb.call((done: any) => leaseClient.leaseRevoke(leaseRevokeRequest, done));
        }
    }

    async withLock(
        options: string | { name: string; ttl?: number },
        fn: () => void | Promise<void>
    ): Promise<void> {
        const name = typeof options === 'string' ? options : options.name;
        const ttl = typeof options === 'string' ? undefined : options.ttl;
        const host = sample(this.hosts);

        await this.withLease({ ttl, host }, async (leaseId) => {
            const lockClient = new LockClient(host, this.credentials);
            const lockRequest = new LockRequest();
            lockRequest.setName(Buffer.from(name, 'utf-8'));
            lockRequest.setLease(leaseId);
            const lockResponse: LockResponse = await pb.call((done: any) =>
                lockClient.lock(lockRequest, done)
            );

            try {
                await fn();
            } finally {
                const unlockRequest = new UnlockRequest();
                unlockRequest.setKey(lockResponse.getKey());
                await pb.call((done: any) => lockClient.unlock(unlockRequest, done));
            }
        });
    }

    async kvPut(key: string, value: string): Promise<void> {
        const host = sample(this.hosts);
        const client = new KVClient(host, this.credentials);
        const putRequest = new PutRequest();
        putRequest.setKey(Buffer.from(key, 'utf-8'));
        putRequest.setValue(Buffer.from(value, 'utf-8'));
        await pb.call((done: any) => client.put(putRequest, done));
    }

    async kvGet(key: string): Promise<string | undefined> {
        const host = sample(this.hosts);

        const client = new KVClient(host, this.credentials);
        const getRequest = new RangeRequest();
        getRequest.setKey(Buffer.from(key, 'utf-8'));
        const result: RangeResponse = await pb.call((done: any) => client.range(getRequest, done));
        const list = result.getKvsList();
        if (list[0]) {
            const val = list[0].getValue();
            if (typeof val === 'string') {
                return val;
            } else {
                return Buffer.from(val).toString('utf-8');
            }
        } else {
            return undefined;
        }
    }

    async kvDelete(key: string): Promise<string | undefined> {
        const host = sample(this.hosts);

        const client = new KVClient(host, this.credentials);
        const deleteRequest = new DeleteRangeRequest();
        deleteRequest.setKey(Buffer.from(key, 'utf-8'));
        const result: DeleteRangeResponse = await pb.call((done: any) =>
            client.deleteRange(deleteRequest, done)
        );
        const list = result.getPrevKvsList();
        if (list[0]) {
            const val = list[0].getValue();
            if (typeof val === 'string') {
                return val;
            } else {
                return Buffer.from(val).toString('utf-8');
            }
        } else {
            return undefined;
        }
    }
}
