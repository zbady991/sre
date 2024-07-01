export enum TConnectorService {
    Storage = 'Storage',
    Security = 'Security',
    Cache = 'Cache',
    AgentData = 'AgentData',
    LLM = 'LLM',
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
