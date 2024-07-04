import { xxh3 } from '@node-rs/xxhash';
import { describe, expect, it } from 'vitest';

import { S3Storage } from '@sre/IO/Storage/connectors/S3Storage.class';
import { TAccessLevel, TAccessRole } from '@sre/types/ACL.types';
//import SRE, { AgentRequest } from '../../dist';
import { StorageConnector } from '@sre/IO/Storage/StorageConnector';
import SREInstance from '../001_Base/SREInstance';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { AccessCandidate } from '@sre/Security/AccessControl/AccessCandidate.class';

const testFile = 'unit-tests/acl-test.txt';

describe('S3 Storage Advanced Access Rights', () => {
    it('Create S3Storage', async () => {
        const s3Storage: StorageConnector = SREInstance.Storage;
        expect(s3Storage).toBeInstanceOf(S3Storage);
    });

    it('Write files in S3Storage', async () => {
        let error;

        try {
            const s3Storage: StorageConnector = SREInstance.Storage;

            //const acRequest = new AccessRequest(AccessCandidate.agent('agent-123456')).setWrite(testFile).setResourceTeam('myTeam');
            const acRequest = AccessCandidate.agent('agent-123456').writeRequest;

            const acl = ACL.addAccess(TAccessRole.Team, 'myTeam', TAccessLevel.Read);

            //const accessToken = await s3Storage.getAccess(acRequest);

            await s3Storage.request(acRequest).write(testFile, 'Hello World!', acl);
        } catch (e) {
            //console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });
    it('Overwrite file With invalid access token', async () => {
        let error;

        try {
            const s3Storage: StorageConnector = SREInstance.Storage;
            //const acRequest = new AccessRequest(AccessCandidate.agent('agent-123456')).setWrite(testFile);
            const acRequest = AccessCandidate.agent('agent-stranger').writeRequest;

            await s3Storage.request(acRequest).write(testFile, 'Hello World!');
        } catch (e) {
            //console.error(e);
            error = e;
        }

        expect(error?.message).toEqual('Access Denied');
    });
    it('Read files from using wrong access => should fail', async () => {
        //this fails because the agent does not have access to the resource, and is not from the same team as the owner (default team name is "default")
        let error;

        try {
            const s3Storage: StorageConnector = SREInstance.Storage;

            //const acRequest = new AccessRequest(AccessCandidate.agent('agent-no-access')).setRead(testFile);
            const acRequest = AccessCandidate.agent('agent-no-access').readRequest;

            //const accessToken = await s3Storage.getAccess(acRequest);
            const result = await s3Storage.request(acRequest).read(testFile);

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

            //const acRequest = new AccessRequest(AccessCandidate.agent('agent-123456')).setRead(testFile);
            const acRequest = AccessCandidate.agent('agent-123456').readRequest;

            //const accessToken = await s3Storage.getAccess(acRequest);
            const result = await s3Storage.request(acRequest).read(testFile);

            expect(result.toString()).toBe('Hello World!');

            //const acTeamRequest = new AccessRequest(AccessCandidate.team('myTeam')).setRead(testFile);
            const acTeamRequest = AccessCandidate.team('myTeam').readRequest;

            //const teamAccessToken = await s3Storage.getAccess(acTeamRequest);
            const teamResult = await s3Storage.request(acTeamRequest).read(testFile);

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

            //const acRequest = new AccessRequest(AccessCandidate.agent('agent-123456')).setWrite(testFile);
            const acRequest = AccessCandidate.agent('agent-123456').writeRequest;

            //const accessToken = await s3Storage.getAccess(acRequest);
            await s3Storage.request(acRequest).delete(testFile);
        } catch (e) {
            //console.error(e);
            error = e;
        }

        expect(error).toBeUndefined();
    });
});
