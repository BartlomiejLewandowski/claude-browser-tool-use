import { toolRegistry } from './tool/registry';
import { ToolSetupState } from './tool/tool';
import * as readline from 'readline';
import './tool'; // Import to ensure all tools are registered

// Import chalk for colored console output
let chalk: any;
try {
    chalk = require('chalk');
} catch (error) {
    // Create a simple mock if chalk is not installed
    chalk = {
        bold: (text: string) => text,
        green: (text: string) => text,
        yellow: (text: string) => text,
        red: (text: string) => text,
        blue: (text: string) => text,
        gray: (text: string) => text
    };
    console.warn('Chalk package not found. Install it for colored output: npm install chalk');
}

/**
 * Display the setup status of all registered tools
 */
async function displayToolStatus() {
    console.log(chalk.bold('\nClaude Tool Use - Setup Status:'));
    console.log('---------------------------------------\n');

    const toolEntries = Object.entries(toolRegistry);

    if (toolEntries.length === 0) {
        console.log(chalk.yellow('No tools have been registered yet.'));
        return;
    }

    for (const [name, tool] of toolEntries) {
        const status = await tool.checkSetupStatus();

        let statusIndicator: string;
        let statusText: string;

        switch (status.state) {
            case ToolSetupState.AUTHENTICATED:
                statusIndicator = chalk.green('✅');
                statusText = chalk.green('Ready');
                break;
            case ToolSetupState.CONFIGURED:
                statusIndicator = chalk.yellow('⚠️');
                statusText = chalk.yellow('Needs authentication');
                break;
            case ToolSetupState.REGISTERED:
                statusIndicator = chalk.red('❌');
                statusText = chalk.red('Missing credentials');
                break;
        }

        console.log(`${statusIndicator} ${chalk.bold(name)}: ${statusText}`);
        if (status.additionalInfo) {
            console.log(`   ${chalk.gray(status.additionalInfo)}`);
        }
    }

    console.log('\nCommands:');
    console.log(`  ${chalk.blue('npm run setup -- setup <tool>')}  : Configure credentials for a tool`);
    console.log(`  ${chalk.blue('npm run setup -- auth <tool>')}   : Authenticate a configured tool`);
    console.log(`  ${chalk.blue('npm run setup -- verify <tool>')} : Verify a tool is working correctly`);
}

/**
 * Verify that a tool is working correctly
 */
async function verifyTool(toolName: string) {
    console.log(`\nVerifying ${chalk.bold(toolName)} tool...`);

    const tool = toolRegistry[toolName];
    if (!tool) {
        console.error(chalk.red(`Tool "${toolName}" not found`));
        return;
    }

    const status = await tool.checkSetupStatus();

    if (status.state !== ToolSetupState.AUTHENTICATED) {
        console.log(chalk.yellow(`⚠️ Tool "${toolName}" is not fully authenticated.`));
        console.log('Please complete setup and authentication first.');
        return;
    }

    console.log(chalk.green(`✅ Tool "${toolName}" is properly configured and authenticated.`));
    console.log(`You can now use the ${chalk.bold(toolName)} tool with Claude!`);
}

/**
 * List all available tools
 */
function listTools() {
    const toolNames = Object.keys(toolRegistry);

    console.log('\nAvailable tools:');

    if (toolNames.length === 0) {
        console.log(chalk.yellow('No tools have been registered yet.'));
        return;
    }

    toolNames.forEach(name => {
        console.log(`- ${name}`);
    });
}

/**
 * Show setup command help
 */
