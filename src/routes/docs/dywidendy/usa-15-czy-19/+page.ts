import { redirect } from '@sveltejs/kit';
import { localizeHref } from '$lib/paraglide/runtime';

export const load = () => {
  redirect(308, localizeHref('/docs/dividends/us-15-or-19'));
};
