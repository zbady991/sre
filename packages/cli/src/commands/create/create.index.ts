/**
 * Create Command - Oclif Implementation
 * Create a new SRE project
 */

import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs';
import { banner } from '../../utils/banner';

export default class Create extends Command {
    static override description = 'Create a new SRE project';

    static override examples = ['<%= config.bin %> <%= command.id %>', '<%= config.bin %> <%= command.id %> --help'];

    static override flags = {
        help: Flags.help({ char: 'h' }),
    };

    async run(): Promise<void> {
        await RunProject(Create.flags as any);
    }
}

async function RunProject(options: any) {
    console.log('Not implemented yet');
    return;

    console.log(
        banner(
            [],
            [
                '',
                '',
                '',
                '',
                '',
                '',
                chalk.white('🚀 Welcome to the SRE Project Creator! ✨'),
                chalk.white("💻 Let's build something amazing together..."),
            ]
        )
    );
    const currentFolder = process.cwd();
    const isEmpty = fs.readdirSync(currentFolder).length === 0;

    const questions = [
        {
            type: 'input',
            name: 'projectName',
            message: 'Project name',
        },
        {
            type: 'input',
            name: 'targetFolder',
            message: 'Target folder',
            default: () => (isEmpty ? currentFolder : undefined),
            suffix: `\n${chalk.grey('Tip: If it does not exist it will be created.')}`,
        },
        {
            type: 'list',
            name: 'projectType',
            message: `Project type\n${chalk.grey('Choose the project type.')}`,
            choices: [
                { name: 'Build with SRE SDK', value: 'sdk' },
                { name: 'Extend SRE with custom components and connectors', value: 'extend' },
            ],
        },
        {
            type: 'list',
            name: 'sentinelMcp',
            message: `Sentinel MCP\n${chalk.grey('Sentinel is a local agent that can assist you to build with SRE (requires OpenAI key)')}`,
            choices: [
                { name: 'Yes', value: true },
                { name: 'No', value: false },
            ],
        },
    ];

    const answers = await inquirer.prompt(questions);

    console.log('...');

    console.log('🎉 Project created successfully! 🎊');

    console.log('⚡ Available commands:');
    console.log(`  ${chalk.green('npm run build')} ${chalk.grey('🔨 Build your awesome project')}`);
    console.log(`  ${chalk.green('npm run start')} ${chalk.grey('🚀 Launch your project into action')}`);
    console.log(`  ${chalk.green('npm run bundle:exe')} ${chalk.grey('📦 Package your project as an executable')}`);
}
