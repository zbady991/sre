import { Agent, Chat, Component, Model, TAgentMode, TLLMEvent } from '@smythos/sdk';
import chalk from 'chalk';
import util from 'util';
import * as readline from 'readline';
import { EventEmitter } from 'events';

//Show the tasks list and status to the user at every step before performing the tasks, and also give a tasks status summary after tasks.
//When you display the tasks list to a user show it in a concise way with a summary and checkboxes for each task.

// Simple task management with sticky right panel
let currentTasks: any = {};

async function main() {
    console.clear();

    // Draw initial empty panel
    updateStickyTasksPanel();

    console.log(chalk.green('🚀 Smyth Code Assistant is ready!'));
    console.log(chalk.yellow('Ask me about code, search for code, or get code.'));
    console.log(chalk.gray('Type "exit" or "quit" to end the conversation.'));
    console.log(chalk.gray('Tasks will appear in the panel on the right →'));
    console.log(''); // Empty line

    const agent = new Agent({
        //IMPORTANT !! : in order to persist chat, you need to set an id for your agent
        //in fact, due to SRE data isolaton we need to identify the owner of persisted data, in this case the agent
        id: 'smyth-code-assistant',
        name: 'Smyth Code Assistant',
        behavior: `You are a code assistant. You are given a code task and you need to complete it.
        Code blocks should be preceeded with \`\`\`lang tags and closed with \`\`\` where lang is the language of the code.
        When the user asks about a framework or a library that you do not know, make sure to perform a web search to get the information you need.
        NEVER make up information, if you don't know the answer.
        `,
        model: 'claude-4-sonnet',
        // model: Model.OpenAI('gpt-5', {
        //     inputTokens: 300000,
        //     outputTokens: 100000,
        //     features: ['reasoning'],
        //     interface: 'responses',
        //     reasoningEffort: 'low',
        // }),
        mode: TAgentMode.PLANNER,
        // Model.OpenAI('gpt-5-mini', {
        //     inputTokens: 300000,
        //     outputTokens: 100000,
        // }),
    });
    agent.on('TasksAdded', (tasksList: any, tasks: any) => {
        displayTasksList(tasks);
    });
    agent.on('SubTasksAdded', (taskId: string, subTasksList: any, tasks: any) => {
        displayTasksList(tasks);
    });
    agent.on('TasksUpdated', (taskId: string, status: string, tasks: any) => {
        displayTasksList(tasks);
    });
    agent.on('TasksCompleted', (tasks: any) => {
        displayTasksList(tasks);
    });
    agent.on('StatusUpdated', (status: string) => {
        console.log(chalk.gray('>>> ' + status));
    });

    //#region [ Web Search Skill ] ================

    //Declaring a web search skill entry
    const wsSkill = agent.addSkill({
        name: 'WebSearch',
        description: 'Use this skill to get comprehensive web search results',
    });

    //Defining the inputs of the skill
    wsSkill.in({
        userQuery: {
            description: 'The search query to get the web search results of',
        },
    });

    //Creating a Tavily Web Search component
    const wsTavily = Component.TavilyWebSearch({
        searchTopic: 'general',
        sourcesLimit: 10,
        includeImages: false,
        includeQAs: false,
        timeRange: 'None',
    });

    //Connecting the default Tavily input (SearchQuery) to the skill "userQuery"
    wsTavily.in({
        SearchQuery: wsSkill.out.userQuery,
    });

    const wsOutput = Component.APIOutput({ format: 'minimal' });
    wsOutput.in({ WebSearch: wsTavily.out.Results });

    //#endregion

    //#region [ Web Search Scrape ] ================

    //Declaring a web search skill entry
    const wScrapeSkill = agent.addSkill({
        name: 'WebScrape',
        description: 'Use this skill to scrape web pages',
    });

    //Defining the inputs of the skill
    wScrapeSkill.in({
        URLs: {
            description: 'The URLs to scrape in a JS array',
        },
    });

    const wscrapeFly = Component.ScrapflyWebScrape({});
    wscrapeFly.in({
        URLs: wScrapeSkill.out.URLs,
    });

    const wScrapeOutput = Component.APIOutput({ format: 'minimal' });
    wScrapeOutput.in({ WebScrape: wscrapeFly.out.Results });

    //#endregion

    //we call the chat explicitly with persistance enabled
    const chat = agent.chat({ id: 'my-chat-0001', persist: false });

    // Create readline interface for user input
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.blue('You: '),
    });

    // Set up readline event handlers
    rl.on('line', (input) => handleUserInput(input, rl, chat));

    rl.on('close', () => {
        console.log(chalk.gray('Chat session ended.'));
        process.exit(0);
    });

    // Redraw panel on terminal resize
    process.stdout.on('resize', () => {
        updateStickyTasksPanel();
    });

    // Start the interactive chat
    rl.prompt();
}

