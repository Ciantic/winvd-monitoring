export function simpleMapEvent<TParam, TRes = void, TContext = unknown>(context?: TContext) {
    type T = { (this: TContext, inputs: TParam): TRes };
    return {
        cbs: [] as [T, T][], // First value is used for equality check, second is the bound version
        addListener(cb: T, bindThis?: unknown) {
            return this.cbs.push([cb, bindThis ? cb.bind(bindThis as TContext) : cb]);
        },
        removeListener(cb: T) {
            const i = this.cbs.findIndex(([v, _]) => v == cb);
            if (i >= 0) return this.cbs.splice(i, 1);
            return [];
        },
        trigger(trigger: TParam) {
            return this.cbs.map(([_, cb]) => cb.call(context as TContext, trigger) as TRes);
        },
        triggerHandled(trigger: TParam) {
            return this.cbs.some(([_, cb]) => !!cb.call(context as TContext, trigger));
        },
    };
}

if (typeof Deno !== "undefined" && Deno) {
    Deno.test("Listener gets the value", () => {
        const event = simpleMapEvent<{ foo: number }, void>();
        let value = 0;
        event.addListener((v) => {
            value = v.foo;
        });
        event.trigger({ foo: 1 });
        if (value !== 1) {
            throw new Error("Expected value to be 1");
        }
    });

    Deno.test("Trigger returns all values", () => {
        const event = simpleMapEvent<void, string>();

        event.addListener(() => {
            return "Hello World";
        });
        event.addListener(() => {
            return "I'm another one";
        });

        const ret = event.trigger();
        if (ret[0] !== "Hello World" || ret[1] !== "I'm another one") {
            throw new Error("Expected values to match");
        }
    });

    Deno.test("Trigger handled halts", () => {
        const event = simpleMapEvent<void, string>();
        const executed = [];

        event.addListener(() => {
            executed.push(1);
            return "Hello World";
        });
        event.addListener(() => {
            executed.push(2);
            // This does not get executed, because first one returned trueish value
            return "I'm another one";
        });

        const ret = event.triggerHandled();
        if (ret !== true || executed.length !== 1) {
            throw new Error("Expected values to match");
        }
    });
    Deno.test("Allow using prototype", () => {
        class Example {
            test = 1;
            onSomeEvent() {
                this.test += 1;
            }
        }

        const state = new Example();
        const event = simpleMapEvent<void, void>();

        // Notice that addListener takes in the context, this means you can use
        // the prototype functions directly
        event.addListener(state.onSomeEvent, state);
        event.trigger();
        event.removeListener(state.onSomeEvent);

        if (state.test !== 2) {
            throw new Error("Expected test to be 2");
        }
        if (event.cbs.length !== 0) {
            throw new Error("Expected listeners to be removed");
        }
    });

    Deno.test("Test using custom context", () => {
        const state = { value: 1 };
        const event = simpleMapEvent<void, void, typeof state>(state);

        // Now that state is given, the listener can access the value
        event.addListener(function () {
            // typeof this == typeof state;
            this.value += 1;
        });

        event.trigger();

        if (state.value !== 2) {
            throw new Error("Expected test to be 2");
        }
    });
}
