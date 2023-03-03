// import axios from "https://esm.sh/axios";

const API_URL = "http://localhost:3000"; // !! TODO: Change this to your API URL

const apiRequest = <T>(method: "post" | "get", url: string, data?: any, def?: T) => {
    return new Promise<T>((resolve, reject) => {
        console.log("TODO", method, url, data);
        resolve(def as any);
        // axios
        //     .request({
        //         method: method,
        //         baseURL: API_URL,
        //         url: url,
        //         data: data,
        //     })
        //     .then((response) => {
        //         if (response.status == 200) {
        //             resolve(response.data);
        //         } else {
        //             reject(response.data);
        //         }
        //     })
        //     .catch((errs) => {
        //         reject(errs);
        //     });
    });
};

// Ideally this should be generated from vdt-service/api/routes.ts
export const Api = {
    timings: {
        post: (
            timings: {
                client: string;
                project: string;
                start: Date;
                end: Date;
            }[]
        ) => {
            return apiRequest<boolean>("post", "/timings", timings, true);
        },
        total: (clientProject: { client: string; project: string }) => {
            return apiRequest<{ hours: number }>("post", "/timings/total", clientProject, {
                hours: 0,
            });
        },
        dailyTotals: (opts: { client?: string; project?: string; from: Date; to: Date }) => {
            return apiRequest<{ day: string; hours: number; client: string; project: string }[]>(
                "post",
                "/timings/dailyTotals",
                opts,
                [] //{ day: "", hours: 0, client: "", project: "" }
            );
        },
    },
};
