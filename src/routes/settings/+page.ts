import { m } from '#lib/paraglide/messages.js';

export const load = () => ({
  meta: {
    title: m.settings_meta_title(),
    description: m.settings_meta_description(),
    robots: 'noindex, follow',
  },
});
