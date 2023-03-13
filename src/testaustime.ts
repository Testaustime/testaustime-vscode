import * as vscode from "vscode";
import axios from "axios";
import * as os from "os";
import startOfToday from "date-fns/startOfToday";
import { prettyDuration } from "./utils/timeUtils";
import { createHash } from "crypto";

type Pointer = `${number},${number}`;

class Testaustime {
    apikey!: string;
    endpoint: string;
    config: vscode.WorkspaceConfiguration;
    interval!: NodeJS.Timeout;
    apikeyValid: boolean = true;
    context: vscode.ExtensionContext;
    statusbar!: vscode.StatusBarItem;
    pointer: Pointer = "0,0";

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.config = vscode.workspace.getConfiguration("testaustime");

        this.endpoint = this.config.get<string>("apiEndpoint", "https://api.testaustime.fi");
    }

    setApikeyInvalidText() {
        this.statusbar.text = "Testaustime: API key invalid!";
        this.statusbar.command = "testaustime.setapikey";
    }

    setActiveText() {
        if (!this.apikeyValid) return;

        const start = startOfToday().getTime() / 1000 - new Date().getTimezoneOffset() * 60;

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
        
        this.statusbar.command = undefined;
    }

    data() {
        const hidden = this.config.get<string[]>("hiddenPaths", []);
        const hide = vscode.workspace.workspaceFolders?.some((f) =>
           hidden.some((p) => f.uri.fsPath.startsWith(p))
        ) ?? false;
        return {
            project_name: hide ? `hidden-${
                createHash("sha256").update(vscode.workspace.name ?? "No workspace").digest("hex").slice(0, 7)
            }` : (vscode.workspace.name ?? "No workspace"),
            language: vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.languageId : "",
            editor_name: "vscode",
            hostname: os.hostname(),
        }
    }

    async heartbeat() {
        await axios.post(`${this.endpoint}/activity/update`, this.data(), {
            headers: {
                Authorization: `Bearer ${this.apikey}`,
            },
        }).catch(() => null);
    }

    async flush() {
        await axios.post(`${this.endpoint}/activity/flush`, "", {
            headers: {
                Authorization: `Bearer ${this.apikey}`
            }
        }).catch(() => null);
    }

    async validateApikey(key: string): Promise<boolean> {
        return await axios.get(`${this.endpoint}/users/@me`, {
            headers: {
                Authorization: `Bearer ${key}`
            }
        }).then(() => true).catch(() => false);
    }

    commands() {
        const setapikey = vscode.commands.registerCommand("testaustime.setapikey", async () => {
            const result = await vscode.window.showInputBox({
                placeHolder: "Your API key from https://testaustime.fi/profile",
                password: true,
            });

            if (result) {
                const isValid = await this.validateApikey(result);

                if (!isValid) {
                    this.setApikeyInvalidText();
                    vscode.window.showErrorMessage("Invalid API key!");
                    return;
                }

                this.apikey = result;
                this.apikeyValid = true;
                this.setActiveText();
                this.context.globalState.update("apikey", result);
                vscode.window.showInformationMessage("API key set!");
            }
        });

        this.context.subscriptions.push(setapikey);
    }

    async activate() {
        this.apikey = this.context.globalState.get("apikey") ?? "";

        this.commands();

        this.statusbar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        this.setActiveText();

        if (!(await this.validateApikey(this.apikey))) {
            this.apikeyValid = false;
            this.setApikeyInvalidText();
        }

        this.statusbar.show();

        this.interval = setInterval(() => {
            if (this.config.get<boolean>("disabled", false) || !this.apikeyValid || !vscode.window.activeTextEditor) return;
            const pointerpos = vscode.window.activeTextEditor.selection.active;
            const newPointer: Pointer = `${pointerpos.line},${pointerpos.character}`;
            if (!vscode.window.state.focused || newPointer === this.pointer) return;
            this.pointer = newPointer;
            this.heartbeat();
            this.setActiveText();
        }, 30_000);
    }

    async deactivate() {
        clearInterval(this.interval);
        if (this.apikeyValid) await this.flush();
    }
}

export default Testaustime;
