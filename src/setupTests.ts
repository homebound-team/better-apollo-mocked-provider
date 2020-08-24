function wrap<TResult>(key?: "only" | "skip" | "todo") {
  return (
    message: string,
    callback: (resolve: (result?: any) => void, reject: (reason?: any) => void) => any,
    timeout?: number,
  ) =>
    (key ? it[key] : it)(
      message,
      function (this: any) {
        return new Promise((resolve, reject) => callback.call(this, resolve, reject));
      },
      timeout,
    );
}

const wrappedIt = wrap();

// Homebound note: We've refactored this from `itAsync` to `it.async` because
// then Webstorm's "click to run single test" works / recognizes it.
it.async = function (this: any, ...args: Parameters<typeof wrappedIt>) {
  return wrappedIt.apply(this, args);
};

export default {};
