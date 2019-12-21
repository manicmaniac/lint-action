const { join } = require("path");
const { createCheck, getGithubInfo } = require("./github");
const linters = require("./linters");
const { exit, getInput, log } = require("./utils/action");

// Abort action on unhandled promise rejections
process.on("unhandledRejection", err => {
	log(err, "error");
	exit(`Exiting because of unhandled promise rejection`);
});

/**
 * Parses the action configuration and runs all enabled linters on matching files
 */
async function runAction() {
	const github = getGithubInfo();

	// Loop over all available linters
	await Promise.all(
		Object.entries(linters).map(async ([linterId, linter]) => {
			// Determine whether the linter should be executed on the commit
			if (getInput(linterId) === "true") {
				const fileExtensions = getInput(`${linterId}_extensions`, true);
				const lintDirRel = getInput(`${linterId}_dir`) || ".";
				const lintDirAbs = join(github.workspace, lintDirRel);

				// Check that the linter and its dependencies are installed
				log(`Verifying setup for ${linterId}…`);
				linter.verifySetup(lintDirAbs);
				log(`Verified ${linterId} setup`);

				// Determine which files should be linted
				const fileExtList = fileExtensions.split(",");
				log(`Will use ${linterId} to check the files with extensions ${fileExtList}`);

				// Lint the matching files, parse code style violations
				log(`Running ${linterId} checks in ${lintDirAbs}…`);
				const results = linter.lint(lintDirAbs, fileExtList);
				const resultsParsed = linter.parseResults(github.workspace, results);
				log(
					`Found ${resultsParsed[2].length} errors and ${resultsParsed[1].length} warnings with ${linterId}`,
				);

				// Annotate commit with code style violations on GitHub
				if (github.eventName === "push") {
					await createCheck(linterId, github, resultsParsed);
				}
			}
		}),
	);
}

runAction();
