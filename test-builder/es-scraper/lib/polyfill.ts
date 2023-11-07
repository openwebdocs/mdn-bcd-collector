/* eslint-disable @typescript-eslint/method-signature-style */
import "core-js/actual/array/to-sorted.js";
import "core-js/actual/array/to-spliced.js";
import "core-js/actual/iterator/filter.js";
import "core-js/actual/iterator/map.js";
import "core-js/actual/iterator/to-array.js";

declare global {
  interface Array<T> {
    toSorted(this: T[], compareFn?: (a: T, b: T) => number): T[];
    toSpliced(
      this: T[],
      start: number,
      deleteCount: number,
      ...items: T[]
    ): T[];
  }

  interface IterableIterator<T> {
    filter(
      predicate: (value: T, index: number) => unknown,
    ): IterableIterator<T>;
    map<U>(mapper: (value: T, index: number) => U): IterableIterator<U>;
    toArray(): T[];
  }
}
