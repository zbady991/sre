import { ConnectorService } from '@sre/Core/ConnectorsService';
import { SmythRuntime } from '@sre/Core/SmythRuntime.class';
import { ModelsProviderConnector } from '@sre/LLMManager/ModelsProvider.service/ModelsProviderConnector';
import { testData } from './test-data-manager';

export function setupSRE(extendedConfig?: Record<string, any>) {
    const SREInstance = SmythRuntime.Instance.init({
        Storage: {
            Connector: 'LocalStorage',
        },
        Cache: {
            Connector: 'RAM',
        },
        AgentData: {
            Connector: 'Local',
            Settings: {
                devDir: testData.getDataPath('AgentData'),
                prodDir: testData.getDataPath('AgentData'),
            },
        },
        Account: {
            Connector: 'JSONFileAccount',
            Settings: {
                file: testData.getDataPath('account.json'),
            },
        },
        Vault: {
            Connector: 'JSONFileVault',
            Settings: {
                file: testData.getVaultPath(),
            },
        },

        ...extendedConfig,
    });

    const modelsProvider: ModelsProviderConnector = ConnectorService.getModelsProviderConnector();

    const agentId = 'agent-123456';
    const MockAgentData = {
        id: agentId,
        agentRuntime: { debug: true }, // used inside createComponentLogger()
        isKilled: () => false,
        modelsProvider: modelsProvider.agent(agentId),
    };

    return { SREInstance, MockAgentData };
}
