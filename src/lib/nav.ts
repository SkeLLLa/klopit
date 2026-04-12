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
        href: '#',
        icon: 'FolderOpen',
        children: [
          {
            labelKey: 'nav_docs_ib',
            href: '/docs/interactive-brokers',
            icon: 'FileText',
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
      { labelKey: 'nav_rates', href: '/rates', icon: 'ArrowLeftRight' },
      { labelKey: 'nav_tax_form', href: '/tax-form', icon: 'FileText' },
      { labelKey: 'nav_dashboard', href: '/dashboard', icon: 'BarChart3' },
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
