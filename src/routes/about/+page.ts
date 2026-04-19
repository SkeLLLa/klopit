import { m } from '$lib/paraglide/messages.js';

export const load = () => ({
  meta: {
    title: m.page_about_meta_title(),
    description: m.page_about_meta_description(),
  },
});
