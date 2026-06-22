import {compare, compareVersions} from "compare-versions";

/**
 * Compare semver version strings and also support "preview" version numbers.
 *  @param a — First version to compare
 *  @param b — Second version to compare
 * @returns A number for Array.sort
 */
export const bcdCompareSort = (a: string, b: string): number => {
  if (a === "preview" && b === "preview") {
    return 0;
  }
  if (a === "preview") {
    return 1;
  }
  if (b === "preview") {
    return -1;
  }

  return compareVersions(a, b);
};

/**
 * Compare semver version strings and also support "preview" version numbers
 *  @param a — First version to compare
 *  @param b — Second version to compare
 *  @param operator Allowed arithmetic operator to use
 * @returns true if the comparison between a and b satisfies the operator, false otherwise.
 */
export const bcdCompare = (
  a: string,
  b: string,
  operator: Parameters<typeof compare>[2],
): boolean => {
  const isPreviewA = a === "preview";
  const isPreviewB = b === "preview";

  if (isPreviewA || isPreviewB) {
    if (isPreviewA && isPreviewB) {
      return compare("0.0.0", "0.0.0", operator);
    }

    switch (operator) {
      case ">":
      case ">=":
        return isPreviewA;
      case "<":
      case "<=":
        return isPreviewB;
      case "=":
        return false;
      case "!=":
        return true;
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }
  return compare(a, b, operator);
};
