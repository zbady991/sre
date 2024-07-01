//==[ SRE: Cache ]======================
export * from './ICacheConnector';
import { ConnectorServiceProvider, ConnectorService } from '@sre/Core/ConnectorsService';
import { TConnectorService } from '@sre/types/SRE.types';
import { ICacheConnector } from './ICacheConnector';
import { RedisCache } from './connectors/RedisCache.class';

export class CacheService extends ConnectorServiceProvider {
    public register() {
        ConnectorService.Instance.register(TConnectorService.Cache, 'Redis', RedisCache);
    }
}
