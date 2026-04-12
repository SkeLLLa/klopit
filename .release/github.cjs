module.exports = [
  '@semantic-release/github',
  {
    message: 'chore(release): ${nextRelease.version} \n\n${nextRelease.notes}',
    assets: [{ path: 'klopit-pages.tar.gz', label: 'Pages bundle (${nextRelease.gitTag})' }],
  },
];
