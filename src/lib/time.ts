/** Time-zone helpers that avoid pulling in a date library. */

function parts(date: Date, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const get = (type: string) => Number(f.formatToParts(date).find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), mi: get("minute"), s: get("second") };
}

/** Local-minus-UTC offset in ms for `timeZone` at `date`. */
function offsetMs(date: Date, timeZone: string): number {
  const p = parts(date, timeZone);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant at which the local calendar day containing `date` began in `timeZone`. */
export function startOfDayInZone(date: Date, timeZone: string): Date {
  const p = parts(date, timeZone);
  const utcMidnight = Date.UTC(p.y, p.m - 1, p.d, 0, 0, 0);
  return new Date(utcMidnight - offsetMs(new Date(utcMidnight), timeZone));
}
