import SREInstance from '../001_Base/SREInstance';
import { describe, expect, it } from 'vitest';
import { xxh3 } from '@node-rs/xxhash';
import { ICacheConnector } from '@sre/MemoryManager/Cache';
import { RedisCache } from '@sre/MemoryManager/Cache/connectors/RedisCache.class';
import { TAccessLevel, TAccessRole } from '@sre/types/ACL.types';

//import SRE, { AgentRequest } from '../../dist';
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
let redisCache: ICacheConnector = SREInstance.Cache;

const testFile = 'unit-tests/test.txt';
const testAdditionalACLMetadata = {
    hashAlgorithm: 'xxh3',
    entries: {
        [TAccessRole.Team]: {
            //hash 'team1'
            [xxh3.xxh64('team1').toString(16)]: [TAccessLevel.Read, TAccessLevel.Write],
        },
    },
};

const testFileWithMeta = 'unit-tests/test-meta.txt';
const testOriginalACLMetadata = {
    hashAlgorithm: 'none',
    entries: {
        [TAccessRole.Team]: {
            teamMeta: [TAccessLevel.Read, TAccessLevel.Write],
        },
    },
};
const testOriginalMetadata = {
    'Content-Type': 'text/plain',
    'x-amz-meta-test': 'test',
};
describe('RedisCache Tests', () => {
    it('Create Redis', async () => {
        expect(redisCache).toBeInstanceOf(RedisCache);
    });

    it('Reset Test Data', async () => {
        let error;
        try {
            await Promise.all([redisCache.delete(testFile), redisCache.delete(testFileWithMeta)]);
        } catch (e) {
            console.error(e);
            error = e;
        }
        expect(error).toBeUndefined();
    });
    it('Set Caches', async () => {
        let error;

        try {
            const res1 = await redisCache.set(testFile, 'Hello World!');
            expect(res1).toBeTruthy();

            const res2 = await redisCache.set(testFileWithMeta, 'I have metadata', testOriginalACLMetadata, testOriginalMetadata);
            expect(res2).toBeTruthy();
        } catch (e) {
            console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Does cache exist ?', async () => {
        let found = await redisCache.exists(testFile);
        expect(found).toBeTruthy();

        found = await redisCache.exists(testFileWithMeta);
        expect(found).toBeTruthy();
    });

    it('Does metadata exist ?', async () => {
        let metadata = await redisCache.getMetadata(testFileWithMeta);
        expect(metadata?.acl).toEqual(testOriginalACLMetadata);
    });

    it('Set ACL Metadata', async () => {
        //we set the metadata for the file created in the previous test
        await redisCache.setACL(testFile, testAdditionalACLMetadata);
    });

    it('Are Metadata ACL valid', async () => {
        const accessRights = await redisCache.getACL(testFile);

        expect(accessRights).toEqual(testAdditionalACLMetadata);
    });

    it('Check Access Rights => Grant', async () => {
        try {
            const accessCheck = await redisCache.hasAccess({
                resourceId: testFile,
                candidate: {
                    role: TAccessRole.Team,
                    id: 'team1',
                },
                level: TAccessLevel.Write,
            });

            expect(accessCheck).toBeTruthy();
        } catch (e) {
            expect(e).toBeUndefined();
        }
    });

    it('Check Access Rights => Refuse', async () => {
        try {
            const wrongRole = await redisCache.hasAccess({
                resourceId: testFile,
                candidate: {
                    role: TAccessRole.Agent, //wrong role
                    id: 'team1',
                },
                level: TAccessLevel.Write,
            });
            const wrongTeam = await redisCache.hasAccess({
                resourceId: testFile,
                candidate: {
                    role: TAccessRole.Team,
                    id: 'team2', //wrong team
                },
                level: TAccessLevel.Write,
            });

            const wrongResource = await redisCache.hasAccess({
                resourceId: testFileWithMeta, // file exists but does not belong to the team1
                candidate: {
                    role: TAccessRole.Team,
                    id: 'team1',
                },
                level: TAccessLevel.Write,
            });

            const nonExistingResource = await redisCache.hasAccess({
                resourceId: 'does-not-exist', // non existing resource
                candidate: {
                    role: TAccessRole.Team,
                    id: 'team1',
                },
                level: TAccessLevel.Write,
            });

            expect(wrongRole).toBeFalsy();
            expect(wrongTeam).toBeFalsy();
            expect(wrongResource).toBeFalsy();
            expect(nonExistingResource).toBeFalsy();
        } catch (e) {
            expect(e).toBeUndefined();
        }
    });

    it('Read keys from S3Storage', async () => {
        const data = await redisCache.get(testFile);
        const strData = data?.toString();
        expect(strData).toEqual('Hello World!');

        const dataWithMeta = await redisCache.get(testFileWithMeta);
        const strDataWithMeta = dataWithMeta?.toString();
        expect(strDataWithMeta).toEqual('I have metadata');
    });

    it('Delete key from S3Storage', async () => {
        let error;

        try {
            await redisCache.delete(testFile);
            //redisCache.delete(testFileWithMeta);
        } catch (e) {
            console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('The key should be deleted', async () => {
        const found = await redisCache.exists(testFile);
        expect(found).toBeFalsy();
    });

    it('Set and verify Cache TTL', async () => {
        await redisCache.updateTTL(testFileWithMeta, 5);
        await delay(3000);
        const ttl = await redisCache.getTTL(testFileWithMeta);
        expect(ttl).toBeLessThanOrEqual(5);
    });
    it('Cache not expired yet', async () => {
        const exists = await redisCache.exists(testFileWithMeta);
        expect(exists).toBeTruthy();
    });

    it('Cache expired', async () => {
        await delay(3000); //wait for expiration
        const exists = await redisCache.exists(testFileWithMeta);
        expect(exists).toBeFalsy();
    });
    it('Metadata removed after cache expiration', async () => {
        const metadata = await redisCache.getMetadata(testFileWithMeta);
        expect(metadata).toEqual({});
    });
});
