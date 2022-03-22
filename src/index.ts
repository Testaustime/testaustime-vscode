import { ExtensionContext } from "vscode";
import Testaustime from "./testaustime";


let testaustime: Testaustime;
function activate(context: ExtensionContext) {
    testaustime = new Testaustime(context);
    testaustime.activate();
}
function deactivate() {
    testaustime.deactivate();
}

module.exports = {
    activate,
    deactivate,
};
