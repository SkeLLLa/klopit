import { m } from '$lib/paraglide/messages.js';

export const load = () => {
  const filingYear = new Date().getFullYear() - 1;
  return {
    meta: {
      title: m.page_pit38_meta_title({ year: String(filingYear) }),
      description: m.page_pit38_meta_description(),
    },
  };
};
