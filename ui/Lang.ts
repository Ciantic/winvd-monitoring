import { format } from "npm:date-fns";

export const Lang = {
    total: "Total",
    lastWeek: "Last week",
    thisWeek: "This week",
    eightWeek: "8 weeks",
    hours: "Hours",
    sum: "𝑓(x)=",
    price: "Price",
    client: "Client",
    project: "Project",
    day: "Day",
    summary: "Summary",
    export: "Export",
    close: "Close",
    showProjects: "Show projects",
    showClients: "Show clients",
};

export function formatDate(date: Date) {
    // If same year omit year
    if (date.getFullYear() === new Date().getFullYear()) {
        return format(date, "d.M. eee");
    }
    return format(date, "d.M.yyyy eee");
}

export function formatDateTsv(date: Date) {
    return format(date, "d.M.yyyy");
}

export function formatDecimal(value: number) {
    return value.toFixed(2).replace(".", ",");
}
