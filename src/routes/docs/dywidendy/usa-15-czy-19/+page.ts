import { localizeHref } from '$lib/paraglide/runtime';
import { redirect } from '@sveltejs/kit';

export const load = () => {
  redirect(308, localizeHref('/docs/dividends/us-15-or-19'));
};