main();

const special_tags = ['thinking', 'code', 'planning'];
const content_color = {
    thinking: chalk.gray,
    planning: chalk.green,
};

// Content processor to handle special tags and buffering
class ContentProcessor extends EventEmitter {
    private buffer: string = '';
    private insideTag: string | null = null;
    private isFirst: boolean = true;
    private tagStartTime: number | null = null;
    private tagContent: string = '';
    private insideBlock: boolean = false;
    private blockStartTime: number | null = null;
    private blockContent: string = '';
    private blockParams: string[] = [];
    private processingTags: boolean = false;

    constructor() {
        super();
        this.reset();
    }

    reset() {
        this.buffer = '';
        this.insideTag = null;
        this.isFirst = true;
        this.tagStartTime = null;
        this.tagContent = '';
        this.insideBlock = false;
        this.blockStartTime = null;
        this.blockContent = '';
        this.blockParams = [];
        this.processingTags = false;
    }

    processContent(content: string): void {
        // Add content to buffer
        this.buffer += content;

        // Add assistant prefix only on first content
        if (this.isFirst) {
            process.stdout.write(chalk.green('🤖 Assistant: '));
            this.isFirst = false;
        }

        // Process buffer for complete tags
        this.flushProcessedContent();
    }

    private flushProcessedContent(): void {
        let processedIndex = 0;

        // Handle both blocks and tags in the same pass
        // Look for ``` at line starts first
        const lines = this.buffer.split('\n');
        let reconstructedBuffer = '';
        let lineProcessed = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Check for complete line with ```
            if (line.trim().startsWith('```')) {
                // Process any accumulated content first
                if (reconstructedBuffer) {
                    this.processTagsInContent(reconstructedBuffer);
                    reconstructedBuffer = '';
                }

                this.handleBlockLine(line);
                lineProcessed = true;
            } else if (i === lines.length - 1 && !this.buffer.endsWith('\n')) {
                // Last line without newline - might be partial, keep in buffer for next time
                reconstructedBuffer += line;
            } else {
                // Regular content line
                reconstructedBuffer += line;
                if (i < lines.length - 1) reconstructedBuffer += '\n';
            }
        }

        // Process remaining content for tags if not inside a block
        if (reconstructedBuffer) {
            if (lineProcessed) {
                // We processed some lines, so output remaining content appropriately
                this.outputContent(reconstructedBuffer);
                this.buffer = '';
            } else {
                // No lines processed, handle tags in the reconstructed buffer
                const processedLength = this.processTagsInContent(reconstructedBuffer);

                // Update buffer to only keep unprocessed content from the original buffer
                if (processedLength < reconstructedBuffer.length) {
                    this.buffer = reconstructedBuffer.substring(processedLength);
                } else {
                    this.buffer = '';
                }
            }
        } else if (lineProcessed) {
            this.buffer = '';
        } else {
            // No reconstructed buffer and no lines processed, handle tags in the full buffer
            const processedLength = this.processTagsInContent(this.buffer);

            // Update buffer to only keep unprocessed content
            if (processedLength < this.buffer.length) {
                this.buffer = this.buffer.substring(processedLength);
            } else {
                this.buffer = '';
            }
        }
    }

    private handleBlockLine(line: string): void {
        if (!this.insideBlock) {
            // Opening block
            const params = this.parseBlockParams(line);
            this.insideBlock = true;
            this.blockStartTime = Date.now();
            this.blockContent = '';
            this.blockParams = params;

            // Output the opening block line in gray with newline
            process.stdout.write(chalk.gray(line) + '\n');

            // Emit block opened event
            this.emit('blockOpened', {
                params: params,
            });
        } else {
            // Potential closing block
            if (line.trim() === '```') {
                // Valid closing block
                process.stdout.write(chalk.gray(line) + '\n');

                // Calculate duration and emit close event
                const duration = this.blockStartTime ? Date.now() - this.blockStartTime : 0;
                const fullBlockText = `\`\`\`${this.blockParams.join(' ')}\n${this.blockContent}\n\`\`\``;

                this.emit('blockClosed', {
                    tagName: this.insideBlock,
                    params: this.blockParams,
                    fullText: fullBlockText,
                    duration: duration,
                });

                // Reset block state
                this.insideBlock = false;
                this.blockStartTime = null;
                this.blockContent = '';
                this.blockParams = [];
            } else {
                // Not a valid closing block, treat as content
                this.outputContent(line + '\n');
            }
        }
    }

    private processTagsInContent(content: string): number {
        // Prevent recursive processing
        if (this.processingTags) {
            return content.length;
        }

        this.processingTags = true;
        let processedIndex = 0;
        const tagRegex = /<(\/?)(\w+)>/g;
        let match;

        // Reset regex lastIndex to scan from the beginning
        tagRegex.lastIndex = 0;

        while ((match = tagRegex.exec(content)) !== null) {
            const [fullMatch, isClosing, tagName] = match;
            const matchStart = match.index;
            const matchEnd = match.index + fullMatch.length;

            // Check if this is a special tag
            if (special_tags.includes(tagName.toLowerCase())) {
                // Output content before the tag
                const contentBeforeTag = content.substring(processedIndex, matchStart);
                if (contentBeforeTag) {
                    this.outputContent(contentBeforeTag);
                }

                if (isClosing === '/') {
                    // Closing tag
                    if (this.insideTag === tagName.toLowerCase()) {
                        // Output the closing tag in gray
                        process.stdout.write(chalk.gray(fullMatch));

                        // Calculate duration and emit close event
                        const duration = this.tagStartTime ? Date.now() - this.tagStartTime : 0;
                        const fullTagText = `<${tagName}>${this.tagContent}</${tagName}>`;

                        this.emit('tagClosed', {
                            tagName: tagName.toLowerCase(),
                            fullText: fullTagText,
                            duration: duration,
                        });

                        // Reset tag state
                        this.insideTag = null;
                        this.tagStartTime = null;
                        this.tagContent = '';
                    } else {
                        // Unmatched closing tag, treat as regular content
                        this.outputContent(fullMatch);
                    }
                } else {
                    // Opening tag
                    process.stdout.write(chalk.gray(fullMatch));
                    this.insideTag = tagName.toLowerCase();
                    this.tagStartTime = Date.now();
                    this.tagContent = '';

                    // Emit tag opened event
                    this.emit('tagOpened', {
                        tagName: tagName.toLowerCase(),
                    });
                }

                processedIndex = matchEnd;
            }
        }

        // Output remaining content (but track what we processed)
        const remainingContent = content.substring(processedIndex);
        if (remainingContent) {
            // Check if we should keep partial tags in buffer
            const partialTagMatch = remainingContent.match(/<\/?\w*$/);
            if (partialTagMatch) {
                // Output content before partial tag
                const safeContent = remainingContent.substring(0, partialTagMatch.index!);
                if (safeContent) {
                    this.outputContent(safeContent);
                }
                // Return how much we fully processed (excluding partial tag)
                this.processingTags = false;
                return processedIndex + partialTagMatch.index!;
            } else {
                // Output all remaining content
                this.outputContent(remainingContent);
                this.processingTags = false;
                return content.length;
            }
        }

        this.processingTags = false;
        return processedIndex;
    }

    private parseBlockParams(line: string): string[] {
        // Remove the ``` and split by spaces, but preserve quoted strings
        const content = line.substring(3).trim();
        if (!content) return [];

        const params: string[] = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';

        for (let i = 0; i < content.length; i++) {
            const char = content[i];

            if (!inQuotes && (char === '"' || char === "'")) {
                inQuotes = true;
                quoteChar = char;
                current += char;
            } else if (inQuotes && char === quoteChar) {
                inQuotes = false;
                quoteChar = '';
                current += char;
            } else if (!inQuotes && char === ' ') {
                if (current.trim()) {
                    params.push(current.trim());
                    current = '';
                }
            } else {
                current += char;
            }
        }

        if (current.trim()) {
            params.push(current.trim());
        }

        return params;
    }

    private outputContent(content: string): void {
        if (this.insideTag) {
            // Inside a special tag, output in gray and track content
            this.tagContent += content;
            const color = content_color[this.insideTag as keyof typeof content_color] || chalk.gray;
            process.stdout.write(color(content));
        } else if (this.insideBlock) {
            // Inside a block, output in gray and track content
            this.blockContent += content;
            process.stdout.write(chalk.cyan(content));
        } else {
            // Outside special tags/blocks, output in white
            process.stdout.write(chalk.white(content));
        }
    }

    // Call this when streaming ends to flush any remaining buffer
    finalize(): void {
        if (this.buffer) {
            this.outputContent(this.buffer);
            this.buffer = '';
        }

        // If we're still inside a block when streaming ends, emit a close event
        if (this.insideBlock) {
            const duration = this.blockStartTime ? Date.now() - this.blockStartTime : 0;
            const fullBlockText = `\`\`\`${this.blockParams.join(' ')}\n${this.blockContent}`;

            this.emit('blockClosed', {
                tagName: this.insideBlock,
                params: this.blockParams,
                fullText: fullBlockText,
                duration: duration,
            });
        }
    }
}

