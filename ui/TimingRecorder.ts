import { TimingDb } from "./TimingDb.ts";
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

export class TimingRecorder {
    private client = "";
    private project = "";
    private started?: Date;
    private lastKeepAlive?: Date;
    private keepAliveInterval = 0;
    private timings: Timing[] = [];

    // Event listener hookup
    public onInsertTiming = simpleMapEvent<Timing, void>(this);

    constructor(
        enableKeepAlive: boolean,
        private save: (
            timings: { start: Date; end: Date; project: string; client: string }[]
        ) => Promise<void>,
        now = new Date()
    ) {
        if (enableKeepAlive) {
            this.lastKeepAlive = new Date(now);
            this.keepAliveInterval = setInterval(() => this.keepAlive(), 30 * 1000);
        }

        // TODO: Periodically save timings to database
    }

    public destroy() {
        clearInterval(this.keepAliveInterval);
    }

    public start({ client, project }: ClientAndProject, now = new Date()) {
        if (this.started) {
            throw new Error("Already timing");
        }
        this.client = client;
        this.project = project;
        this.started = new Date(now);
    }

    public stop(now = new Date()) {
        this.keepAlive(now);
        if (this.started) {
            this.insertTiming({
                client: this.client,
                project: this.project,
                start: this.started,
                end: new Date(now),
            });
            this.started = undefined;
        } else {
            throw new Error("Not timing");
        }
    }

    public getCurrent(now = new Date()) {
        if (this.started) {
            this.keepAlive(now);
            return {
                client: this.client,
                project: this.project,
                start: this.started,
                end: new Date(now),
            };
        }
    }

    private keepAlive(now = new Date()) {
        // If the length exceeds the max, stop the timing and start a new one
        if (
            this.started &&
            this.lastKeepAlive &&
            now.getTime() - this.lastKeepAlive.getTime() > 60 * 1000
        ) {
            console.warn("Keep alive didn't happen in time", this.lastKeepAlive, now);

            // Segment the timing on last known good value
            this.insertTiming({
                client: this.client,
                project: this.project,
                start: this.started,
                end: new Date(this.lastKeepAlive),
            });

            // Start a new timing
            this.started = new Date(now);
        }

        this.lastKeepAlive = new Date(now);
    }

    private insertTiming(timing: Timing) {
        if (timing.start.getTime() >= timing.end.getTime()) {
            console.warn(
                "Timing is 0 or negative length, this may happen if keep alive is not called in time",
                timing
            );
            return;
        }

        // Insert timing
        this.timings.push(timing);

        // Send event to listeners
        this.onInsertTiming.trigger(timing);

        this.save([timing]);
    }
}
