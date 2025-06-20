/**
 * Create Command - Oclif Implementation
 * Create a new SRE project
 */

import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import os from 'os';
import path from 'path';
import { banner } from '../../utils/banner';
import fs from 'fs';
import { execSync } from 'child_process';

const normalizeProjectName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, '-');

const vaultTemplate = {
    default: {
        echo: '',
        openai: '',
        anthropic: '',
        googleai: '',
        groq: '',
        togetherai: '',
        xai: '',
        deepseek: '',
        tavily: '',
        scrapfly: '',
    },
};

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

function prepareSmythDirectory(baseDir: string = os.homedir()) {
    //check and create ~/.smyth if it does not exist
    const smythDir = path.join(baseDir, '.smyth');
    if (!fs.existsSync(smythDir)) {
        fs.mkdirSync(smythDir, { recursive: true });
    }

    //check and create .smyth/.sre/ if it does not exist
    const sreDir = path.join(smythDir, '.sre');
    if (!fs.existsSync(sreDir)) {
        fs.mkdirSync(sreDir, { recursive: true });
    }

    //check and create .smyth/storage if it does not exist
    const storageDir = path.join(smythDir, 'storage');
    if (!fs.existsSync(storageDir)) {
        fs.mkdirSync(storageDir, { recursive: true });
    }

    //just check if a vault file exists in ~/.smyth/.sre/vault.json
    const vaultFile = path.join(sreDir, 'vault.json');
    const vaultExists = fs.existsSync(vaultFile);

    return {
        smythDir,
        sreDir,
        storageDir,
        vaultFile: vaultExists ? vaultFile : null,
    };
}

export default class CreateCmd extends Command {
    static override description = 'Create a new SmythOS project';

    static override examples = ['<%= config.bin %> <%= command.id %>', '<%= config.bin %> <%= command.id %> "My Awesome Project"'];

    static override flags = {
        help: Flags.help({ char: 'h' }),
    };

    static override args = {
        projectName: Args.string({
            name: 'projectName',
            description: 'Name of the new SmythOS project',
            required: false,
        }),
    };

    async run(): Promise<void> {
        const { args } = await this.parse(CreateCmd);
        await RunProject(args.projectName);
    }
}

