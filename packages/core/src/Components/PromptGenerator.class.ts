import Agent from '@sre/AgentManager/Agent.class';
import { componentLLMRequest, getLLMConnector } from '@sre/LLMManager/LLM.helper';
import { LLMConnector } from '@sre/LLMManager/LLM.service/connectors/LLMConnector.class';
import { TemplateString } from '@sre/helpers/TemplateString.helper';
import Joi from 'joi';
import { parseJson } from '../services/utils';
import Component from './Component.class';

//TODO : better handling of context window exceeding max length

export default class PromptGenerator extends Component {
    protected configSchema = Joi.object({
        model: Joi.string().max(200).required(),
        prompt: Joi.string().required().label('Prompt'),
        temperature: Joi.number().min(0).max(5).label('Temperature'), // max temperature is 2 for OpenAI and togetherAI but 5 for cohere
        maxTokens: Joi.number().min(1).label('Maximum Tokens'),
        stopSequences: Joi.string().allow('').max(400).label('Stop Sequences'),
        topP: Joi.number().min(0).max(1).label('Top P'),
        topK: Joi.number().min(0).max(500).label('Top K'), // max top_k is 100 for togetherAI but 500 for cohere
        frequencyPenalty: Joi.number().min(0).max(2).label('Frequency Penalty'),
        presencePenalty: Joi.number().min(0).max(2).label('Presence Penalty'),
    });
    constructor() {
        super();
    }
    init() {}
    async process(input, config, agent: Agent) {
        await super.process(input, config, agent);
        const componentId = config.id;

        //let debugLog = agent.agentRuntime?.debug ? [] : undefined;
        const logger = this.createComponentLogger(agent, config.name);

        try {
            logger.debug(`=== LLM Prompt Log ===`);

            const component = agent.components[componentId];

            // const outputs = {};
            // for (let con of config.outputs) {
            //     if (con.default) continue;
            //     outputs[con.name] = con?.description ? `<${con?.description}>` : '';
            // }

            const model: string = config.data.model || 'echo';
            const llmConnector: LLMConnector = getLLMConnector(model);

            // if the llm is undefined, then it means we removed the model from our system
            if (!llmConnector) {
                return {
                    _error: `The model '${model}' is not available. Please try a different one.`,
                    _debug: logger.output,
                };
            }

            logger.debug(` Model : ${model}`);

            let prompt: any = TemplateString(config.data.prompt).parse(input).result;

            logger.debug(` Parsed prompt\n`, prompt, '\n');

            // if (model.toLowerCase() == 'echo') {
            //     prompt = parseJson(prompt);
            //     if (prompt.error) prompt = prompt.result;

            //     logger.debug(` Generated result\n${typeof prompt == 'object' ? JSON.stringify(prompt, null, 2) : prompt}`);

            //     let result = {};
            //     result['Reply'] = prompt;
            //     result['_debug'] = logger.output;
            //     return result;
            // }

            // const excludedKeys = ['_debug', '_error'];
            // const outputKeys = Object.keys(outputs).filter((key) => !excludedKeys.includes(key));

            // if (outputKeys.length > 0) {
            //     const outputFormat = {};
            //     outputKeys.forEach((key) => (outputFormat[key] = '<value>'));

            //     prompt +=
            //         '\n##\nExpected output format = ' +
            //         JSON.stringify(outputFormat) +
            //         '\nThe output JSON should only use the entries from the output format.';

            //     logger.debug(` Enhanced prompt \n`, prompt, '\n');
            // }

            prompt = llmConnector.enhancePrompt(prompt, config);
            logger.debug(` Enhanced prompt \n`, prompt, '\n');

            // request to LLM
            const response: any = await componentLLMRequest(prompt, model, config).catch((error) => ({ error: error }));

            // in case we have the response but it's empty string, undefined or null
            if (!response) {
                return { _error: ' LLM Error = Empty Response!', _debug: logger.output };
            }

            if (response?.error) {
                logger.error(` LLM Error=${JSON.stringify(response.error)}`);

                return { Reply: response?.data, _error: response?.error?.error + ' ' + response?.error?.details, _debug: logger.output };
            }

            // logger.debug(` Generated result \n`, response);

            // let Reply = parseJson(response);
            // if (Reply.error) {
            //     logger.warn(` Post process error=`, Reply.error);

            //     if (Reply.result) Reply = Reply.result;
            //     else return { _error: Reply.error, Reply: Reply.result, _debug: logger.output };
            // }

            const parsed = { Reply: response };

            parsed['_debug'] = logger.output;

            return parsed;
        } catch (error) {
            return { _error: error.message, _debug: logger.output };
        }
    }
}
