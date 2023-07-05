import { format } from "npm:date-fns";

export const Lang = {
    total: "Total",
    lastWeek: "Last Week",
    thisWeek: "This Week",
    eightWeek: "8 weeks",
    hours: "Hours",
    sum: "𝑓(x)=",
    price: "Price",
    client: "Client",
    project: "Project",
    day: "Day",
    summary: "Summary",
};

export function formatDate(date: Date) {
    // If same year omit year
    if (date.getFullYear() === new Date().getFullYear()) {
        return format(date, "d.M. eee");
    }
    return format(date, "d.M.yyyy eee");
}
