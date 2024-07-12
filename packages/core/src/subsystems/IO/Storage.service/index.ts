//==[ SRE: Storage ]======================

import { ConnectorService, ConnectorServiceProvider } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { S3Storage } from './connectors/S3Storage.class';

export class StorageService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.register(TConnectorService.Storage, 'S3', S3Storage);
    }
}
