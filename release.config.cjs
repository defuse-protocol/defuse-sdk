/** @type {import('semantic-release').Options} */
const config = {
  branches: [
    "main",
    {
      name: "beta",
      prerelease: "beta",
    },
  ],
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
        releaseRules: [{ breaking: true, release: "minor" }],
      },
    ],
    [
      "@semantic-release/release-notes-generator",
      {
        preset: "conventionalcommits",
      },
    ],
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

module.exports = config
