const vscode = require('vscode'); // eslint-disable-line import/no-unresolved
const axios = require('axios');
const os = require('os');

class Heartbeat {
    constructor(projectName, language, editorName, hostname) {
        this.project_name = projectName;
        this.language = language;
        this.editor_name = editorName;
        this.hostname = hostname;
    }

    toJSON() {
        return {
            project_name: this.project_name,
            language: this.language,
            editor_name: this.editor_name,
            hostname: this.hostname,
        };
    }
}

function getData() {
    return new Heartbeat(
        vscode.workspace.name,
        vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.languageId : '',
        'vscode',
        os.hostname(),
    );
}

function sendHeartbeat(context, data) {
    if (!data.language) return;
    const config = context.globalState;
    const apikey = config.get('apikey'); // eslint-disable-line no-unused-vars
    const endpoint = config.get('endpoint', 'https://time.lajp.fi');
    axios.post(`${endpoint}/activity/update`,
        data,
        {
            headers: {
                Authorization: `Bearer ${apikey}`,
            },
        });
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    const config = context.globalState;
    let apikey = config.get('apikey'); // eslint-disable-line no-unused-vars
    let endpoint = config.get('endpoint', 'https://time.lajp.fi');
    // Called when activated
    console.log('Testaustime activated!');

    // Must be defined in package.json
    const test = vscode.commands.registerCommand('testaustime.test', () => {
        vscode.window.showInformationMessage(JSON.stringify(getData()));
    });

    const setapikey = vscode.commands.registerCommand('testaustime.setapikey', async () => {
        const result = await vscode.window.showInputBox({
            placeHolder: 'Your API-key',
        });
        if (!result) return;
        vscode.window.showInformationMessage('Testing API-key...');
        axios.post(`${endpoint}/activity/update`, getData(), {
            headers: {
                Authorization: `Bearer ${result}`,
            },
        })
            .then(() => {
                config.update('apikey', result);
                apikey = config.get('apikey');
                vscode.window.showInformationMessage('API key set!');
            })
            .catch(() => {
                vscode.window.showInformationMessage('API key invalid');
            });
    });

    const setcustomapi = vscode.commands.registerCommand('testaustime.setendpoint', async () => {
        const result = await vscode.window.showInputBox({
            placeHolder: 'https://time.lajp.fi',
            validateInput: (text) => (text.endsWith('/') ? 'Don\'t include the last slash' : null),
        });
        if (!result || result.endsWith('/')) return;
        config.update('endpoint', result);
        endpoint = config.get('endpoint');
        vscode.window.showInformationMessage('Endpoint key set!');
    });

    context.subscriptions.push(test);
    context.subscriptions.push(setapikey);
    context.subscriptions.push(setcustomapi);

    setInterval(() => {
        if (apikey && vscode.window.state.focused) {
            sendHeartbeat(context, getData());
        }
    }, 30000);
}

function deactivate() {
    // Called when deactivated
}

module.exports = {
    activate,
    deactivate,
};
