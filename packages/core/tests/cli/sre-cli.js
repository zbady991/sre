import dotenv from 'dotenv';
dotenv.config();
import { AgentRequest, SmythRuntime, ConnectorService, CLIAgentDataConnector } from '../../dist/index.js';

const sre = SmythRuntime.Instance.init({
    Storage: {
        Connector: 'S3',
        Settings: {
            bucket: process.env.AWS_S3_BUCKET_NAME || '',
            region: process.env.AWS_S3_REGION || '',
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
    },
    Cache: {
        Connector: 'Redis',
        Settings: {
            hosts: process.env.REDIS_SENTINEL_HOSTS,
            name: process.env.REDIS_MASTER_NAME || '',
            password: process.env.REDIS_PASSWORD || '',
        },
    },
});

ConnectorService.Instance.register('AgentData', 'CLI', CLIAgentDataConnector);
ConnectorService.Instance.init('AgentData', 'CLI', { args: process.argv });

async function main() {
    try {
        const data = await sre.AgentData.getAgentData('test', '1.0');
        //console.log(data);
        //const request = new AgentRequest({ method: 'POST', path: '/api/say', body: { message: 'Hello World' } });
        const request = new AgentRequest(process.argv);
        const result = await sre.runAgent('test', { data, agentVersion: '1.0' }, request);

        console.log('>>>>>>>>>>>>>>>>> Result \n', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error(error);
    } finally {
        await sre._stop();
    }
}

main();
