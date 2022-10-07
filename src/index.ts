import { ExtensionContext } from "vscode";
import Testaustime from "./testaustime";

let testaustime: Testaustime | null;

export async function activate(context: ExtensionContext) {
    testaustime = new Testaustime(context);
    await testaustime.activate();
}

export async function deactivate() {
    if (testaustime) await testaustime.deactivate();
}
