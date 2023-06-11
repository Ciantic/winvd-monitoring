export type CancellablePromise<T> = { promise: Promise<T>; cancel: () => void };
export function cancellablePromise<T>(promise: Promise<T>): CancellablePromise<T> {
    let cancelled = false;
    const wrappedPromise = new Promise<T>((resolve, reject) => {
        promise.then(
            (value) => {
                if (cancelled) {
                    reject(new Error("Promise cancelled"));
                } else {
                    resolve(value);
                }
            },
            (error) => {
                if (cancelled) {
                    reject(new Error("Promise cancelled"));
                } else {
                    reject(error);
                }
            }
        );
    });
    return {
        promise: wrappedPromise,
        cancel: () => {
            cancelled = true;
        },
    };
}

// Use esbuild option { define: {Deno: "false" } }
//
// Esbuild minifier removes this because of "&& Deno" check

if (typeof Deno !== "undefined" && "test" in Deno) {
    Deno.test("cancellablePromise", async () => {
        const p = cancellablePromise(
            new Promise((resolve) => {
                setTimeout(() => {
                    resolve("Hello");
                }, 100);
            })
        );

        setTimeout(() => {
            p.cancel();
        }, 50);

        let error;
        try {
            await p.promise;
        } catch (e) {
            error = e;
        }

        if (error.message !== "Promise cancelled") {
            throw new Error("Expected cancellation error");
        }
    });

    Deno.test("cancellablePromise succeeds", async () => {
        const p = cancellablePromise(
            new Promise((resolve) => {
                setTimeout(() => {
                    resolve("Hello");
                }, 100);
            })
        );

        let error;
        try {
            const v = await p.promise;
            if (v !== "Hello") {
                throw new Error("Expected 'Hello'");
            }
        } catch (e) {
            error = e;
        }

        if (error) {
            throw new Error("Raised error unexpectedly");
        }
    });
}
