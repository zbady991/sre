import { xxh3 } from '@node-rs/xxhash';
import { describe, expect, it } from 'vitest';

import { S3Storage } from '@sre/IO/Storage/connectors/S3Storage.class';
import { TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
//import SRE, { AgentRequest } from '../../dist';
import { StorageConnector } from '@sre/IO/Storage/StorageConnector';
import SREInstance from '../001_Base/SREInstance';
import { ACL, AccessCandidate, AccessRequest } from '@sre/Security/ACL.helper';

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

const defaultAcRequest = AccessCandidate.agent('agent-123456').makeRequest().resTeam('default');

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
        const req = AccessRequest.from(defaultAcRequest).read(legacyFile).resTeam('9');
        const resACL = await s3Storage.getResourceACL(req);

        //const metadata = await s3Storage.getMetadata(legacyFile, req);

        expect(resACL.migrated).toBe(true);
    });

    it('Write a file in S3Storage', async () => {
        let error;

        try {
            await s3Storage.write(testFile, 'Hello World!', AccessRequest.from(defaultAcRequest).write(testFile));
        } catch (e) {
            console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Write a file with metadata in S3Storage', async () => {
        let error;

        try {
            await s3Storage.write(
                testFileWithMeta,
                'I have metadata',
                AccessRequest.from(defaultAcRequest).write(testFileWithMeta),
                testOriginalACLMetadata,
                testOriginalMetadata
            );
        } catch (e) {
            console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Does the files exist ?', async () => {
        const files = [testFile, testFileWithMeta];

        const promises = files.map((file) => s3Storage.exists(file, AccessRequest.from(defaultAcRequest).read(file)));

        const results = await Promise.all(promises);

        expect(results).toEqual([true, true]);
    });

    it('Is Metadata present', async () => {
        const metadata = await s3Storage.getMetadata(testFileWithMeta, AccessRequest.from(defaultAcRequest).read(testFileWithMeta));

        expect(metadata).toBeDefined();
    });

    it('Set ACL Metadata', async () => {
        let error;
        try {
            //we set the metadata for the file created in the previous test
            await s3Storage.setACL(testFile, testAdditionalACLMetadata, AccessRequest.from(defaultAcRequest).write(testFile));
        } catch (e) {
            console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Does ACL metadata exist ?', async () => {
        //here we need to build an access request for the agent1 because we changed the ACL metadata to have agent1 as owner
        const req = AccessCandidate.agent('agent1').makeRequest().resTeam('team1').read(testFile);
        let metadata: any = await s3Storage.getACL(testFile, req);

        expect(metadata).toEqual(testAdditionalACLMetadata);
    });

    it('Are Metadata ACL valid', async () => {
        const req = AccessCandidate.agent('agent1').makeRequest().resTeam('team1').read(testFile);
        const accessRights = await s3Storage.getACL(testFile, req);

        expect(accessRights).toEqual(testAdditionalACLMetadata);
    });

    it('Read files from S3Storage', async () => {
        const req = AccessCandidate.agent('agent1').makeRequest().resTeam('team1').read(testFile);
        const data = await s3Storage.read(testFile, req);
        const strData = data.toString();
        expect(strData).toEqual('Hello World!');

        const dataWithMeta = await s3Storage.read(testFileWithMeta, AccessRequest.from(defaultAcRequest).read(testFileWithMeta));
        const strDataWithMeta = dataWithMeta.toString();
        expect(strDataWithMeta).toEqual('I have metadata');
    });

    it('Delete files from S3Storage', async () => {
        let error;

        try {
            await Promise.all([
                s3Storage.delete(testFile, AccessCandidate.agent('agent1').makeRequest().resTeam('team1').write(testFile)),
                ,
                s3Storage.delete(testFileWithMeta, AccessRequest.from(defaultAcRequest).write(testFileWithMeta)),
            ]);
        } catch (e) {
            console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('The file should be deleted', async () => {
        const files = [testFile, testFileWithMeta];

        const promises = files.map((file) => s3Storage.exists(file, AccessRequest.from(defaultAcRequest).read(file)));

        const results = await Promise.all(promises);

        expect(results).toEqual([false, false]);
    });
});
