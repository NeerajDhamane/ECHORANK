const SQL_TIMESTAMP = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/** Convert a Date or ISO timestamp to SQLite's UTC timestamp format. */
export function toSqlTime(dateOrIso: Date | string): string {
  if (typeof dateOrIso === "string" && SQL_TIMESTAMP.test(dateOrIso)) {
    const parsedSqlTime = new Date(`${dateOrIso.replace(" ", "T")}Z`);
    if (!Number.isNaN(parsedSqlTime.getTime()) && parsedSqlTime.toISOString().slice(0, 19).replace("T", " ") === dateOrIso) {
      return dateOrIso;
    }
  }

  const date = dateOrIso instanceof Date ? dateOrIso : new Date(dateOrIso);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid date: expected a valid Date or ISO timestamp.");
  }

  return date.toISOString().slice(0, 19).replace("T", " ");
}
