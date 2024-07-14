import { format } from "npm:date-fns";

export function formatDateLong(date: Date) {
    // If same year omit year
    if (date.getFullYear() === new Date().getFullYear()) {
        return format(date, "d.M. eee");
    }
    return format(date, "d.M.yyyy eee");
}

export function formatDate(date: Date) {
    // If same year omit year
    if (date.getFullYear() === new Date().getFullYear()) {
        return format(date, "d.M.");
    }
    return format(date, "d.M.yyyy");
}

export function formatDateTsv(date: Date) {
    return format(date, "d.M.yyyy");
}

export function formatDecimal(value: number) {
    return value.toFixed(2).replace(".", ",");
}

function parseFinnishDate(date: string): Date | undefined {
    // If date in format "jj.nn.(yyyy)?"
    const match = date.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})?$/);
    if (!match) {
        return undefined;
    }
    const day = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const maybeYear = match[3];
    const d = new Date();
    d.setDate(day);
    d.setMonth(month);
    if (maybeYear) {
        d.setFullYear(parseInt(maybeYear));
    }
    // Set time to 00:00:00.000
    d.setHours(0);
    d.setMinutes(0);
    d.setSeconds(0);
    d.setMilliseconds(0);
    return d;
}

function parseFinnishDateRange(range: string): { from: Date; to: Date } | undefined {
    const match = range.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})?-(\d{1,2})\.(\d{1,2})\.(\d{4})?$/);
    if (!match) {
        return undefined;
    }
    const fromDay = parseInt(match[1]);
    const fromMonth = parseInt(match[2]) - 1;
    const fromYear = match[3] ? parseInt(match[3]) : undefined;
    const toDay = parseInt(match[4]);
    const toMonth = parseInt(match[5]) - 1;
    const toYear = match[6] ? parseInt(match[6]) : undefined;
    const from = new Date();
    if (fromYear || toYear) {
        from.setFullYear(fromYear || toYear || 0);
    }
    from.setMonth(fromMonth);
    from.setDate(fromDay);
    from.setHours(0);
    from.setMinutes(0);
    from.setSeconds(0);
    from.setMilliseconds(0);

    const to = new Date();
    if (toYear || fromYear) {
        to.setFullYear(toYear || fromYear || 0);
    }
    to.setMonth(toMonth);
    to.setDate(toDay);
    to.setHours(23);
    to.setMinutes(59);
    to.setSeconds(59);
    to.setMilliseconds(999);
    return { from, to };
}

export function parseDateRange(range: string): { from: Date; to?: Date } | undefined {
    // If only one date is given, assume it's a date range from that day until
    // end of that day
    {
        const finnishDate = parseFinnishDate(range);
        if (finnishDate) {
            const from = new Date(finnishDate);

            // End of the given day
            const to = new Date(finnishDate);
            // Set to time to last millisecond of the day
            to.setHours(23);
            to.setMinutes(59);
            to.setSeconds(59);
            to.setMilliseconds(999);
            return { from, to };
        }
    }

    // If only one date and dash is given assume it's a date range from that day (to unknown date)
    {
        if (range.endsWith("-")) {
            const finnishDate = parseFinnishDate(range.slice(0, -1));
            if (finnishDate) {
                const from = new Date(finnishDate);
                return { from };
            }
        }
    }

    // Normal date range
    {
        const finnishDateRange = parseFinnishDateRange(range);
        if (finnishDateRange) {
            return finnishDateRange;
        }
    }
    {
        // If the range is "n months" or "n weeks" or "n days" or "n hours" or "n minutes"
        const match = range.match(/^(\d+) (months?|weeks?|days?)$/);
        if (match) {
            const amount = parseInt(match[1]);
            const unit = match[2];
            const to = new Date();
            const from = new Date(to);
            switch (unit) {
                case "month":
                case "months":
                    from.setMonth(from.getMonth() - amount);
                    break;
                case "week":
                case "weeks":
                    from.setDate(from.getDate() - amount * 7);
                    break;
                case "day":
                case "days":
                    from.setDate(from.getDate() - amount);
                    break;
            }
            return { from, to };
        }
    }
    return undefined;
}

export function formatDateRange(range: { from: Date; to: Date }) {
    const from = formatDate(range.from);
    const to = formatDate(range.to);
    if (from === to) {
        return from;
    }
    const fromYear = range.from.getFullYear();
    const toYear = range.to.getFullYear();
    if (fromYear === toYear) {
        return `${from.replace("" + fromYear, "")}-${to}`;
    }
    return `${from}-${to}`;
}
