//
// mdn-bcd-collector: scripts/release.ts
// Script to perform a new mdn-bcd-collector release
//
// © Gooborg Studios, Google LLC
// See the LICENSE file for copyright details
//

import chalk from "chalk-template";
import esMain from "es-main";
import fs from "fs-extra";
import {Listr, ListrTask} from "listr2";
import {ListrEnquirerPromptAdapter} from "@listr2/prompt-adapter-enquirer";
import prettier from "prettier";
import yargs from "yargs";
import {hideBin} from "yargs/helpers";

import exec from "../lib/exec.js";

const currentVersion = (
  await fs.readJson(new URL("../package.json", import.meta.url))
).version;

/**
 * Prepares the tasks for the release process.
 * @returns An array of task objects representing the tasks to be executed.
 */
const prepare = (): ListrTask[] => {
  return [
    {
      title: "Checking for Git",
      /**
       * Checking for Git.
       */
      task: async () => {
        try {
          await exec("git --version");
        } catch (e) {
          throw new Error(
            chalk`{red This script depends on {bold git}. Please {bold install} git using the following instructions:} {blue https://git-scm.com/book/en/v2/Getting-Started-Installing-Git}`,
          );
        }
      },
    },
    {
      title: "Checking for GitHub CLI",
      /**
       * Checking for GitHub CLI.
       */
      task: async () => {
        try {
          await exec("gh --version");
        } catch (e) {
          throw new Error(
            chalk`{red This script depends on the {bold GitHub CLI}. Please {bold install} the CLI using the following instructions:} {blue https://cli.github.com/}`,
          );
        }
      },
      /**
       * Skip if the user has specified not to create a pull request.
       * @param ctx - The context object.
       * @returns - Returns true if the task should be skipped, false otherwise.
       */
      skip: (ctx) => ctx.skipPR,
    },
    {
      /**
       * Checking git status.
       */
      task: async () => {
        const changes = await exec("git status -s");
        if (changes.length) {
          throw new Error(
            chalk`{red You currently have {bold uncommitted changes}. Please {bold commit} or {bold stash} your changes and try again.}`,
          );
        }
      },
    },
    {
      title: "Fetching from remote",
      /**
       * Fetching from remote.
       * @returns - A promise that resolves when the fetch is complete.
       */
      task: async () => await exec("git fetch --all"),
      /**
       * Skip if the user has specified not to fetch from remote.
       * @param ctx - The context object.
       * @returns - Returns true if the task should be skipped, false otherwise.
       */
      skip: (ctx) => ctx.skipFetch,
    },
  ];
};

/**
 * Retrieves the new version based on the current version and user input.
 * @param ctx - The context object.
 * @param task - The task object.
 * @returns - A promise that resolves when the new version is retrieved.
 * @throws {Error} - If the user cancels the release.
 */
const getNewVersion = async (ctx, task) => {
  const versionParts = currentVersion.split(".").map((x) => Number(x));
  const newVersions = [
    `${versionParts[0] + 1}.0.0`,
    `${versionParts[0]}.${versionParts[1] + 1}.0`,
    `${versionParts[0]}.${versionParts[1]}.${versionParts[2] + 1}`,
  ];

  if (ctx.skipPrompt) {
    ctx.newVersion = newVersions[2];
    return;
  }

  ctx.newVersion = await task.prompt(ListrEnquirerPromptAdapter).run({
    type: "select",
    name: "newVersion",
    message: "How should we bump the version?",
    choices: [
      {
        message: chalk`Major {blue (${newVersions[0]})}`,
        name: newVersions[0],
      },
      {
        message: chalk`Minor {blue (${newVersions[1]})}`,
        name: newVersions[1],
      },
      {
        message: chalk`Patch {blue (${newVersions[2]})}`,
        name: newVersions[2],
      },
      {
        message: chalk`{yellow Cancel}`,
        name: "cancel",
      },
    ],
    initial: 2,
  });

  if (ctx.newVersion === "cancel") {
    throw new Error(chalk`{yellow Release cancelled by user}`);
  }
};

