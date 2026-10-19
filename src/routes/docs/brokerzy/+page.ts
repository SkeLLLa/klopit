import { redirect } from '@sveltejs/kit';

import { localizeHref } from '#lib/paraglide/runtime.js';

export const load = () => {
  redirect(308, localizeHref('/docs/brokers/'));
};
