import { m } from '#lib/paraglide/messages.js';

// Explicit references (not `m[key]`) keep the bundler able to tree-shake unused messages.
export const navLabels: Record<string, () => string> = {
  nav_about: m.nav_about,
  nav_dashboard: m.nav_dashboard,
  nav_data: m.nav_data,
  nav_docs: m.nav_docs,
  nav_docs_brokers: m.nav_docs_brokers,
  nav_docs_div_usa: m.nav_docs_div_usa,
  nav_docs_ib: m.nav_docs_ib,
  nav_docs_ibi: m.nav_docs_ibi,
  nav_docs_ibi_espp: m.nav_docs_ibi_espp,
  nav_docs_ibi_rsu: m.nav_docs_ibi_rsu,
  nav_docs_ibkr_w8ben: m.nav_docs_ibkr_w8ben,
  nav_docs_pit38: m.nav_docs_pit38,
  nav_docs_pitzg: m.nav_docs_pitzg,
  nav_docs_trade_settlement: m.nav_docs_trade_settlement,
  nav_faq: m.nav_faq,
  nav_home: m.nav_home,
  nav_prior_losses: m.nav_prior_losses,
  nav_rates: m.nav_rates,
  nav_settings: m.nav_settings,
  nav_support: m.nav_support,
  nav_tax_form: m.nav_tax_form,
  section_main: m.section_main,
  section_other: m.section_other,
  section_workspace: m.section_workspace,
};
