/** @type {import('svelte-sitemap').OptionsSvelteSitemap} */
const config = {
  domain: 'https://klopit.co.pl',
  trailingSlashes: true,
  ignore: [
    'data/**',
    'dashboard/**',
    'tax-form/**',
    'settings/**',
    'prior-losses/**',
    'rates/**',
    'docs/brokerzy/**',
    'docs/dywidendy/**',
    'pl/data/**',
    'pl/dashboard/**',
    'pl/tax-form/**',
    'pl/settings/**',
    'pl/prior-losses/**',
    'pl/rates/**',
    'pl/docs/brokerzy/**',
    'pl/docs/dywidendy/**',
    'uk/data/**',
    'uk/dashboard/**',
    'uk/tax-form/**',
    'uk/settings/**',
    'uk/prior-losses/**',
    'uk/rates/**',
    'uk/docs/brokerzy/**',
    'uk/docs/dywidendy/**',
  ],
};

export default config;
