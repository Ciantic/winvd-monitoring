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
    private lastKeepAlive?: Date;
    private keepAliveInterval = 0;
    private timings: Timing[] = [];

    // Event listener hookup
    public onInsertTiming = simpleMapEvent<Timing, void>(this);

    constructor(enableKeepAlive: boolean) {
        if (enableKeepAlive) {
            this.keepAliveInterval = setInterval(() => this.keepAlive(), 30 * 1000);
        }

        // TODO: Periodically save timings to database
    }

    public destroy() {
        clearInterval(this.keepAliveInterval);
    }

    public startTiming({ client, project }: ClientAndProject, now = new Date()) {
        if (this.start) {
            throw new Error("Already timing");
        }
        this.client = client;
        this.project = project;
        this.start = new Date(now);
    }

    public stopTiming(now = new Date()) {
        if (this.lastKeepAlive) {
            this.keepAlive(now);
        }
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

    private keepAlive(now = new Date()) {
        // If the length exceeds the max, stop the timing and start a new one
        if (
            this.start &&
            this.lastKeepAlive &&
            now.getTime() - this.lastKeepAlive.getTime() > 60 * 1000
        ) {
            console.warn("Keep alive didn't happen in time", this.lastKeepAlive, now);

            // Stop the timing on the last known good value
            this.stopTiming(this.lastKeepAlive);

            // Start the timing from current moment
            this.startTiming({ client: this.client, project: this.project }, now);
        }

        this.lastKeepAlive = now;
    }

    private insertTiming(timing: Timing) {
        // Insert timing
        this.timings.push(timing);

        // Send event to listeners
        this.onInsertTiming.trigger(timing);
    }
}
