//
// mdn-bcd-collector: lib/replace-async.ts
// Wrapper to add an async-friendly String.replace()
//
// © Gooborg Studios
// See the LICENSE file for copyright details
//

/**
 * Replaces matches in a string using an asynchronous function.
 * @param str - The input string.
 * @param search - The regular expression to match against.
 * @param asyncFn - The asynchronous function to be called for each match.
 * @returns A promise that resolves to the modified string.
 */
const replaceAsync = async (
  str: string,
  search: string | RegExp,
  asyncFn: (match: string, ...args: any[]) => Promise<string>,
): Promise<string> =>
  new Promise((resolve, reject) => {
    let didMatch = false;
    str.replace(search, (match: string, ...args: any[]) => {
      didMatch = true;
      asyncFn(match, ...args)
        .then(resolve)
        .catch(reject);
      // Just to make TypeScript happy; we won't actually use the return value.
      return match;
    });
    if (!didMatch) {
      resolve(str);
    }
  });

export default replaceAsync;
