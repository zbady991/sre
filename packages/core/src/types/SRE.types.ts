import { StorageService } from '@sre/IO/Storage.service';
import { LLMService } from '@sre/LLMManager/LLM.service';
import { CacheService } from '@sre/MemoryManager/Cache.service';

export type TServiceRegistry = {
    Storage?: StorageService;
    Cache?: CacheService;
    LLM?: LLMService;
};

export enum TConnectorService {
    Storage = 'Storage',
    Security = 'Security',
    Cache = 'Cache',
    AgentData = 'AgentData',
    LLM = 'LLM',
    LLMProvider = 'LLMProvider',
}

export type SREConnectorConfig = {
    Connector: string;
    Default?: boolean;
    Settings: {
        [hashedOwnerKey: string]: any;
    };
};

export type SREConfig = {
    [key in TConnectorService]?: SREConnectorConfig[] | SREConnectorConfig;
};
