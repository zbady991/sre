import { xxh3 } from '@node-rs/xxhash';
import { describe, expect, it } from 'vitest';

import { S3Storage } from '@sre/IO/Storage/connectors/S3Storage.class';
import { TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
//import SRE, { AgentRequest } from '../../dist';
import { StorageConnector } from '@sre/IO/Storage/StorageConnector';
import SREInstance from '../001_Base/SREInstance';
import { AccessCandidate, ACLHelper, AccessRequest } from '@sre/Security/ACL.helper';

const testFile = 'unit-tests/acl-test.txt';

describe('S3 Storage Advanced Access Rights', () => {
    it('Create S3Storage', async () => {
        const s3Storage: StorageConnector = SREInstance.Storage;
        expect(s3Storage).toBeInstanceOf(S3Storage);
    });

    it('Write files With invalid access token', async () => {
        let error;

        try {
            const s3Storage: StorageConnector = SREInstance.Storage;
            const acRequest = new AccessRequest(AccessCandidate.agent('agent-123456')).write(testFile);

            await s3Storage.write(testFile, 'Hello World!', acRequest);
        } catch (e) {
            //console.error(e);
            error = e;
        }

        expect(error).toBeDefined();
    });

    it('Write files in S3Storage', async () => {
        let error;

        try {
            const s3Storage: StorageConnector = SREInstance.Storage;

            //const acRequest = AccessRequest.forTeamResource('default', testFile, TAccessLevel.Write, AccessCandidate.agent('agent-123456'));
            const acRequest = new AccessRequest(AccessCandidate.agent('agent-123456')).write(testFile).resTeam('myTeam');

            const acl = ACLHelper.load().addAccess(TAccessRole.Team, 'myTeam', TAccessLevel.Read).ACL;

            //const accessToken = await s3Storage.getAccess(acRequest);

            await s3Storage.write(testFile, 'Hello World!', acRequest, acl);
        } catch (e) {
            //console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Read files from using wrong access => should fail', async () => {
        let error;

        try {
            const s3Storage: StorageConnector = SREInstance.Storage;
            //const acRequest = AccessRequest.forResource(testFile, TAccessLevel.Read, AccessCandidate.agent('agent-1234'));
            const acRequest = new AccessRequest(AccessCandidate.agent('agent-1234')).read(testFile);

            //const accessToken = await s3Storage.getAccess(acRequest);
            const result = await s3Storage.read(testFile, acRequest);

            expect(result.toString()).toBe('Hello World!');
        } catch (e) {
            //console.error(e);
            error = e;
        }

        expect(error).toBeDefined();
    });

    it('Read files', async () => {
        let error;

        try {
            const s3Storage: StorageConnector = SREInstance.Storage;
            //const acRequest = AccessRequest.forResource(testFile, TAccessLevel.Read, AccessCandidate.agent('agent-123456'));

            const acRequest = new AccessRequest(AccessCandidate.agent('agent-123456')).read(testFile);

            //const accessToken = await s3Storage.getAccess(acRequest);
            const result = await s3Storage.read(testFile, acRequest);

            expect(result.toString()).toBe('Hello World!');

            //const acTeamRequest = AccessRequest.forResource(testFile, TAccessLevel.Read, AccessCandidate.team('default'));

            const acTeamRequest = new AccessRequest(AccessCandidate.team('myTeam')).read(testFile);

            //const teamAccessToken = await s3Storage.getAccess(acTeamRequest);
            const teamResult = await s3Storage.read(testFile, acTeamRequest);

            expect(teamResult.toString()).toBe('Hello World!');
        } catch (e) {
            //console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Delete files in S3Storage', async () => {
        let error;

        try {
            const s3Storage: StorageConnector = SREInstance.Storage;
            //const acRequest = AccessRequest.forResource(testFile, TAccessLevel.Write, AccessCandidate.agent('agent-123456'));

            const acRequest = new AccessRequest(AccessCandidate.agent('agent-123456')).write(testFile);

            //const accessToken = await s3Storage.getAccess(acRequest);
            await s3Storage.delete(testFile, acRequest);
        } catch (e) {
            //console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });
});
