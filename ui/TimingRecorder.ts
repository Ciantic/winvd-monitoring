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
    private saveInterval = 0;
    private timings: Timing[] = [];

    // Event listener hookup
    public onInsertTiming = simpleMapEvent<Timing, void>(this);

    constructor(
        enableKeepAlive: boolean,
        private save?: (
            timings: { start: Date; end: Date; project: string; client: string }[]
        ) => Promise<void>,
        now = new Date()
    ) {
        if (enableKeepAlive) {
            this.lastKeepAlive = new Date(now);
            this.keepAliveInterval = setInterval(() => this.keepAlive(), 30 * 1000);
        }

        // Save to database every 3 minutes
        this.saveInterval = setInterval(() => this.saveTimings(), 3 * 60 * 1000);
    }

    public destroy() {
        this.saveTimings();
        clearInterval(this.keepAliveInterval);
        clearInterval(this.saveInterval);
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
            const segmentedTiming = {
                client: this.client,
                project: this.project,
                start: this.started,
                end: new Date(this.lastKeepAlive),
            };

            // Start a new timing
            this.started = new Date(now);

            // Insert the segmented timing
            this.insertTiming(segmentedTiming);
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

        // If timing is less than three seconds, ignore it
        if (timing.end.getTime() - timing.start.getTime() < 3 * 1000) {
            console.warn("Timing is less than 3 seconds, ignoring", timing);
            return;
        }

        // Insert timing
        this.timings.push(timing);

        // Send event to listeners
        this.onInsertTiming.trigger(timing);
    }

    private saveTimings(now = new Date()) {
        this.keepAlive(now);
        const timings = [...this.timings];
        const currentTiming = this.getCurrent(now);

        // If current timing is at least 3 seconds, save it also
        if (
            currentTiming &&
            currentTiming.end.getTime() - currentTiming.start.getTime() >= 3 * 1000
        ) {
            timings.push(currentTiming);
        }

        try {
            this.save?.(timings);
            this.timings = [];
        } catch (e) {
            console.error("Error saving timings", e);
        }
    }
}
