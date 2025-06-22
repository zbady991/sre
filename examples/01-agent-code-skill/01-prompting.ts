import { Agent, Scope } from '@smythos/sdk';

async function main() {
    const agent = new Agent({
        id: 'crypto-market-assistant',
        
        name: 'CryptoMarket Assistant',
        behavior: 'You are a crypto price tracker. You are given a coin id and you need to get the price of the coin in USD',
        model: 'gpt-4o',
    });

    agent.addSkill({
        name: 'MarketData',
        description: 'Use this skill to get comprehensive market data and statistics for a cryptocurrency',
        process: async ({ coin_id }) => {
            const url = `https://api.coingecko.com/api/v3/coins/${coin_id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;
            const response = await fetch(url);
            const data = await response.json();
            return data.market_data;
        },
    });
    const imgSkill = agent.addSkill({
        name: 'ImageAnalyser',
        description: 'Any attachment should be processed by this function',
        process: async ({ image_url }) => {
            console.log(image_url);
            return 'Image analysed';
        },
    });
    // imgSkill.in({
    //     image_url : {
    //         type:'Binary',
    //         description:'The image url that we will analyze'
    //     }
    // })



    const prompt = await agent.prompt('Analyze this image please ', {
        files: ['https://www.robuxio.com/wp-content/uploads/2023/05/Trend.png'],
    });
    console.log(prompt);


    //this will prompt the agent and use the agent's LLM to determine which skill to use
    const promptResult = await agent.prompt('What are the current prices of Bitcoin and Ethereum ?');
    //the response comes back in natural language
    console.log(promptResult);

    //You can also call the skill directly
    const result = await agent.call('MarketData', { coin_id: 'bitcoin' });
    console.log(result);

    //Check the next example to how to get the prompt response as a stream
}

main();
