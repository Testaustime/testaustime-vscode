import * as vscode from "vscode";
import axios from "axios";
import * as os from "os";
import { prettyDuration } from "./utils/timeUtils";
import { startOfToday } from "date-fns";

class Testaustime {
    apikey!: string;
    endpoint!: string;
    config: vscode.Memento;
    interval!: NodeJS.Timeout;
    apikeyValid: boolean = true;
    context: vscode.ExtensionContext;
    statusbar!: vscode.StatusBarItem;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.config = context.globalState;

        this.apikey = this.config.get("apikey", "");
        this.endpoint = this.config.get("endpoint", "https://api.testaustime.fi");
    }


    //statusbar
    setApikeyInvalidText() {
        this.statusbar.text = "Testaustime: API key invalid!";
        this.statusbar.command = "testaustime.setapikey";
    }

    setActiveText() {
        const start = startOfToday().getTime() / 1000 - new Date().getTimezoneOffset() * 60;

        // Returns other properties in addition to duration, but this is all we need for now
        axios.get<{ duration: number }[]>(`${this.endpoint}/users/@me/activity/data?from=${start}`, {
            headers: {
                Authorization: `Bearer ${this.apikey}`,
            },
        }).then(response => {
            const totalSeconds = response.data.reduce((acc, cur) => acc + cur.duration, 0);
            this.statusbar.tooltip = `You have coded ${prettyDuration(totalSeconds)} today`;
            this.statusbar.text = `Testaustime: ${prettyDuration(totalSeconds)} ✅`;
        }).catch(() => {
            this.statusbar.text = "Testaustime: Error";
        });
        
        this.statusbar.text = "Testaustime: ✅";
        this.statusbar.command = undefined;
    }
    //end statusbar

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
        return await axios.get(`${this.endpoint}/users/@me`, {
            headers: {
                Authorization: `Bearer ${key}`
            }
        }).then(() => true).catch(() => false);
    }

    commands() {
        const setapikey = vscode.commands.registerCommand('testaustime.setapikey', async () => {
            await vscode.window.showInputBox({
                placeHolder: 'Your API-key',

            }).then(async (result) => {
                if (result) {
                    const isValid: boolean = await this.validateApikey(result);

                    if (!isValid) {
                        this.setApikeyInvalidText();
                        return;
                    }

                    this.apikey = result;
                    this.setActiveText();
                    this.apikeyValid = true;
                    this.config.update('apikey', result);
                    vscode.window.showInformationMessage('API key set!');
                }
            });
        });

        const setendpoint = vscode.commands.registerCommand('testaustime.setendpoint', async () => {
            await vscode.window.showInputBox({
                placeHolder: this.endpoint,
            }).then((result) => {
                if (result) {
                    if (result.endsWith('/')) {
                        result = result.slice(0, -1);
                    }
                    this.endpoint = result;
                    this.config.update('endpoint', result);
                    vscode.window.showInformationMessage('Endpoint key set!');
                }
            });
        });

        this.context.subscriptions.push(setapikey);
        this.context.subscriptions.push(setendpoint);
    }

    async activate() {
        this.commands();

        this.statusbar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        this.setActiveText();
        this.statusbar.show();

        if (!await this.validateApikey(this.apikey)) {
            this.apikeyValid = false;
            this.setApikeyInvalidText();
        }

        this.interval = setInterval(() => {
            if (this.apikeyValid) {
                if (!vscode.window.state.focused) return;
                this.heartbeat();
            }
        }, 20000);
    }

    deactivate() {
        clearInterval(this.interval);
        if (!this.apikeyValid) return;
        this.flush();
    }
}

export default Testaustime;
