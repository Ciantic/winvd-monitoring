import { simpleMapEvent } from "./utils/simpleMapEvent.ts";

interface ClientAndProject {
    client: string;
    project: string;
}
export interface Timing {
    client: string;
    project: string;
    start: Date;
    end: Date;
}

export class ProjectMonitoringDb {
    private client = "";
    private project = "";
    private start?: Date;
    private timings: Timing[] = [];

    // Event listener hookup
    public onInsertTiming = simpleMapEvent<Timing, void>(this);

    constructor() {
        // TODO: Periodically save timings to database
    }

    public destroy() {}

    public startTiming({ client, project }: ClientAndProject, now = new Date()) {
        if (this.start) {
            throw new Error("Already timing");
        }
        this.client = client;
        this.project = project;
        this.start = new Date(now);
    }

    public stopTiming(now = new Date()) {
        if (this.start) {
            this.insertTiming({
                client: this.client,
                project: this.project,
                start: this.start,
                end: now,
            });
            this.start = undefined;
        } else {
            throw new Error("Not timing");
        }
    }

    public getCurrentTiming(now = new Date()) {
        if (this.start) {
            return {
                client: this.client,
                project: this.project,
                start: this.start,
                end: now,
            };
        }
    }

    private insertTiming(timing: Timing) {
        // Insert timing
        this.timings.push(timing);

        // Send event to listeners
        this.onInsertTiming.trigger(timing);
    }
}