function showHelp() {
    console.log(chalk.bold('\nClaude Tool Use - Setup Help:'));
    console.log('-------------------------------\n');

    console.log('Available commands:');
    console.log(`  ${chalk.blue('npm run setup')}                 : Display setup status of all tools`);
    console.log(`  ${chalk.blue('npm run setup -- list')}         : List all available tools`);
    console.log(`  ${chalk.blue('npm run setup -- setup <tool>')} : Configure credentials for a tool`);
    console.log(`  ${chalk.blue('npm run setup -- auth <tool>')}  : Authenticate a configured tool`);
    console.log(`  ${chalk.blue('npm run setup -- verify <tool>')} : Verify a tool is working correctly`);
    console.log(`  ${chalk.blue('npm run setup -- help')}         : Show this help message`);

    console.log('\nExamples:');
    console.log(`  ${chalk.blue('npm run setup -- setup calendar')} : Set up Google Calendar credentials`);
    console.log(`  ${chalk.blue('npm run setup -- auth spotify')}   : Authenticate with Spotify`);
}

/**
 * Interactive tool selection
 */
async function interactiveSelection() {
    const toolNames = Object.keys(toolRegistry);

    if (toolNames.length === 0) {
        console.log(chalk.yellow('No tools have been registered yet.'));
        return;
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log(chalk.bold('\nAvailable tools:'));
    toolNames.forEach((name, index) => {
        console.log(`${index + 1}. ${name}`);
    });

    const question = () => {
        return new Promise<string>((resolve) => {
            rl.question('\nSelect a tool (number) or type "exit" to quit: ', (answer) => {
                if (answer.toLowerCase() === 'exit') {
                    rl.close();
                    resolve('exit');
                    return;
                }

                const index = parseInt(answer) - 1;
                if (isNaN(index) || index < 0 || index >= toolNames.length) {
                    console.log(chalk.red('Invalid selection. Please try again.'));
                    resolve(question());
                } else {
                    resolve(toolNames[index]);
                }
            });
        });
    };

    const toolName = await question();

    if (toolName === 'exit') {
        return;
    }

    rl.close();

    console.log(`\nSelected tool: ${chalk.bold(toolName)}`);

    const actionRl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log('\nWhat would you like to do?');
    console.log('1. Setup credentials');
    console.log('2. Authenticate');
    console.log('3. Verify');

    const action = await new Promise<string>((resolve) => {
        actionRl.question('\nSelect an action (number): ', (answer) => {
            const index = parseInt(answer);
            if (isNaN(index) || index < 1 || index > 3) {
                console.log(chalk.red('Invalid selection.'));
                resolve('invalid');
            } else if (index === 1) {
                resolve('setup');
            } else if (index === 2) {
                resolve('auth');
            } else if (index === 3) {
                resolve('verify');
            }
        });
    });

    actionRl.close();

    const tool = toolRegistry[toolName];

    if (action === 'setup') {
        await tool.setupCredentials();
    } else if (action === 'auth') {
        await tool.authenticate();
    } else if (action === 'verify') {
        await verifyTool(toolName);
    }
}

/**
 * Main function to handle command-line arguments
 */
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const toolName = args[1];

    // Import all tools to ensure they're registered
    require('./tool/index');

    // No command, show status (default action)
    if (!command) {
        await displayToolStatus();
        return;
    }

    // Handle commands that don't require a tool name
    switch (command) {
        case 'help':
            showHelp();
            return;
        case 'list':
            listTools();
            return;
        case 'interactive':
            await interactiveSelection();
            return;
    }

    // Commands that require a tool name
    if (!toolName) {
        console.error(chalk.red(`The command "${command}" requires a tool name`));
        console.log(`Try: ${chalk.blue(`npm run setup -- ${command} <tool>`)}`);
        console.log(`Available tools: ${Object.keys(toolRegistry).join(', ')}`);
        return;
    }

    // Find the requested tool
    const tool = toolRegistry[toolName];
    if (!tool) {
        console.error(chalk.red(`Tool "${toolName}" not found`));
        console.log(`Available tools: ${Object.keys(toolRegistry).join(', ')}`);
        return;
    }

    // Execute the requested command
    switch (command) {
        case 'setup':
            await tool.setupCredentials();
            break;
        case 'auth':
            await tool.authenticate();
            break;
        case 'verify':
            await verifyTool(toolName);
            break;
        default:
            console.error(chalk.red(`Unknown command: ${command}`));
            console.log('Valid commands: setup, auth, verify, list, interactive, help');
    }
}

// Run the main function
main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
