import * as vscode from "vscode";
import axios from "axios";
import * as os from "os";

class Testaustime {
    apikey!: string;
    endpoint!: string;
    config: vscode.Memento;
    interval!: NodeJS.Timeout;
    context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.config = context.globalState;

        this.apikey = this.config.get("apikey", "");
        this.endpoint = this.config.get("endpoint", "https://time.lajp.fi");
    }

    data(): object {
        return {
            project_name: vscode.workspace.name,
            language: vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.languageId : '',
            editor_name: "vscode",
            hostname: os.hostname(),
        }
    }

    heartbeat() {
        axios.post(`${this.endpoint}/activity/update`, this.data(), {
            headers: {
                Authorization: `Bearer ${this.apikey}`,
            },
        });
    }

    flush() {
        axios.post(`${this.endpoint}/activity/flush`, "", {
            headers: {
                Authorization: `Bearer ${this.apikey}`
            }
        });
    }

    async validateApikey(key: string): Promise<boolean> {
        const result = await axios.get(`${this.endpoint}/users/@me`, {
            headers: {
                Authorization: `Bearer ${key}`
            }
        });

        return result.status === 200 ? true : false;
    }

    commands() {
        const setapikey = vscode.commands.registerCommand('testaustime.setapikey', async () => {
            await vscode.window.showInputBox({
                placeHolder: 'Your API-key',

            }).then(async (result) => {
                if (result) {
                    vscode.window.showInformationMessage('Testing API-key...');
                    const isValid: boolean = await this.validateApikey(result);

                    if (!isValid) {
                        vscode.window.showInformationMessage('API key invalid');
                        return;
                    }

                    this.apikey = result;
                    this.config.update('apikey', result);
                    vscode.window.showInformationMessage('API key set!');
                }
            });
        });

        const setendpoint = vscode.commands.registerCommand('testaustime.setendpoint', async () => {
            await vscode.window.showInputBox({
                placeHolder: this.endpoint,
                validateInput: (text) => (text.endsWith('/') ? 'Don\'t include the last slash' : null),
            }).then((result) => {
                if (result) {
                    this.endpoint = result;
                    this.config.update('endpoint', result);
                    vscode.window.showInformationMessage('Endpoint key set!');
                }
            })
        });

        this.context.subscriptions.push(setapikey);
        this.context.subscriptions.push(setendpoint);
    }

    activate() {
        this.commands();
        if (!this.validateApikey(this.apikey)) {
            vscode.window.showErrorMessage('API key invalid!');
        }

        console.log('Testaustime activated!');

        this.interval = setInterval(() => {
            if (this.apikey) {
                if (!vscode.window.state.focused) {
                    this.flush();
                    return;
                }

                this.heartbeat();
            }
        }, 20000);
    }

    deactivate() {
        clearInterval(this.interval);
        this.flush();
    }
}

export default Testaustime;