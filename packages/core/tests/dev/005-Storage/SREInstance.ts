import { AbstractAgentDataConnector } from '@sre/AgentManager/AgentData.service/connectors/AbstractAgentDataConnector.class';
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
});

//late register custom security connector
ConnectorService.register(TConnectorService.AgentData, 'Abstract', AbstractAgentDataConnector);
ConnectorService.init(TConnectorService.AgentData, 'Abstract');

export default SmythRuntime.Instance;