async function RunProject(projectNameArg?: string) {
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
                '',
                '',
                '',
                '',
                chalk.white('🚀 Welcome to the SRE Project Builder! ✨'),
                chalk.white("🧑‍💻 Let's build something amazing together..."),
            ]
        )
    );

    const { smythDir, sreDir, storageDir, vaultFile } = prepareSmythDirectory();

    const detectedKeys = detectApiKeys();
    const hasDetectedKeys = Object.keys(detectedKeys).length > 0;
    const detectedKeysInfo = Object.keys(detectedKeys)
        .map((k) => chalk.yellow(k))
        .join(', ');

    const initialAnswers = await inquirer.prompt([
        {
            type: 'input',
            name: 'projectName',
            message: 'Project name',
            validate: (input: string) => (input.trim().length > 0 ? true : 'Project name cannot be empty.'),
            when: !projectNameArg,
        },
    ]);

    const projectName = projectNameArg || initialAnswers.projectName;

    let answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'targetFolder',
            message: 'Project folder',
            default: path.join(process.cwd(), normalizeProjectName(projectName)),
            suffix: `\n${chalk.grey('If it does not exist it will be created.\n')}`,
        },
        // {
        //     type: 'list',
        //     name: 'projectType',
        //     message: `Project type\n${chalk.grey('Choose the project type.')}`,
        //     choices: [
        //         { name: 'Build AI Agent with the SDK (simple)', value: 'sdk' },
        //         { name: 'Extend SRE with custom connectors', value: 'connectors' },
        //         { name: 'Extend SRE with custom components', value: 'components' },
        //         { name: 'Extend components and connectors', value: 'extend' },
        //     ],
        // },

        {
            type: 'list',
            name: 'templateType',
            message: `Project template\n${chalk.grey('Choose the project template.')}`,
            choices: [
                { name: 'Empty Project', value: 'sdk-empty' },
                { name: 'Minimal : Just the basics to get started', value: 'code-agent-minimal' },
                { name: 'Interactive : Chat with one agent', value: 'code-agent-book-assistant' },
                {
                    name: 'Interactive chat with agent selection',
                    value: 'interactive-chat-agent-select',
                },
            ],
        },
    ]);

    answers.projectName = projectName;

    let vault: { [key: string]: string } = {};

    let _useSharedVault = false;

    if (vaultFile) {
        console.log(chalk.yellow(`\n ℹ  Found an existing shared vault file ${vaultFile}`));
        const { useSharedVault } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'useSharedVault',
                message: `Do you want to use the shared vault in this project ?`,
                default: true,
            },
        ]);
        _useSharedVault = useSharedVault;
        vault = {
            openai: '#',
            anthropic: '#',
            google: '#',
            groq: '#',
            togetherai: '#',
            xai: '#',
            deepseek: '#',
            tavily: '#',
            scrapfly: '#',
        };
    }

    if (hasDetectedKeys && !_useSharedVault) {
        console.log(
            `\n${chalk.yellow('ℹ')}  ${chalk.yellow('You can configure the following API keys to avoid hardcoding them in your source code.')}`
        );
        console.log(`   ${chalk.yellow('They will be securely stored in the vault file and automatically loaded by the SDK at runtime.')}`);

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
            suffix: `\n${chalk.grey('Location where we can store data like logs, cache, etc.')}`,
            choices: [
                { name: `Shared folder in the ${chalk.underline('user home directory')} (~/.smyth)`, value: path.join(os.homedir(), '.smyth') },
                {
                    name: `Local folder under ${chalk.underline('project root')} (./${path.basename(answers.targetFolder)}/.smyth)`,
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
        templateType: answers.templateType,
        smythResources: answers.smythResources,
        vault,
        useSharedVault: _useSharedVault,
    };

    try {
        const success = createProject(finalConfig);
        if (!success) {
            console.log(chalk.red('🚨 Error creating project.'));
            return;
        }

        console.log('\n🎉 Project created successfully! 🎊');
        console.log('\n\n🚀 Next steps :');
        console.log(`\n${chalk.green('cd')} ${chalk.underline(finalConfig.targetFolder)}`);
        console.log(`${chalk.green('npm install')}`);
        console.log(`${chalk.green('npm run build')}`);
        console.log(`${chalk.green('npm start')}\n\n`);
    } catch (error) {
        console.error(chalk.red('🚨 Error creating project:'), error);
    }
}

function createProject(config: any) {
    let folderCreated = false;
    let projectFolder = '';
    try {
        console.log('Creating project...');
        const gitRepoUrl = 'https://github.com/SmythOS/sre-project-templates';
        const branch = config.templateType;

        //create project folder
        projectFolder = config.targetFolder;

        //if the folder already exists and is not empty, cancel the operation
        if (fs.existsSync(projectFolder) && fs.readdirSync(projectFolder).length > 0) {
            console.log(chalk.red('Project folder already exists and is not empty.'));
            return false;
        }

        const projectId = path.basename(projectFolder);
        //clone the repo branch into the project folder
        const cloneCommand = `git clone --branch ${branch} ${gitRepoUrl} ${projectFolder}`;
        execSync(cloneCommand, { stdio: 'inherit' });
        folderCreated = true;

        //ensure resources folder and .sre folder exists
        //ensure the .sre folder exists
        const sreFolder = path.join(config.smythResources, '.sre');
        if (!fs.existsSync(sreFolder)) {
            fs.mkdirSync(sreFolder, { recursive: true });
        }

        //Write vault file
        if (!config.useSharedVault) {
            const vaultPath = path.join(config.smythResources, '.sre', 'vault.json');
            if (config.vault && !fs.existsSync(vaultPath)) {
                const vaultData = {
                    default: {
                        ...vaultTemplate.default,
                        ...config.vault,
                    },
                };
                fs.writeFileSync(vaultPath, JSON.stringify(vaultData, null, 2));
            }
        }

        //update package.json with project name
        const packageJsonPath = path.join(projectFolder, 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        packageJson.name = projectId;
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

        //update .env with project name
        const envPath = path.join(projectFolder, '.env');
        fs.writeFileSync(envPath, 'LOG_LEVEL=""\nLOG_FILTER=""\n');

        //delete .git folder
        const gitFolder = path.join(projectFolder, '.git');
        if (fs.existsSync(gitFolder)) {
            fs.rmSync(gitFolder, { recursive: true });
        }

        return true;
    } catch (error) {
        if (folderCreated && projectFolder) {
            fs.rmSync(projectFolder, { recursive: true });
        }
        return false;
    }
}
