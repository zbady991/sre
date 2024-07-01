import 'source-map-support/register.js';
import AgentRequest from './subsystems/AgentManager/AgentRequest.class';
import AgentSettings from './subsystems/AgentManager/AgentSettings.class';
//import SRE from './Core/SRE.class';
import Agent from './subsystems/AgentManager/Agent.class';
import SmythRuntime from './Core/SmythRuntime.class';
import { boot } from './Core/boot';
import { ConnectorService } from './Core/ConnectorsService';
import { CLIAgentDataConnector } from './subsystems/AgentManager/AgentData/connectors/CLIAgentDataConnector.class';

boot();

export { Agent, AgentRequest, AgentSettings, SmythRuntime, ConnectorService, CLIAgentDataConnector };
