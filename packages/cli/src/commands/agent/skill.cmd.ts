import { Agent } from '@smythos/sdk';
import { SRE } from '@smythos/sre';
import util from 'util';

export default async function runSkill(args: any, flags: any) {
    if (flags.vault) {
        SRE.init({
            Vault: {
                Connector: 'JSONFileVault',
                Settings: {
                    file: flags.vault,
                },
            },
        });
    }
    const agentPath = args.path;

    //Importing the agent workflow
    const agent = Agent.import(agentPath);

    const result = await agent.call(flags.skill, flags.input);
    console.log(util.inspect(result, { showHidden: true, depth: null, colors: true }));
}