/**
 * Simplifies the test changes list.
 * @param el - The element to be processed.
 * @param _ - The index of the element in the list.
 * @param list - The list of elements.
 * @returns - Returns true if the element is simplified, false otherwise.
 */
const simplifyTestChangesList = (el, _, list) => {
  const parts = el.split(".");
  let p = "";

  if (el === "__version") {
    return false;
  }

  for (let i = 0; i < parts.length - 1; i++) {
    p += (i > 0 ? "." : "") + parts[i];
    if (list.includes(p)) {
      return false;
    }
  }

  return true;
};

/**
 * Retrieves the list of tasks for performing test changes.
 * @returns The list of tasks for performing test changes.
 */
const getTestChanges = (): ListrTask[] => {
  return [
    {
      title: "Checkout last release",
      /**
       * Checkout last release.
       */
      task: async () => {
        await exec(`git checkout v${currentVersion}`);
        await exec("npm install");
      },
    },
    {
      title: "Build tests from last release",
      /**
       * Build tests from last release.
       */
      task: async () => {
        await exec("npm run build:tests");
        await fs.rename(
          new URL("../tests.json", import.meta.url),
          new URL("../tests.old.json", import.meta.url),
        );
      },
    },
    {
      title: "Checkout current release",
      /**
       * Checkout current release.
       */
      task: async () => {
        // npm install or build could have resulted in local changes, use
        // --force to throw those away.
        await exec("git checkout --force origin/main");
        await exec("npm install");
      },
    },
    {
      title: "Build tests from current release",
      /**
       * Build tests from current release.
       * @returns - A promise that resolves when the tests are built.
       */
      task: async () => await exec("npm run build:tests"),
    },
    {
      title: "Compare tests",
      /**
       * Compare tests.
       * @param ctx - The context object.
       */
      task: async (ctx) => {
        const oldTests = await fs.readJson(
          new URL("../tests.old.json", import.meta.url),
        );
        const newTests = await fs.readJson(
          new URL("../tests.json", import.meta.url),
        );

        const oldTestKeys = Object.keys(oldTests);
        const newTestKeys = Object.keys(newTests);

        const added = newTestKeys
          .filter((k) => !oldTestKeys.includes(k))
          .filter(simplifyTestChangesList);
        const removed = oldTestKeys
          .filter((k) => !newTestKeys.includes(k))
          .filter(simplifyTestChangesList);
        let changed: string[] = [];
        for (const t of newTestKeys.filter((k) => oldTestKeys.includes(k))) {
          if (oldTests[t].code != newTests[t].code) {
            changed.push(t);
          }
        }
        changed = changed.filter(simplifyTestChangesList);

        ctx.testChanges = "\n";

        if (added.length) {
          ctx.testChanges +=
            "#### Added\n\n" + added.map((x) => "- " + x).join("\n") + "\n";
        }
        if (removed.length) {
          ctx.testChanges +=
            "#### Removed\n\n" + removed.map((x) => "- " + x).join("\n") + "\n";
        }
        if (changed.length) {
          ctx.testChanges +=
            "#### Changed\n\n" + changed.map((x) => "- " + x).join("\n") + "\n";
        }
      },
    },
    {
      title: "Cleanup",
      /**
       * Cleanup.
       * @returns - A promise that resolves when the cleanup is complete.
       */
      task: async () =>
        await fs.rm(new URL("../tests.old.json", import.meta.url)),
    },
  ];
};

/**
 * Retrieves the git changes between the current version and the origin/main branch.
 * @param ctx - The context object.
 * @returns - A promise that resolves when the git changes are retrieved.
 */
