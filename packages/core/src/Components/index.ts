import Component from './Component.class';
import APIEndpoint from './APIEndpoint.class';
import APIOutput from './APIOutput.class';
import PromptGenerator from './PromptGenerator.class';

const components = {
    Component: new Component(),
    Note: new Component(), //this is a fake component
    APIEndpoint: new APIEndpoint(),
    APIOutput: new APIOutput(),
    PromptGenerator: new PromptGenerator(),
    LLMPrompt: new PromptGenerator(),
};

export default components;
