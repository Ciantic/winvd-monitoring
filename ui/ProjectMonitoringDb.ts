import Dexie from "https://esm.sh/dexie";

interface PersistedTiming {
    id?: number;
    client: string;
    project: string;
    start: Date;
    end: Date;
}

export class ProjectMonitoringDb extends Dexie {
    private timings: Dexie.Table<PersistedTiming, number>;

    constructor() {
        super("ProjectMonitoring");
        this.version(9)
            .stores({
                timings: "++id,[client+project],start,end",
            })
            .upgrade(() => {
                indexedDB.deleteDatabase("ProjectMonitoringDb");
            });
        this.timings = this.table("timings");
    }

    getTimings = async () => {
        return await this.transaction("rw", this.timings, async () => {
            return await this.timings.toArray();
        });
    };

    getTimingsByClientAndProject = async (clientProject: { client: string; project: string }) => {
        return await this.timings.where({
            client: clientProject.client,
            project: clientProject.project,
        });
    };

    addOrUpdateTiming = async (timing: PersistedTiming) => {
        return await this.transaction("rw", this.timings, async () => {
            let existing = await this.timings.where("start").equals(timing.start).toArray();
            if (existing.length >= 1) {
                await this.timings.put(Object.assign(existing[0], timing));
            } else {
                await this.timings.put(timing);
            }
        });
    };

    deleteTimings = async (timings: PersistedTiming[]) => {
        return await this.transaction("rw", this.timings, async () => {
            await this.timings.bulkDelete(timings.map((k) => k.id || 0));
        });
    };
}

/*
export class ProjectMonitoringDb {
    getDesktops = async (): Promise<
        { id?: number | undefined; project: string; client: string }[]
    > => {
        return [];
    };

    getTimings = async (): Promise<PersistedTiming[]> => {
        return [];
    };

    getTimingsByClientAndProject = async (clientProject: {
        client: string;
        project: string;
    }): Promise<{ each: (cb: (p: PersistedTiming) => void) => void }> => {
        return { each: (cb) => () => {} };
    };

    addOrUpdateTiming = async (timing: PersistedTiming): Promise<void> => {};

    updateDesktops = async (desktopsById: {
        [k: string]: { client: string; project: string };
    }): Promise<void> => {};

    deleteTimings = async (timings: PersistedTiming[]): Promise<void> => {};
}
*/