const getGitChanges = async (ctx) => {
  const commits = String(
    await exec(`git log --pretty=format:%s v${currentVersion}..origin/main`),
  ).split("\n");
  ctx.commits = commits
    .filter(
      (summary) =>
        !(summary.startsWith("Bump ") || summary.includes("Update overrides")),
    )
    .map(
      (summary) =>
        `- ${summary.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}`,
    )
    .map((summary) =>
      // Link to pull requests
      summary.replace(
        /\(#(\d+)\)/g,
        "([#$1](https://github.com/openwebdocs/mdn-bcd-collector/pull/$1))",
      ),
    )
    .join("\n");
};

/**
 * Updates the CHANGELOG.md file with a new version section and commits.
 * If a major version bump is performed, moves the old changelog results to another file.
 * @param ctx - The context object containing information about the new version, test changes, and commits.
 * @returns - A promise that resolves once the changelog is updated.
 */
const doChangelogUpdate = async (ctx) => {
  const filepath = new URL("../CHANGELOG.md", import.meta.url);
  let changelog = await fs.readFile(filepath, "utf8");

  const now = new Date().toLocaleString("en-US", {
    dateStyle: "long",
  });

  const newChangelogSection =
    `## v${ctx.newVersion}\n\nReleased ${now}\n\n` +
    (ctx.testChanges === "\n" ? "" : "### Test Changes\n" + ctx.testChanges) +
    "\n### Commits\n\n" +
    ctx.commits +
    "\n\n";

  const idx = changelog.indexOf("##");

  // If we are doing a major version bump, move old changelog results to another file
  if (ctx.newVersion.endsWith(".0.0")) {
    const currentMajorVersion = currentVersion.split(".")[0];
    const olderVersionsHeader = "## Older Versions";

    let oldChangelog =
      `# mdn-bcd-collector v${currentMajorVersion}.x Changelog\n\n` +
      changelog.substring(idx, changelog.indexOf(olderVersionsHeader));
    oldChangelog = await prettier.format(oldChangelog, {parser: "markdown"});
    await fs.writeFile(
      new URL(`../changelog/v${currentMajorVersion}.md`, import.meta.url),
      oldChangelog,
      "utf8",
    );

    // Move the Older Versions list to new changelog
    changelog =
      "# mdn-bcd-collector Changelog\n\n## Older Versions\n\n" +
      `- [v${currentMajorVersion}.x](./changelog/v${currentMajorVersion}.md)\n` +
      changelog.substring(
        changelog.indexOf(olderVersionsHeader) + olderVersionsHeader.length + 2,
        changelog.length,
      );
  }

  changelog =
    changelog.substring(0, idx) +
    newChangelogSection +
    changelog.substring(idx, changelog.length);
  changelog = await prettier.format(changelog, {parser: "markdown"});
  await fs.writeFile(filepath, changelog, "utf8");
};

/**
 * Bumps the version of the project.
 * @param newVersion - The new version to set.
 * @returns - A promise that resolves when the version is bumped.
 */
const doVersionBump = async (newVersion) => {
  await exec(`npm version --no-git-tag-version ${newVersion}`);
};

/**
 * Prepares a branch for release by creating and checking out the branch, adding necessary files, and committing the changes.
 * @param ctx - The context object containing information about the release.
 * @param ctx.newVersion - The new version number for the release.
 */
const prepareBranch = async (ctx) => {
  ctx.branchName = `release-${ctx.newVersion}`;

  // Create and checkout branch
  await exec(`git branch ${ctx.branchName}`);
  await exec(`git checkout ${ctx.branchName}`);

  // Commit
  await exec("git add package.json package-lock.json CHANGELOG.md");
  if (ctx.newVersion.endsWith(".0.0")) {
    await exec(`git add changelog/v${currentVersion.split(".")[0]}.md`);
  }
  await exec(
    `git commit -m "Release ${ctx.newVersion}" -m "Generated by release.js."`,
  );
};

/**
 * Creates a pull request using the specified context.
 * @param ctx - The context object containing the branch name.
 * @returns - A promise that resolves when the pull request is created.
 */
const createPR = async (ctx) => {
  await exec(`git push --set-upstream origin ${ctx.branchName}`);
  await exec("gh pr create -f");
};

/**
 * The main function that orchestrates the release process.
 * It performs various tasks such as checking prerequisites, getting version numbers,
 * retrieving test changes, updating the changelog, bumping the version number,
 * confirming the release, preparing the release branch, and creating a pull request.
 * @returns A promise that resolves when the release process is completed.
 */
const main = async () => {
  const {argv} = yargs(hideBin(process.argv))
    .parserConfiguration({
      "boolean-negation": false,
    })
    .option("no-fetch", {
      describe: "Don't fetch remote",
      type: "boolean",
      default: false,
    })
    .option("no-prompt", {
      describe: "Don't prompt about anything, assume defaults",
      type: "boolean",
      default: false,
    })
    .option("no-pr", {
      describe: "Don't create a pull request",
      type: "boolean",
      default: false,
    });

  const tasks = new Listr(
    [
      {
        title: "Check prerequesites",
        /**
         * Check prerequesites.
         * @param _ - The context object.
         * @param task - The task object.
         * @returns - A promise that resolves when the prerequesites are checked.
         */
        task: (_, task) => task.newListr(prepare()),
      },
      {
        title: "Get new version number",
        task: getNewVersion,
      },
      {
        title: "Get test changes",
        /**
         * Get test changes.
         * @param _ - The context object.
         * @param task - The task object.
         * @returns - A promise that resolves when the test changes are retrieved.
         */
        task: (_, task) => task.newListr(getTestChanges()),
      },
      {
        title: "Get commits",
        task: getGitChanges,
      },
      {
        title: "Update changelog",
        task: doChangelogUpdate,
      },
      {
        title: "Bump version number",
        /**
         * Bump version number.
         * @param ctx - The context object.
         * @returns - A promise that resolves when the version is bumped.
         */
        task: async (ctx) => await doVersionBump(ctx.newVersion),
      },
      {
        title: "Get confirmation to continue",
        /**
         * Get confirmation to continue.
         * @param ctx - The context object.
         * @param task - The task object.
         * @returns - A promise that resolves when the user confirms the release.
         */
        task: async (ctx, task) => {
          const confirm = await task
            .prompt(ListrEnquirerPromptAdapter)
            .run<boolean>({
              type: "confirm",
              name: "confirm",
              message: `Ready to release ${ctx.newVersion}?`,
              initial: true,
            });

          if (!confirm) {
            throw new Error(
              chalk`{yellow Release cancelled by user, reverting package[-lock.json] changes (changelog retained)}`,
            );
          }
        },
        /**
         * Rollback the version bump if the user cancels the release.
         * @returns - A promise that resolves when the version is rolled back.
         */
        rollback: async () => await doVersionBump(currentVersion),
        /**
         * Skip if the user has specified not to prompt.
         * @param ctx - The context object.
         * @returns - Returns true if the task should be skipped, false otherwise.
         */
        skip: (ctx) => ctx.skipPrompt,
      },
      {
        title: "Prepare release branch",
        task: prepareBranch,
      },
      {
        title: "Create pull request",
        task: createPR,
        /**
         * Skip if the user has specified not to create a pull request.
         * @param ctx - The context object.
         * @returns - Returns true if the task should be skipped, false otherwise.
         */
        skip: (ctx) => ctx.skipPR,
      },
    ],
    {
      rendererOptions: {
        showErrorMessage: true,
      },
      ctx: {
        skipFetch: argv["no-fetch"],
        skipPrompt: argv["no-prompt"],
        skipPR: argv["no-pr"],
        newVersion: null,
      },
    },
  );

  try {
    await tasks.run();
  } catch (e) {
    console.error(e);
  }

  // Switch back to main branch when finished
  try {
    await exec("git switch main");
  } catch (e) {
    // Don't worry if the command fails
  }
};

/* c8 ignore start */
if (esMain(import.meta)) {
  await main();
}
/* c8 ignore stop */