// Function to handle user input and chat response
async function handleUserInput(input: string, rl: readline.Interface, chat: Chat) {
    if (input.toLowerCase().trim() === 'exit' || input.toLowerCase().trim() === 'quit') {
        console.log(chalk.green('👋 Goodbye!'));
        rl.close();
        return;
    }

    if (input.trim() === '') {
        rl.prompt();
        return;
    }

    try {
        console.log(chalk.gray('Thinking...'));
        displayTasksList(currentTasks);

        // Send message to the agent and get response
        const streamChat = await chat.prompt(input).stream();

        // Clear the current line and move to a new line for the response
        process.stdout.write('\r');

        // Create content processor for this response
        const contentProcessor = new ContentProcessor();

        // Set up event listeners for tag events
        contentProcessor.on('tagOpened', (data) => {
            console.log(chalk.cyan(`\n[Tag Opened: ${data.tagName}]`));
        });

        contentProcessor.on('tagClosed', (data) => {
            console.log(chalk.blue(`\n[${data.tagName}] Took ${data.duration}ms`));
        });

        contentProcessor.on('blockOpened', (data) => {
            //console.log(chalk.magenta(`\n[Block Opened: ${data.params.join(' ')}]`));
        });

        contentProcessor.on('blockClosed', (data) => {
            console.log(chalk.blue(`\n[${data.tagName} Block] Took: ${data.duration}ms`));
        });

        streamChat.on(TLLMEvent.Data, (data) => {
            //console.log(chalk.gray('DATA  = ' + JSON.stringify(data)));
        });

        streamChat.on(TLLMEvent.Content, (content) => {
            displayTasksList(currentTasks);
            // Use the content processor to handle special tags and buffering
            contentProcessor.processContent(content);
        });

        streamChat.on(TLLMEvent.End, () => {
            // Finalize the content processor to flush any remaining buffer
            contentProcessor.finalize();
            console.log('\n');
            // Restore the prompt after streaming is complete
            displayTasksList(currentTasks);
            rl.prompt();
        });

        streamChat.on(TLLMEvent.Error, (error) => {
            console.error(chalk.red('❌ Error:', error));
            rl.prompt();
        });

        const toolCalls = {};

        streamChat.on(TLLMEvent.ToolCall, (toolCall) => {
            displayTasksList(currentTasks);
            if (toolCall?.tool?.name.startsWith('_sre_')) {
                return;
            }

            const args =
                typeof toolCall?.tool?.arguments === 'object'
                    ? Object.keys(toolCall?.tool?.arguments).map((key) => `${key}: ${toolCall?.tool?.arguments[key]}`)
                    : toolCall?.tool?.arguments;
            console.log(chalk.gray('\n[Calling Tool]'), chalk.gray(toolCall?.tool?.name), chalk.gray(args));

            toolCalls[toolCall?.tool?.id] = { startTime: Date.now() };
        });

        streamChat.on(TLLMEvent.ToolResult, (toolResult) => {
            if (toolResult?.tool?.name.startsWith('_sre_')) {
                return;
            }
            console.log(chalk.gray(toolResult?.tool?.name), chalk.gray(`Took: ${Date.now() - toolCalls[toolResult?.tool?.id].startTime}ms`));
            delete toolCalls[toolResult?.tool?.id];
            displayTasksList(currentTasks);
        });
    } catch (error) {
        console.error(chalk.red('❌ Error:', error));
        rl.prompt();
    }
}

