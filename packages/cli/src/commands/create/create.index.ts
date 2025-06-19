/**
 * Create Command - Oclif Implementation
 * Create a new SRE project
 */

import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { banner } from '../../utils/banner';

const normalizeProjectName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, '-');

const detectApiKeys = () => {
    const keys: { [key: string]: string | undefined } = {
        openai: process.env.OPENAI_API_KEY || 'fake API key for testing',
        anthropic: process.env.ANTHROPIC_API_KEY,
        google: process.env.GOOGLE_API_KEY,
    };

    return Object.entries(keys).reduce((acc, [key, value]) => {
        if (value) {
            acc[key] = value;
        }
        return acc;
    }, {} as { [key: string]: string });
};

export default class Create extends Command {
    static override description = 'Create a new SRE project';

    static override examples = ['<%= config.bin %> <%= command.id %>', '<%= config.bin %> <%= command.id %> --help'];

    static override flags = {
        help: Flags.help({ char: 'h' }),
    };

    async run(): Promise<void> {
        await RunProject();
    }
}

async function RunProject() {
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

    const detectedKeys = detectApiKeys();
    const hasDetectedKeys = Object.keys(detectedKeys).length > 0;
    const detectedKeysInfo = Object.keys(detectedKeys)
        .map((k) => chalk.yellow(k))
        .join(', ');

    let answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'projectName',
            message: 'Project name',
            validate: (input: string) => (input.trim().length > 0 ? true : 'Project name cannot be empty.'),
        },
        {
            type: 'input',
            name: 'targetFolder',
            message: 'Project folder',
            default: (ans: { projectName: string }) => path.join(process.cwd(), normalizeProjectName(ans.projectName)),
            suffix: `\n${chalk.grey('Tip: If it does not exist it will be created.')}`,
        },
        {
            type: 'list',
            name: 'projectType',
            message: `Project type\n${chalk.grey('Choose the project type.')}`,
            choices: [
                { name: 'Build AI Agent with the SDK (simple)', value: 'sdk' },
                { name: 'Extend SRE with custom connectors', value: 'connectors' },
                { name: 'Extend SRE with custom components', value: 'components' },
                { name: 'Extend components and connectors', value: 'extend' },
            ],
        },
    ]);

    console.log(
        `\n${chalk.magentaBright('ℹ')} ${chalk.magentaBright(
            'You can configure the following API keys to avoid hardcoding them in your source code.'
        )}`
    );
    console.log(`  ${chalk.magentaBright('They will be securely stored in a vault file and automatically loaded by the SDK at runtime.')}\n`);

    let vault: { [key: string]: string } = {};

    if (hasDetectedKeys) {
        const { useDetectedKeys } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'useDetectedKeys',
                message: `We detected these API keys: ${detectedKeysInfo} in your environment. Do you want to use them in your project's vault?`,
                default: true,
            },
        ]);
        if (useDetectedKeys) {
            vault = { ...detectedKeys };
        }
    }

    const allProviders = ['openai', 'anthropic', 'google'];
    const missingKeyQuestions = allProviders
        .filter((provider) => !vault[provider])
        .map((provider) => ({
            type: 'input',
            name: provider,
            message: `Enter your ${provider.charAt(0).toUpperCase() + provider.slice(1)} API Key (Enter value, or press Enter to skip)\n`,
        }));

    if (missingKeyQuestions.length > 0) {
        const keyAnswers = await inquirer.prompt(missingKeyQuestions);
        for (const [provider, key] of Object.entries(keyAnswers)) {
            if (key) {
                vault[provider] = key as string;
            }
        }
    }

    const remainingAnswers = await inquirer.prompt([
        {
            type: 'list',
            name: 'smythResources',
            message: 'Smyth Resources Folder',
            suffix: `\n${chalk.grey('This folder stores resources. ~/.smyth/ is shared across projects.')}`,
            choices: [
                { name: `Shared folder (user home directory) (~/.smyth)`, value: path.join(os.homedir(), '.smyth') },
                {
                    name: `Project-local folder (${path.basename(answers.targetFolder)}/.smyth)`,
                    value: path.join(answers.targetFolder, '.smyth'),
                },
            ],
            default: 0,
        },
    ]);

    answers = { ...answers, ...remainingAnswers };

    const finalConfig = {
        projectName: answers.projectName,
        targetFolder: answers.targetFolder,
        projectType: answers.projectType,
        smythResources: answers.smythResources,
        vault,
    };

    // TODO: Implement the scaffolding logic based on the answers
    console.log('\nAnswers received:', finalConfig);

    console.log('\n🎉 Project created successfully! 🎊');

    console.log('\n⚡ Available commands:');
    console.log(`  ${chalk.green('pnpm run build')} ${chalk.grey('🔨 Build your awesome project')}`);
    console.log(`  ${chalk.green('pnpm run start')} ${chalk.grey('🚀 Launch your project into action')}`);
    console.log(`  ${chalk.green('pnpm run bundle:exe')} ${chalk.grey('📦 Package your project as an executable')}`);
}
