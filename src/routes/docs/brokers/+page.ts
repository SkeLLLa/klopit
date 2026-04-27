import { getLocale, type Locale } from '$lib/paraglide/runtime';
import { supportedBrokers } from '../../../core/parsers/registry.js';

interface BrokerPageContent {
  metaTitle: string;
  metaDescription: string;
  pageTitle: string;
  h1: string;
  intro: string;
  importSectionTitle: string;
  docsLabel: string;
  brokerDetails: Record<
    string,
    {
      importType: string;
      supportedData: string;
      docsHref: string;
      status: 'supported' | 'partial';
    }
  >;
  featureSectionTitle: string;
  featureHeaders: [string, string];
  features: [string, string][];
  manualTitle: string;
  manualBody: string;
  manualCta: string;
  notYetTitle: string;
  notYet: string[];
  itemListName: string;
  itemListDescriptionPrefix: string;
  faqPairs: { q: string; a: string }[];
}

const contentByLocale: Record<Locale, BrokerPageContent> = {
  en: {
    metaTitle: 'Supported brokers and PIT-38 features | kloPIT',
    metaDescription:
      'Brokers and formats supported by kloPIT: Interactive Brokers CSV, IBI Capital PDF, Charles Schwab CSV, manual import, FIFO, NBP rates, dividends and PIT/ZG.',
    pageTitle: 'Supported brokers',
    h1: 'Supported brokers and kloPIT features',
    intro:
      'kloPIT is a PIT-38 calculator for investors using foreign brokers. It works best with dedicated import parsers, but you can also enter transactions, dividends and carry-in positions manually.',
    importSectionTitle: 'Brokers with an import parser',
    docsLabel: 'Documentation',
    brokerDetails: {
      ibkr: {
        importType: 'Activity Statement CSV',
        supportedData: 'trades, dividends, withholding tax, splits, mergers',
        docsHref: '/docs/ibkr',
        status: 'supported',
      },
      ibi: {
        importType: 'Sale Of Stock / Trustee Shares PDF',
        supportedData: 'ESPP, RSU, vesting, costs, FIFO lots per grant',
        docsHref: '/docs/ibi',
        status: 'supported',
      },
      schwab: {
        importType: 'CSV',
        supportedData: 'trades and dividends from Charles Schwab reports',
        docsHref: '/docs/faq',
        status: 'partial',
      },
    },
    featureSectionTitle: 'Tax features',
    featureHeaders: ['Area', 'Scope in kloPIT'],
    features: [
      ['Broker file import', 'IBKR CSV, IBI PDF, Schwab CSV'],
      ['Manual entries', 'trades, dividends, withholding, carry-in positions'],
      [
        'FIFO',
        'matching sales to the oldest lots, including per-grant lots for IBI',
      ],
      [
        'NBP rates',
        'average rate from the last business day before a trade or dividend',
      ],
      ['Foreign dividends', 'Polish 19% tax, treaty credit limit, excess WHT'],
      ['PIT-38', 'sections C, D, G and payment summary'],
      ['PIT/ZG', 'one attachment per country for foreign income'],
      ['Prior-year losses', '5-year carry-forward with a 50% annual cap'],
    ],
    manualTitle: 'When a broker has no parser',
    manualBody:
      'You can still use kloPIT by adding transactions, dividends and withholding manually on the Data page. This is a practical path for smaller accounts or brokers waiting for a dedicated importer.',
    manualCta: 'Add data manually',
    notYetTitle: 'Not supported yet',
    notYet: [
      'automatic PIT-8C import from Polish brokers',
      'filing the return with e-Urząd Skarbowy',
      'cryptocurrencies in sections E/F',
      'monthly flat-tax fields in sections H/I',
    ],
    itemListName: 'Brokers supported by kloPIT',
    itemListDescriptionPrefix: 'Import formats:',
    faqPairs: [
      {
        q: 'Which brokers does kloPIT support?',
        a: 'kloPIT supports Interactive Brokers CSV, IBI Capital PDF and Charles Schwab CSV import. Other transactions can be added manually.',
      },
      {
        q: 'Which tax features does kloPIT support?',
        a: 'kloPIT calculates FIFO, converts NBP exchange rates, handles foreign dividends with treaty credit limits, PIT-38 sections C/D/G, PIT/ZG per country and prior-year losses.',
      },
    ],
  },
  pl: {
    metaTitle: 'Obsługiwani brokerzy i funkcje PIT-38 | kloPIT',
    metaDescription:
      'Lista brokerów i formatów obsługiwanych przez kloPIT: Interactive Brokers CSV, IBI Capital PDF, Charles Schwab CSV, import ręczny, FIFO, NBP, dywidendy i PIT/ZG.',
    pageTitle: 'Obsługiwani brokerzy',
    h1: 'Obsługiwani brokerzy i funkcje kloPIT',
    intro:
      'kloPIT jest kalkulatorem PIT-38 dla inwestorów u zagranicznych brokerów. Najlepiej działa z gotowymi parserami importu, ale pozwala też ręcznie dodać transakcje, dywidendy i pozycje z poprzednich lat.',
    importSectionTitle: 'Brokerzy z parserem importu',
    docsLabel: 'Dokumentacja',
    brokerDetails: {
      ibkr: {
        importType: 'Activity Statement CSV',
        supportedData: 'transakcje, dywidendy, podatek u źródła, splity, fuzje',
        docsHref: '/docs/ibkr',
        status: 'supported',
      },
      ibi: {
        importType: 'Sale Of Stock / Trustee Shares PDF',
        supportedData: 'ESPP, RSU, vesting, koszty, partie FIFO per grant',
        docsHref: '/docs/ibi',
        status: 'supported',
      },
      schwab: {
        importType: 'CSV',
        supportedData: 'transakcje i dywidendy z raportów Charles Schwab',
        docsHref: '/docs/faq',
        status: 'partial',
      },
    },
    featureSectionTitle: 'Funkcje podatkowe',
    featureHeaders: ['Obszar', 'Zakres w kloPIT'],
    features: [
      ['Import plików brokera', 'IBKR CSV, IBI PDF, Schwab CSV'],
      ['Ręczne wpisy', 'transakcje, dywidendy, withholding, pozycje carry-in'],
      [
        'FIFO',
        'dopasowanie sprzedaży do najstarszych partii, także per grant dla IBI',
      ],
      [
        'Kursy NBP',
        'średni kurs z ostatniego dnia roboczego przed transakcją lub dywidendą',
      ],
      [
        'Dywidendy zagraniczne',
        'polski podatek 19%, limit odliczenia UPO, nadwyżka WHT',
      ],
      ['PIT-38', 'sekcje C, D, G oraz podsumowanie płatności'],
      ['PIT/ZG', 'załącznik per kraj dla dochodu zagranicznego'],
      [
        'Straty z lat ubiegłych',
        'carry-forward przez 5 lat z limitem 50% rocznie',
      ],
    ],
    manualTitle: 'Gdy broker nie ma parsera',
    manualBody:
      'Nadal możesz użyć kloPIT, dodając transakcje, dywidendy i withholding ręcznie na stronie Dane. To dobry wariant dla mniejszych rachunków albo brokerów oczekujących na dedykowany import.',
    manualCta: 'Dodaj dane ręcznie',
    notYetTitle: 'Jeszcze nieobsługiwane',
    notYet: [
      'automatyczny import PIT-8C z polskich brokerów',
      'wysyłka deklaracji do e-Urzędu Skarbowego',
      'kryptowaluty w sekcjach E/F',
      'miesięczne pola podatku zryczałtowanego w sekcjach H/I',
    ],
    itemListName: 'Obsługiwani brokerzy w kloPIT',
    itemListDescriptionPrefix: 'Import plików',
    faqPairs: [
      {
        q: 'Którzy brokerzy są obsługiwani w kloPIT?',
        a: 'kloPIT obsługuje import Interactive Brokers CSV, IBI Capital PDF oraz Charles Schwab CSV. Pozostałe transakcje można dodać ręcznie.',
      },
      {
        q: 'Jakie funkcje podatkowe obsługuje kloPIT?',
        a: 'kloPIT liczy FIFO, przelicza kursy NBP, obsługuje dywidendy zagraniczne z limitem UPO, sekcje PIT-38 C/D/G, PIT/ZG per kraj oraz straty z lat ubiegłych.',
      },
    ],
  },
  uk: {
    metaTitle: 'Підтримувані брокери і функції PIT-38 | kloPIT',
    metaDescription:
      'Брокери і формати, які підтримує kloPIT: Interactive Brokers CSV, IBI Capital PDF, Charles Schwab CSV, ручне введення, FIFO, курси NBP, дивіденди та PIT/ZG.',
    pageTitle: 'Підтримувані брокери',
    h1: 'Підтримувані брокери і функції kloPIT',
    intro:
      'kloPIT - це калькулятор PIT-38 для інвесторів у закордонних брокерів. Найкраще він працює з готовими парсерами імпорту, але також дозволяє вручну додати транзакції, дивіденди і позиції з попередніх років.',
    importSectionTitle: 'Брокери з парсером імпорту',
    docsLabel: 'Документація',
    brokerDetails: {
      ibkr: {
        importType: 'Activity Statement CSV',
        supportedData:
          'транзакції, дивіденди, податок у джерела, спліти, злиття',
        docsHref: '/docs/ibkr',
        status: 'supported',
      },
      ibi: {
        importType: 'Sale Of Stock / Trustee Shares PDF',
        supportedData: 'ESPP, RSU, vesting, витрати, FIFO лоти за кожним grant',
        docsHref: '/docs/ibi',
        status: 'supported',
      },
      schwab: {
        importType: 'CSV',
        supportedData: 'транзакції і дивіденди зі звітів Charles Schwab',
        docsHref: '/docs/faq',
        status: 'partial',
      },
    },
    featureSectionTitle: 'Податкові функції',
    featureHeaders: ['Область', 'Покриття в kloPIT'],
    features: [
      ['Імпорт файлів брокера', 'IBKR CSV, IBI PDF, Schwab CSV'],
      ['Ручні записи', 'транзакції, дивіденди, withholding, початкові позиції'],
      [
        'FIFO',
        'зіставлення продажів із найстарішими лотами, також за grant для IBI',
      ],
      [
        'Курси NBP',
        'середній курс з останнього робочого дня перед транзакцією або дивідендом',
      ],
      [
        'Іноземні дивіденди',
        'польський податок 19%, ліміт зарахування за угодою, надлишок WHT',
      ],
      ['PIT-38', 'секції C, D, G та підсумок платежу'],
      ['PIT/ZG', 'додаток окремо для кожної країни іноземного доходу'],
      [
        'Збитки минулих років',
        'перенесення протягом 5 років з річним лімітом 50%',
      ],
    ],
    manualTitle: 'Коли для брокера немає парсера',
    manualBody:
      'Ви все одно можете користуватися kloPIT, додаючи транзакції, дивіденди і withholding вручну на сторінці Дані. Це практичний варіант для менших рахунків або брокерів, які ще чекають на окремий імпортер.',
    manualCta: 'Додати дані вручну',
    notYetTitle: 'Ще не підтримується',
    notYet: [
      'автоматичний імпорт PIT-8C від польських брокерів',
      'подання декларації до e-Urząd Skarbowy',
      'криптовалюти в секціях E/F',
      'місячні поля фіксованого податку в секціях H/I',
    ],
    itemListName: 'Брокери, підтримувані kloPIT',
    itemListDescriptionPrefix: 'Формати імпорту:',
    faqPairs: [
      {
        q: 'Яких брокерів підтримує kloPIT?',
        a: 'kloPIT підтримує імпорт Interactive Brokers CSV, IBI Capital PDF та Charles Schwab CSV. Інші транзакції можна додати вручну.',
      },
      {
        q: 'Які податкові функції підтримує kloPIT?',
        a: 'kloPIT розраховує FIFO, перераховує курси NBP, обробляє іноземні дивіденди з лімітом зарахування за податковою угодою, секції PIT-38 C/D/G, PIT/ZG за країнами та збитки минулих років.',
      },
    ],
  },
};

export const load = () => {
  const brokers = supportedBrokers();
  const content = contentByLocale[getLocale()];

  return {
    brokers,
    content,
    meta: {
      title: content.metaTitle,
      description: content.metaDescription,
      ogType: 'article',
      datePublished: '2026-04-27',
      dateModified: '2026-04-27',
      jsonLd: [
        {
          '@type': 'ItemList',
          'name': content.itemListName,
          'itemListElement': brokers.map((broker, index) => ({
            '@type': 'ListItem',
            'position': index + 1,
            'name': broker.name,
            'description': `${content.itemListDescriptionPrefix} ${broker.fileExtensions.join(', ')}`,
          })),
        },
        {
          '@type': 'FAQPage',
          'mainEntity': content.faqPairs.map((pair) => ({
            '@type': 'Question',
            'name': pair.q,
            'acceptedAnswer': {
              '@type': 'Answer',
              'text': pair.a,
            },
          })),
        },
      ],
    },
  };
};
