import { m } from '$lib/paraglide/messages.js';

export const load = () => ({
  meta: {
    title: m.page_data_meta_title(),
    description: m.page_data_meta_description(),
    robots: 'noindex, follow',
  },
});
