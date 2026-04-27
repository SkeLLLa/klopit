import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: undefined,
      precompress: false,
      strict: true,
    }),
    prerender: {
      entries: [
        '*',
        '/pl/docs/brokerzy',
        '/uk/docs/brokerzy',
        '/pl/docs/dywidendy/usa-15-czy-19',
        '/uk/docs/dywidendy/usa-15-czy-19',
      ],
    },
  },
};
