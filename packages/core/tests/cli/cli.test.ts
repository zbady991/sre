import { execSync } from 'child_process';
import { describe, expect, it } from 'vitest';
import { CLIAgentDataConnector } from '@sre/AgentManager/AgentData/connectors/CLIAgentDataConnector.class';
import { ConnectorService } from '@sre/Core/ConnectorsService';
import config from '@sre/config';
import { SmythRuntime } from '@sre/index';
import { TConnectorService } from '@sre/types/SRE.types';
const sre = SmythRuntime.Instance.init({
    Storage: {
        Connector: 'S3',
        Settings: {
            bucket: config.env.AWS_S3_BUCKET_NAME || '',
            region: config.env.AWS_S3_REGION || '',
            accessKeyId: config.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: config.env.AWS_SECRET_ACCESS_KEY || '',
        },
    },
    Cache: {
        Connector: 'Redis',
        Settings: {
            hosts: config.env.REDIS_SENTINEL_HOSTS,
            name: config.env.REDIS_MASTER_NAME || '',
            password: config.env.REDIS_PASSWORD || '',
        },
    },
});
ConnectorService.Instance.register(TConnectorService.AgentData, 'CLI', CLIAgentDataConnector);
ConnectorService.Instance.init(TConnectorService.AgentData, 'CLI', { args: process.argv });

function runCLICommand(args: string): string {
    const cmd = `node ./tests/cli/sre-cli.js ${args}`;
    return execSync(cmd, { encoding: 'utf-8' });
}

describe('SRE Basic Tests', () => {
    it('SRE Instance', async () => {
        expect(sre).toBeInstanceOf(SmythRuntime);
    });
    it('Echo agent', () => {
        const timestamp = new Date().getTime();
        const message = `Hello Smyth, timestamp=${timestamp}`;
        const args = `--agent ./tests/data/sre-echo-agent.smyth --endpoint say --post message="${message}"`;
        const output = runCLICommand(args);

        expect(output).toContain(message);
    });

    it('APIEndpoint Test', () => {
        const args = `--agent ./tests/data/sre-APIEndpoint-test.smyth --endpoint say --post message="Hello Smyth" file=".\\tests\\data\\logo.png"`;
        const output = runCLICommand(args);

        expect(output).toBeDefined();
    });
});
