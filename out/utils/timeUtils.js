"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prettyDuration = void 0;
const date_fns_1 = require("date-fns");
const formatShort = {
    xSeconds: "{{count}}s",
    xMinutes: "{{count}}min",
    xHours: "{{count}}h",
    xDays: "{{count}}d"
};
// https://github.com/Testaustime/testaustime-frontend/blob/main/src/utils/dateUtils.ts
const prettyDuration = (seconds) => (0, date_fns_1.formatDuration)((0, date_fns_1.intervalToDuration)({ start: 0, end: Math.round((seconds || 0) * 1000 / 60000) * 60000 }), {
    locale: {
        // Let's just hope the token is one of these options
        formatDistance: (token, count) => {
            if (!(token in formatShort)) {
                console.warn("Unimplemented token", token);
                return "";
            }
            return formatShort[token].replace("{{count}}", String(count));
        }
    }
}) || "0s";
exports.prettyDuration = prettyDuration;
//# sourceMappingURL=timeUtils.js.map