function updateStickyTasksPanel() {
    if (!currentTasks || Object.keys(currentTasks).length === 0) return;

    const terminalWidth = process.stdout.columns || 80;
    const panelWidth = 55; // Increased width
    const panelHeight = 30;
    const panelStartCol = terminalWidth - panelWidth;

    // Save cursor position
    process.stdout.write('\u001b[s');

    // Clear the panel area first
    for (let row = 1; row <= panelHeight; row++) {
        process.stdout.write(`\u001b[${row};${panelStartCol}H`);
        process.stdout.write(' '.repeat(panelWidth));
    }

    let currentRow = 1;

    // Draw panel border and title
    process.stdout.write(`\u001b[${currentRow};${panelStartCol}H`);
    process.stdout.write(chalk.cyan('┌─ 📋 Tasks ') + chalk.cyan('─'.repeat(panelWidth - 13)) + chalk.cyan('┐'));
    currentRow++;

    // Display tasks
    Object.entries(currentTasks).forEach(([taskId, task]: [string, any]) => {
        if (currentRow >= panelHeight - 3) return; // Leave space for footer

        const summary = task.summary || task.description || 'No description';
        const status = task.status || 'planned';

        let statusColor: (text: string) => string = chalk.white;
        let icon = '';

        switch (status.toLowerCase()) {
            case 'completed':
            case 'done':
                statusColor = chalk.green;
                icon = '✅';
                break;
            case 'ongoing':
            case 'in progress':
                statusColor = chalk.yellow;
                icon = '⏳';
                break;
            case 'failed':
            case 'error':
                statusColor = chalk.red;
                icon = '❌';
                break;
            case 'planned':
            default:
                statusColor = chalk.blue;
                icon = '📝';
                break;
        }

        // Status line - use fixed positioning
        process.stdout.write(`\u001b[${currentRow};${panelStartCol}H`);
        process.stdout.write(chalk.cyan('│') + ' ');
        process.stdout.write(`${icon} ${statusColor(status.toUpperCase())}`);
        process.stdout.write(`\u001b[${currentRow};${panelStartCol + panelWidth - 1}H`);
        process.stdout.write(chalk.cyan('│'));
        currentRow++;

        // Summary line - use fixed positioning
        const maxSummaryLength = panelWidth - 5;
        const shortSummary = summary.length > maxSummaryLength ? summary.substring(0, maxSummaryLength - 3) + '...' : summary;

        process.stdout.write(`\u001b[${currentRow};${panelStartCol}H`);
        process.stdout.write(chalk.cyan('│') + '  ');
        process.stdout.write(chalk.white(shortSummary));
        process.stdout.write(`\u001b[${currentRow};${panelStartCol + panelWidth - 1}H`);
        process.stdout.write(chalk.cyan('│'));
        currentRow++;

        // Display subtasks if they exist
        if (task.subtasks && Object.keys(task.subtasks).length > 0) {
            Object.entries(task.subtasks).forEach(([subTaskId, subTask]: [string, any]) => {
                if (currentRow >= panelHeight - 3) return; // Leave space for footer

                const subSummary = subTask.summary || subTask.description || 'No description';
                const subStatus = subTask.status || 'planned';

                let subStatusColor: (text: string) => string = chalk.white;
                let subIcon = '';

                switch (subStatus.toLowerCase()) {
                    case 'completed':
                    case 'done':
                        subStatusColor = chalk.green;
                        subIcon = '✓';
                        break;
                    case 'ongoing':
                    case 'in progress':
                        subStatusColor = chalk.yellow;
                        subIcon = '○';
                        break;
                    case 'failed':
                    case 'error':
                        subStatusColor = chalk.red;
                        subIcon = '❌';
                        break;
                    case 'planned':
                    default:
                        subStatusColor = chalk.blue;
                        subIcon = '·';
                        break;
                }

                // Subtask status line - indented
                process.stdout.write(`\u001b[${currentRow};${panelStartCol}H`);
                process.stdout.write(chalk.cyan('│') + '   ');
                process.stdout.write(`${chalk.gray('└')} ${subIcon} ${subStatusColor(subStatus.toLowerCase())}`);
                process.stdout.write(`\u001b[${currentRow};${panelStartCol + panelWidth - 1}H`);
                process.stdout.write(chalk.cyan('│'));
                currentRow++;

                // Subtask summary line - indented
                const maxSubSummaryLength = panelWidth - 8;
                const shortSubSummary =
                    subSummary.length > maxSubSummaryLength ? subSummary.substring(0, maxSubSummaryLength - 3) + '...' : subSummary;

                process.stdout.write(`\u001b[${currentRow};${panelStartCol}H`);
                process.stdout.write(chalk.cyan('│') + '     ');
                process.stdout.write(chalk.gray(shortSubSummary));
                process.stdout.write(`\u001b[${currentRow};${panelStartCol + panelWidth - 1}H`);
                process.stdout.write(chalk.cyan('│'));
                currentRow++;
            });
        }

        // Empty line between tasks - use fixed positioning
        if (currentRow < panelHeight - 3) {
            process.stdout.write(`\u001b[${currentRow};${panelStartCol}H`);
            process.stdout.write(chalk.cyan('│'));
            process.stdout.write(`\u001b[${currentRow};${panelStartCol + panelWidth - 1}H`);
            process.stdout.write(chalk.cyan('│'));
            currentRow++;
        }
    });

    // Fill remaining rows if needed - use fixed positioning
    while (currentRow < panelHeight - 2) {
        process.stdout.write(`\u001b[${currentRow};${panelStartCol}H`);
        process.stdout.write(chalk.cyan('│'));
        process.stdout.write(`\u001b[${currentRow};${panelStartCol + panelWidth - 1}H`);
        process.stdout.write(chalk.cyan('│'));
        currentRow++;
    }

    // Summary footer
    if (currentTasks && Object.keys(currentTasks).length > 0) {
        let completed = 0,
            ongoing = 0,
            planned = 0;
        Object.values(currentTasks).forEach((task: any) => {
            const status = (task.status || 'planned').toLowerCase();
            if (status === 'completed' || status === 'done') completed++;
            else if (status === 'ongoing' || status === 'in progress') ongoing++;
            else planned++;

            // Count subtasks if they exist
            if (task.subtasks) {
                Object.values(task.subtasks).forEach((subTask: any) => {
                    const subStatus = (subTask.status || 'planned').toLowerCase();
                    if (subStatus === 'completed' || subStatus === 'done') completed++;
                    else if (subStatus === 'ongoing' || subStatus === 'in progress') ongoing++;
                    else planned++;
                });
            }
        });

        process.stdout.write(`\u001b[${currentRow};${panelStartCol}H`);
        process.stdout.write(chalk.cyan('├') + chalk.cyan('─'.repeat(panelWidth - 2)) + chalk.cyan('┤'));
        currentRow++;

        const countsText = `${chalk.green('✅' + completed)} ${chalk.yellow('⏳' + ongoing)} ${chalk.blue('📝' + planned)}`;
        process.stdout.write(`\u001b[${currentRow};${panelStartCol}H`);
        process.stdout.write(chalk.cyan('│') + ' ');
        process.stdout.write(countsText);
        process.stdout.write(`\u001b[${currentRow};${panelStartCol + panelWidth - 1}H`);
        process.stdout.write(chalk.cyan('│'));
        currentRow++;
    }

    // Bottom border
    process.stdout.write(`\u001b[${currentRow};${panelStartCol}H`);
    process.stdout.write(chalk.cyan('└') + chalk.cyan('─'.repeat(panelWidth - 2)) + chalk.cyan('┘'));

    // Restore cursor position
    process.stdout.write('\u001b[u');
}

function displayTasksList(tasksList: any) {
    currentTasks = tasksList || {};
    updateStickyTasksPanel();
}
