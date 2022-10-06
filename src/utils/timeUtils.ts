import { formatDuration, intervalToDuration } from "date-fns";

const formatShort = {
  xSeconds: "{{count}}s",
  xMinutes: "{{count}}min",
  xHours: "{{count}}h",
  xDays: "{{count}}d"
};

// https://github.com/Testaustime/testaustime-frontend/blob/main/src/utils/dateUtils.ts
export const prettyDuration = (seconds: number) => formatDuration(
  intervalToDuration({ start: 0, end: Math.round((seconds || 0) * 1000 / 60000) * 60000 }),
  {
    locale: {
      formatDistance: (token: "xSeconds" | "xMinutes" | "xHours" | "xDays", count: number) => {
        if (!(token in formatShort)) {
          console.warn("Unimplemented token", token);
          return "";
        }

        return formatShort[token].replace("{{count}}", count.toString());
      }
    }
  }) || "0s";
