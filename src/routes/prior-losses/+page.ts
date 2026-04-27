import { m } from '$lib/paraglide/messages.js';

export const load = () => ({
  meta: {
    title: m.page_prior_losses_meta_title(),
    description: m.page_prior_losses_meta_description(),
    robots: 'noindex, follow',
  },
});
