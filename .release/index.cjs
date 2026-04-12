module.exports = {
  branches: [
    { name: 'master', prerelease: false },
    { name: 'next', prerelease: true },
  ],
  plugins: [
    require('./commit-analyzer.cjs'),
    require('./release-notes.cjs'),
    require('./changelog.cjs'),
    require('./npm.cjs'),
    require('./build.cjs'),
    require('./git.cjs'),
    require('./github.cjs'),
  ],
};
