import { xxh3 } from '@node-rs/xxhash';
import { describe, expect, it } from 'vitest';

import { S3Storage } from '@sre/IO/Storage/connectors/S3Storage.class';
import { TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
//import SRE, { AgentRequest } from '../../dist';
import { StorageConnector } from '@sre/IO/Storage/StorageConnector';
import SREInstance from '../001_Base/SREInstance';

const s3Storage: StorageConnector = SREInstance.Storage;

const testFile = 'unit-tests/test.txt';
const testAdditionalACLMetadata = {
    hashAlgorithm: 'xxh3',
    entries: {
        [TAccessRole.Team]: {
            //hash 'team1'
            [xxh3.xxh64('team1').toString(16)]: [TAccessLevel.Read, TAccessLevel.Write],
        },
        [TAccessRole.Agent]: {
            //hash 'team1'
            [xxh3.xxh64('agent1').toString(16)]: [TAccessLevel.Owner],
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

describe('S3 Storage Tests', () => {
    it('Create S3Storage', async () => {
        const s3Storage: StorageConnector = SREInstance.Storage;
        expect(s3Storage).toBeInstanceOf(S3Storage);
    });

    it('Read Legacy Metadata', async () => {
        const legacyFile = 'teams/9/logs/closz0vak00009tsctm7e8xzs/2024-05-12/LLW3FLB08WIE';
        const metadata = await s3Storage.getMetadata(legacyFile);

        expect(metadata).toBeDefined();
    });

    it('Write files in S3Storage', async () => {
        let error;

        try {
            await Promise.all([
                s3Storage.write(testFile, 'Hello World!'),
                s3Storage.write(testFileWithMeta, 'I have metadata', testOriginalACLMetadata, testOriginalMetadata),
            ]);
        } catch (e) {
            console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Does the files exist ?', async () => {
        const files = [testFile, testFileWithMeta];

        const promises = files.map((file) => s3Storage.exists(file));

        const results = await Promise.all(promises);

        expect(results).toEqual([true, true]);
    });

    it('Is Metadata present', async () => {
        const metadata = await s3Storage.getMetadata(testFileWithMeta);

        expect(metadata).toBeDefined();
    });

    it('Set ACL Metadata', async () => {
        let error;
        try {
            //we set the metadata for the file created in the previous test
            await s3Storage.setACL(testFile, testAdditionalACLMetadata);
        } catch (e) {
            console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Does ACL metadata exist ?', async () => {
        let metadata: any = await s3Storage.getACL(testFile);

        expect(metadata).toEqual(testAdditionalACLMetadata);
    });

    it('Are Metadata ACL valid', async () => {
        const accessRights = await s3Storage.getACL(testFile);

        expect(accessRights).toEqual(testAdditionalACLMetadata);
    });

    it('Check Simple Access Rights => Grant', async () => {
        try {
            const accessCheck = await s3Storage.getAccess({
                resourceId: testFile,
                candidate: {
                    role: TAccessRole.Team,
                    id: 'team1',
                },
                level: TAccessLevel.Write,
            });

            expect(accessCheck).toEqual(true);
        } catch (e) {
            expect(e).toBeUndefined();
        }
    });

    it('Check Extended Access Rights => Grant', async () => {
        try {
            const accessCheck = await s3Storage.getAccess({
                resourceId: testFile,
                candidate: {
                    role: TAccessRole.Agent,
                    id: 'agent1',
                },
                level: TAccessLevel.Read,
            });

            expect(accessCheck).toBeTruthy();
        } catch (e) {
            expect(e).toBeUndefined();
        }
    });

    it('Check Access Rights => Refuse', async () => {
        try {
            const wrongRole = await s3Storage.getAccess({
                resourceId: testFile,
                candidate: {
                    role: TAccessRole.Agent, //wrong role
                    id: 'team1',
                },
                level: TAccessLevel.Write,
            });
            const wrongTeam = await s3Storage.getAccess({
                resourceId: testFile,
                candidate: {
                    role: TAccessRole.Team,
                    id: 'team2', //wrong team
                },
                level: TAccessLevel.Write,
            });

            const wrongResource = await s3Storage.getAccess({
                resourceId: testFileWithMeta, // file exists but does not belong to the team1
                candidate: {
                    role: TAccessRole.Team,
                    id: 'team1',
                },
                level: TAccessLevel.Write,
            });

            const nonExistingResource = await s3Storage.getAccess({
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

    it('Read files from S3Storage', async () => {
        const data = await s3Storage.read(testFile);
        const strData = data.toString();
        expect(strData).toEqual('Hello World!');

        const dataWithMeta = await s3Storage.read(testFileWithMeta);
        const strDataWithMeta = dataWithMeta.toString();
        expect(strDataWithMeta).toEqual('I have metadata');
    });

    it('Delete files from S3Storage', async () => {
        let error;

        try {
            await Promise.all([s3Storage.delete(testFile), s3Storage.delete(testFileWithMeta)]);
        } catch (e) {
            console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('The file should be deleted', async () => {
        const files = [testFile, testFileWithMeta];

        const promises = files.map((file) => s3Storage.exists(file));

        const results = await Promise.all(promises);

        expect(results).toEqual([false, false]);
    });
});
