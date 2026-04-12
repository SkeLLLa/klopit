module.exports = [
  '@semantic-release/exec',
  {
    prepareCmd: 'pnpm run build:app && tar -czf klopit-pages.tar.gz -C build .',
  },
];
