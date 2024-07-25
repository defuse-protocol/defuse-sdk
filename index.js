module.exports = {
  branches: [
    "main",
    {
      name: "canary/*",
      prerelease: '${name.replace(/^canary\\//g, "")}',
    },
  ],
  plugins: [
    "@semantic-release/commit-analyzer",
    [
      "@semantic-release/exec",
      {
        analyzeCommitsCmd:
          'echo "previous-version=v${lastRelease.version}" >> $GITHUB_OUTPUT',
        verifyReleaseCmd:
          'echo "next-version=${nextRelease.version}" >> $GITHUB_OUTPUT',
      },
    ],
    "@semantic-release/release-notes-generator",
    "@semantic-release/github",
    "@semantic-release/npm",
    [
      "@semantic-release/git",
      {
        assets: ["package.json"],
        message:
          // eslint-disable-next-line no-template-curly-in-string
          "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
  ],
}
