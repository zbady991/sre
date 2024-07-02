import { describe, expect, it } from 'vitest';
import { SmythFS } from '@sre/IO/Storage/SmythFS.class';

import { IAccessCandidate, TAccessRole } from '@sre/types/ACL.types';
import SREInstance from '../001_Base/SREInstance';

if (!SREInstance.ready()) {
    process.exit(1);
} //force SmythRuntime to initialize

describe('Smyth FileSystem Tests', () => {
    it('initializes SmythFS', () => {
        const smythFS = SmythFS.Instance;
        expect(smythFS).toBeDefined();
    });
    it('Writes a SmythFS file from uri', async () => {
        const smythFS = SmythFS.Instance;
        let error;
        try {
            const uri = 'smythfs://myTestTeam/myTestAgent/myTestFile.txt';

            const candidate: IAccessCandidate = {
                role: TAccessRole.Agent,
                id: 'agent-123456',
            };

            await smythFS.write(uri, 'Hello World!', candidate);
        } catch (e) {
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Reads a SmythFS file from uri', async () => {
        const smythFS = SmythFS.Instance;
        let error;
        try {
            const uri = 'smythfs://myTestTeam/myTestAgent/myTestFile.txt';

            const candidate: IAccessCandidate = {
                role: TAccessRole.Agent,
                id: 'agent-123456',
            };
            const data = await smythFS.read(uri, candidate);

            expect(data.toString()).toEqual('Hello World!');
        } catch (e) {
            error = e;
        }

        expect(error).toBeUndefined();
    });

    it('Does not allow Read to a different agent ', async () => {
        const smythFS = SmythFS.Instance;
        let error;
        try {
            const uri = 'smythfs://myTestTeam/myTestAgent/myTestFile.txt';

            const candidate: IAccessCandidate = {
                role: TAccessRole.Agent,
                id: 'agent-000000',
            };
            const data = await smythFS.read(uri, candidate);
        } catch (e) {
            error = e;
        }

        expect(error.message).toEqual('Access Denied');
    });

    it('Deletes a SmythFS file from uri', async () => {
        const smythFS = SmythFS.Instance;
        let error;
        try {
            const uri = 'smythfs://myTestTeam/myTestAgent/myTestFile.txt';

            const candidate: IAccessCandidate = {
                role: TAccessRole.Agent,
                id: 'agent-123456',
            };

            await smythFS.delete(uri, candidate);

            const exists = await smythFS.exists(uri, candidate);

            expect(exists).toBeFalsy();
        } catch (e) {
            error = e;
        }

        expect(error).toBeUndefined();
    });

    //TODO: test auto ContentTypes
});
