import { Component } from './Component.class';
import { APIEndpoint } from './APIEndpoint.class';
import { APIOutput } from './APIOutput.class';
import { PromptGenerator } from './PromptGenerator.class';
import { APICall } from './APICall/APICall.class';
import { FSleep } from './FSleep.class';
import { FHash } from './FHash.class';
import { FEncDec } from './FEncDec.class';
import { FTimestamp } from './FTimestamp.class';
import { DataSourceLookup } from './DataSourceLookup.class';
import { DataSourceIndexer } from './DataSourceIndexer.class';
import { DataSourceCleaner } from './DataSourceCleaner.class';
import { JSONFilter } from './JSONFilter.class';
import { LogicAND } from './LogicAND.class';
import { LogicOR } from './LogicOR.class';
import { LogicXOR } from './LogicXOR.class';
import { LogicAtLeast } from './LogicAtLeast.class';
import { LogicAtMost } from './LogicAtMost.class';
import { AgentPlugin } from './AgentPlugin.class';
import { LLMAssistant } from './LLMAssistant.class';
import { Async } from './Async.class';
import { Await } from './Await.class';
import { ForEach } from './ForEach.class';
import { HuggingFace } from './HuggingFace.class';
import { GPTPlugin } from './GPTPlugin.class';
import { Classifier } from './Classifier.class';
import { FSign } from './FSign.class';
import { GenAILLM } from './GenAILLM.class';
import { FileStore } from './FileStore.class';
import { ScrapflyWebScrape } from './ScrapflyWebScrape.class';
import { TavilyWebSearch } from './TavilyWebSearch.class';
import { ComponentHost } from './ComponentHost.class';
import { ImageGenerator } from './ImageGenerator.class'; // Legacy
import { MCPClient } from './MCPClient.class';

const components = {
    Component: new Component(),
    Note: new Component(), //this is a fake component
    APIEndpoint: new APIEndpoint(),
    APIOutput: new APIOutput(),
    PromptGenerator: new PromptGenerator(),
    LLMPrompt: new PromptGenerator(),
    APICall: new APICall(),
    FSleep: new FSleep(),
    FHash: new FHash(),
    FEncDec: new FEncDec(),
    FSign: new FSign(),
    FTimestamp: new FTimestamp(),
    DataSourceLookup: new DataSourceLookup(),
    DataSourceIndexer: new DataSourceIndexer(),
    DataSourceCleaner: new DataSourceCleaner(),
    JSONFilter: new JSONFilter(),
    LogicAND: new LogicAND(),
    LogicOR: new LogicOR(),
    LogicXOR: new LogicXOR(),
    LogicAtLeast: new LogicAtLeast(),
    LogicAtMost: new LogicAtMost(),
    AgentPlugin: new AgentPlugin(),
    LLMAssistant: new LLMAssistant(),
    Async: new Async(),
    Await: new Await(),
    ForEach: new ForEach(),
    HuggingFace: new HuggingFace(),
    GPTPlugin: new GPTPlugin(),
    Classifier: new Classifier(),
    GenAILLM: new GenAILLM(),
    FileStore: new FileStore(),
    WebSearch: new TavilyWebSearch(),
    WebScrape: new ScrapflyWebScrape(),
    TavilyWebSearch: new TavilyWebSearch(),
    ScrapflyWebScrape: new ScrapflyWebScrape(),
    ComponentHost: new ComponentHost(),
    ImageGenerator: new ImageGenerator(),
    MCPClient: new MCPClient(),
};

export const ComponentInstances = components;
