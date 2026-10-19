import type { Handle } from '@sveltejs/kit/hooks';

import { getTextDirection } from '#lib/paraglide/runtime.js';
import { paraglideMiddleware } from '#lib/paraglide/server.js';

const handleParaglide: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, ({ locale }) =>
    resolve(event, {
      transformPageChunk: ({ html }) =>
        html
          .replace('%paraglide.lang%', locale)
          .replace('%paraglide.dir%', getTextDirection(locale)),
    }),
  );

export const handle: Handle = handleParaglide;
