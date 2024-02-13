import * as vscode from "vscode";
import axios from "axios";
import * as os from "os";
import startOfToday from "date-fns/startOfToday";
import { prettyDuration } from "./utils/timeUtils";
import { createHash } from "crypto";

type Pointer = `${number},${number}`;

class TestaustimeUriHandler implements vscode.UriHandler {
    private testaustime: Testaustime;

    constructor(testaustime: Testaustime) {
        this.testaustime = testaustime;
    }

	handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
        if (uri.path != "/authorize") return;
        const queryParameters = new URLSearchParams(uri.query);
        const apikey = queryParameters.get('token');
        if (!apikey) return;
        this.testaustime.updateApikey(apikey);
	}
}

class Testaustime {
    apikey!: string;
    username!: string;
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
            this.statusbar.tooltip = `Username: ${this.username}\nYou have coded ${prettyDuration(totalSeconds)} today`;
            this.statusbar.text = `Testaustime: ${prettyDuration(totalSeconds)} ✅`;
        }).catch(() => {
            this.statusbar.text = "Testaustime: Error";
        });
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

    async validateApikey(key: string): Promise<MeModel | null> {
        return await axios.get<MeModel>(`${this.endpoint}/users/@me`, {
            headers: {
                Authorization: `Bearer ${key}`
            }
        }).then(res => res.data).catch(() => null);
    }

    async updateApikey(key: string): Promise<boolean> {
        const isValid = await this.validateApikey(key);

        if (!isValid) {
            this.setApikeyInvalidText();
            vscode.window.showErrorMessage("Invalid API key!");
            return false;
        }

        this.username = isValid.username;
        this.apikey = key;
        this.apikeyValid = true;
        this.setActiveText();
        this.context.globalState.update("apikey", key);
        vscode.window.showInformationMessage("API key set!");
        return true;
    }

    commands() {
        const setapikey = vscode.commands.registerCommand("testaustime.setapikey", async () => {
            const result = await vscode.window.showInputBox({
                placeHolder: "Your API key from https://testaustime.fi/profile",
                password: true,
            });

            if (result) {
                this.updateApikey(result);   
            }
        });

        const openauthorize = vscode.commands.registerCommand("testaustime.openauthorize", async () => {
            const url = vscode.Uri.parse('https://testaustime.fi/authorize?editor=vscode');
            vscode.env.openExternal(url);
        });

        const openstatusbar = vscode.commands.registerCommand("testaustime.openstatusbar", async () => {
            let url;
            if (!this.apikeyValid) {
                url = vscode.Uri.parse('https://testaustime.fi/authorize?editor=vscode');
            } else {
                url = vscode.Uri.parse('https://testaustime.fi');
            }
            vscode.env.openExternal(url);
        });

        this.context.subscriptions.push(setapikey);
        this.context.subscriptions.push(openauthorize);
        this.context.subscriptions.push(openstatusbar);
    }

    async activate() {
        this.apikey = this.context.globalState.get("apikey") ?? "";

        this.commands();

        this.statusbar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);

        if (this.apikey == "") {
            this.statusbar.text = "Testaustime: Click to Setup";
            this.apikeyValid = false;
        } else {
            const isApikeyValid = await this.validateApikey(this.apikey);
            if (!isApikeyValid) {
                this.apikeyValid = false;
                this.setApikeyInvalidText();
            } else {
                this.username = isApikeyValid.username;
            }
        }

        this.setActiveText();
        
        const uriHandler = new TestaustimeUriHandler(this);
        this.context.subscriptions.push(vscode.window.registerUriHandler(uriHandler))

        this.statusbar.command = "testaustime.openstatusbar"
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
