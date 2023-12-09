//
// mdn-bcd-collector: lib/replace-async.ts
// Wrapper to add an async-friendly String.replace()
//
// © Gooborg Studios, Overcl9ck/Stack Overflow Users
// See the LICENSE file for copyright details
//

/**
 * Replaces matches in a string using an asynchronous function.
 * @copyright https://stackoverflow.com/a/48032528
 * @param str - The input string.
 * @param regex - The regular expression to match against.
 * @param asyncFn - The asynchronous function to be called for each match.
 * @returns A promise that resolves to the modified string.
 */
const replaceAsync = async (str, regex, asyncFn) => {
  const promises: Promise<string>[] = [];
  str.replace(regex, (match, ...args) => {
    const promise = asyncFn(match, ...args);
    promises.push(promise);
  });
  const data = await Promise.all(promises);
  return str.replace(regex, () => data.shift());
};

export default replaceAsync;
