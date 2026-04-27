import { m } from '$lib/paraglide/messages.js';

export const load = () => ({
  meta: {
    title: m.page_rates_meta_title(),
    description: m.page_rates_meta_description(),
    robots: 'noindex, follow',
  },
});
