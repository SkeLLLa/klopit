export interface NavItem {
  labelKey: string;
  href: string;
  icon: string;
  children?: NavItem[];
}

export interface NavSection {
  labelKey: string;
  items: NavItem[];
}

export const navigation: NavSection[] = [
  {
    labelKey: 'section_main',
    items: [
      { labelKey: 'nav_home', href: '/', icon: 'House' },
      {
        labelKey: 'nav_docs',
        href: '/docs',
        icon: 'FolderOpen',
        children: [
          {
            labelKey: 'nav_docs_pit38',
            href: '/docs/pit-38',
            icon: 'BookOpen',
          },
          {
            labelKey: 'nav_docs_ib',
            href: '/docs/ibkr',
            icon: 'FileText',
            children: [
              {
                labelKey: 'nav_docs_ibkr_w8ben',
                href: '/docs/ibkr/w8ben',
                icon: 'FileText',
              },
            ],
          },
          {
            labelKey: 'nav_docs_ibi',
            href: '/docs/ibi',
            icon: 'FileText',
            children: [
              {
                labelKey: 'nav_docs_ibi_espp',
                href: '/docs/ibi/espp',
                icon: 'FileText',
              },
            ],
          },
          {
            labelKey: 'nav_faq',
            href: '/docs/faq',
            icon: 'HelpCircle',
          },
        ],
      },
    ],
  },
  {
    labelKey: 'section_workspace',
    items: [
      { labelKey: 'nav_data', href: '/data', icon: 'Table' },
      {
        labelKey: 'nav_prior_losses',
        href: '/prior-losses',
        icon: 'TrendingDown',
      },
      { labelKey: 'nav_tax_form', href: '/tax-form', icon: 'FileText' },
      { labelKey: 'nav_dashboard', href: '/dashboard', icon: 'BarChart3' },
      { labelKey: 'nav_rates', href: '/rates', icon: 'ArrowLeftRight' },
    ],
  },
  {
    labelKey: 'section_other',
    items: [
      { labelKey: 'nav_support', href: '/support', icon: 'Heart' },
      { labelKey: 'nav_about', href: '/about', icon: 'Info' },
    ],
  },
];
