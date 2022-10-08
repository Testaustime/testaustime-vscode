"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testaustime_1 = require("./testaustime");
let testaustime;
function activate(context) {
    testaustime = new testaustime_1.default(context);
    testaustime.activate();
}
function deactivate() {
    testaustime.deactivate();
}
module.exports = {
    activate,
    deactivate,
};
//# sourceMappingURL=index.js.map