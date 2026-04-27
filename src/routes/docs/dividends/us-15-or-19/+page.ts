import { getLocale, type Locale } from '$lib/paraglide/runtime';

interface DividendPageContent {
  metaTitle: string;
  metaDescription: string;
  pageTitle: string;
  updatedLabel: string;
  h1: string;
  intro: string;
  cta: string;
  decisionTitle: string;
  decisionHeaders: [string, string, string, string, string];
  scenarios: {
    name: string;
    wht: string;
    credit: string;
    tax: string;
    action: string;
  }[];
  exampleTitle: string;
  exampleBody: string;
  exampleHeaders: [string, string, string];
  exampleRows: [string, string, string][];
  exampleConclusion: string;
  faqTitle: string;
  faqPairs: { q: string; a: string }[];
  relatedLinks: { label: string; href: string }[];
  sourcesTitle: string;
  sources: { label: string; href: string }[];
  howToName: string;
  howToSteps: string[];
}

const contentByLocale: Record<Locale, DividendPageContent> = {
  en: {
    metaTitle: 'US dividends in PIT-38 - 15% or 19%? IB trap | kloPIT',
    metaDescription:
      'US dividends in PIT-38: when the 15% treaty credit applies, when a broker withholds 19% or 30%, the credit limit, art. 30a, and foreign refund options.',
    pageTitle: 'US dividends in PIT-38',
    updatedLabel: 'Last updated: April 27, 2026',
    h1: 'US dividends in PIT-38: 15% or 19%?',
    intro:
      'Short answer: Poland applies a 19% flat tax to US dividends. Under the Poland-US tax treaty you can credit foreign tax only up to 15% of the gross dividend. If the broker withheld 30% or 19%, the excess above 15 percentage points does not reduce Polish tax.',
    cta: 'Enter a dividend and calculate PIT-38',
    decisionTitle: 'Decision matrix for a 100 PLN gross dividend',
    decisionHeaders: [
      'Scenario',
      'Broker WHT',
      'Credit in Poland',
      'Polish top-up',
      'What to do',
    ],
    scenarios: [
      {
        name: 'W-8BEN filed',
        wht: '15 PLN',
        credit: '15 PLN',
        tax: '4 PLN',
        action: 'standard case, no excess withholding to reclaim',
      },
      {
        name: 'No W-8BEN',
        wht: '30 PLN',
        credit: '15 PLN',
        tax: '4 PLN',
        action: 'recover the excess abroad if the amount justifies it',
      },
      {
        name: 'Broker withheld 19%',
        wht: '19 PLN',
        credit: '15 PLN',
        tax: '4 PLN',
        action: 'the excess 4 pp does not reduce Polish tax',
      },
      {
        name: 'US REIT or unusual distribution',
        wht: 'often 30 PLN',
        credit: '15 PLN',
        tax: '4 PLN',
        action: 'check the distribution type and rate in the statement',
      },
    ],
    exampleTitle: 'Numerical example: Interactive Brokers withheld 19%',
    exampleBody:
      'An investor received a 100 USD dividend from a US company. The broker withheld 19% WHT, and the NBP rate from the previous business day was 4.1234 PLN/USD.',
    exampleHeaders: ['Step', 'Value', 'Source / formula'],
    exampleRows: [
      ['Gross USD', '100.00 USD', 'broker statement'],
      ['WHT 19%', '19.00 USD', 'broker statement'],
      [
        'NBP USD/PLN rate from the previous business day',
        '4.1234 PLN',
        'NBP table A',
      ],
      ['Gross PLN', '412.34 PLN', '100 x 4.1234'],
      ['WHT in PLN', '78.34 PLN', '19 x 4.1234'],
      ['Polish tax 19%', '78.34 PLN', '412.34 x 0.19'],
      ['Treaty credit limit 15%', '61.85 PLN', '412.34 x 0.15'],
      ['Excess WHT', '16.49 PLN', '78.34 - 61.85'],
      ['Polish tax to pay', '16.49 PLN', '78.34 - 61.85'],
    ],
    exampleConclusion:
      'Conclusion: even though 19% was withheld abroad, PIT-38 still shows a Polish top-up because the credit stops at the 15% treaty limit.',
    faqTitle: 'Frequently asked questions',
    faqPairs: [
      {
        q: 'Do I pay tax twice on US dividends?',
        a: 'No. Article 30a section 9 of the Polish PIT Act lets you credit tax paid in the US up to the treaty limit. For US dividends the standard limit is 15%, so with a valid W-8BEN you usually pay the missing 4 percentage points in Poland.',
      },
      {
        q: 'What if the broker withheld 19% instead of 15%?',
        a: 'In PIT-38 you can credit only 15%, the Poland-US treaty limit. The excess 4 percentage points does not offset Polish tax. It needs to be clarified with the broker or reclaimed abroad.',
      },
      {
        q: 'Do I need PIT/ZG for US dividends?',
        a: 'Yes. Foreign dividends require a PIT/ZG attachment per country. The source country is the issuer residence, so for US companies you use the USA, not the exchange where the shares trade.',
      },
      {
        q: 'How do I convert a USD dividend to PLN?',
        a: 'Use the NBP average exchange rate, table A, from the last business day before the dividend income date. The same rule applies to the gross dividend and the tax withheld abroad.',
      },
      {
        q: 'What is W-8BEN for?',
        a: 'W-8BEN confirms that you are not a US tax resident. Once filed, the broker can apply the 15% Poland-US treaty rate instead of the default 30% US withholding tax.',
      },
    ],
    relatedLinks: [
      { label: 'PIT/ZG for dividends', href: '/docs/pit-zg' },
      { label: 'W-8BEN in IBKR', href: '/docs/ibkr/w8ben' },
      { label: 'PIT-38 FAQ', href: '/docs/faq' },
    ],
    sourcesTitle: 'Legal basis and sources',
    sources: [
      {
        label: 'Polish PIT Act, article 30a',
        href: 'https://isap.sejm.gov.pl/',
      },
      {
        label: 'Polish PIT Act, article 11a',
        href: 'https://isap.sejm.gov.pl/',
      },
      {
        label: 'Poland-US tax treaty of October 8, 1974',
        href: 'https://isap.sejm.gov.pl/',
      },
      {
        label: 'IRS Form W-8BEN',
        href: 'https://www.irs.gov/forms-pubs/about-form-w-8-ben',
      },
    ],
    howToName: 'How to report a US dividend in PIT-38',
    howToSteps: [
      'Download the broker statement.',
      'Check the WHT withheld in the US.',
      'Convert the gross USD amount to PLN with the NBP rate from the previous business day.',
      'Calculate 19% Polish tax on the gross PLN amount.',
      'Calculate the treaty limit: 15% of the gross PLN amount.',
      'Treat WHT above the limit as non-creditable in Poland.',
      'Enter the values in section G of PIT-38 and the relevant PIT/ZG attachment.',
    ],
  },
  pl: {
    metaTitle: 'Dywidendy USA w PIT-38 - 15% czy 19%? IB trap | kloPIT',
    metaDescription:
      'Dywidendy USA w PIT-38: kiedy 15% (UPO + W-8BEN), kiedy 19% (IB pobiera bez W-8BEN). Limit odliczenia, art. 30a, jak odzyskać nadpłatę za granicą.',
    pageTitle: 'Dywidendy USA w PIT-38',
    updatedLabel: 'Ostatnia aktualizacja: 27 kwietnia 2026',
    h1: 'Dywidendy USA w PIT-38: 15% czy 19%?',
    intro:
      'Krótka odpowiedź: Polska stosuje 19% zryczałtowanego podatku od dywidend amerykańskich. Z UPO Polska-USA odliczasz maksymalnie 15% podatku zapłaconego za granicą. Jeśli broker pobrał 30% albo 19%, nadwyżka ponad 15 pp nie zmniejsza polskiego podatku.',
    cta: 'Wpisz dywidendę i policz PIT-38',
    decisionTitle: 'Macierz decyzji dla 100 PLN dywidendy brutto',
    decisionHeaders: [
      'Scenariusz',
      'WHT brokera',
      'Odliczenie w Polsce',
      'Dopłata w Polsce',
      'Co zrobić',
    ],
    scenarios: [
      {
        name: 'W-8BEN złożone',
        wht: '15 PLN',
        credit: '15 PLN',
        tax: '4 PLN',
        action: 'standardowy wariant, bez odzyskiwania nadwyżki',
      },
      {
        name: 'Brak W-8BEN',
        wht: '30 PLN',
        credit: '15 PLN',
        tax: '4 PLN',
        action: 'odzyskaj nadwyżkę za granicą, jeśli to opłacalne',
      },
      {
        name: 'Broker pobrał 19%',
        wht: '19 PLN',
        credit: '15 PLN',
        tax: '4 PLN',
        action: 'nadwyżka 4 pp nie zmniejsza podatku w Polsce',
      },
      {
        name: 'US REIT lub nietypowa dywidenda',
        wht: 'często 30 PLN',
        credit: '15 PLN',
        tax: '4 PLN',
        action: 'sprawdź typ wypłaty i stawkę na statement',
      },
    ],
    exampleTitle: 'Przykład liczbowy: Interactive Brokers pobrał 19%',
    exampleBody:
      'Inwestor otrzymał 100 USD dywidendy od spółki z USA. Broker pobrał 19% WHT, a kurs NBP z poprzedniego dnia roboczego wynosił 4,1234 PLN/USD.',
    exampleHeaders: ['Krok', 'Wartość', 'Źródło / wzór'],
    exampleRows: [
      ['Brutto USD', '100,00 USD', 'statement brokera'],
      ['WHT 19%', '19,00 USD', 'statement brokera'],
      [
        'Kurs NBP USD/PLN z poprzedniego dnia roboczego',
        '4,1234 PLN',
        'tabela A NBP',
      ],
      ['Brutto PLN', '412,34 PLN', '100 x 4,1234'],
      ['WHT w PLN', '78,34 PLN', '19 x 4,1234'],
      ['Polski podatek 19%', '78,34 PLN', '412,34 x 0,19'],
      ['Limit UPO 15%', '61,85 PLN', '412,34 x 0,15'],
      ['Nadwyżka WHT', '16,49 PLN', '78,34 - 61,85'],
      ['Polski podatek do dopłaty', '16,49 PLN', '78,34 - 61,85'],
    ],
    exampleConclusion:
      'Wniosek: mimo pobrania 19% za granicą polski PIT-38 nadal pokazuje dopłatę, bo odliczenie zatrzymuje się na limicie UPO 15%.',
    faqTitle: 'Najczęstsze pytania',
    faqPairs: [
      {
        q: 'Czy płacę dwa razy podatek od dywidend USA?',
        a: 'Nie. Art. 30a ust. 9 ustawy o PIT pozwala odliczyć podatek zapłacony w USA do limitu UPO. Dla dywidend USA standardowy limit to 15%, więc przy prawidłowym W-8BEN dopłacasz w Polsce brakujące 4 pp do krajowej stawki 19%.',
      },
      {
        q: 'Co jeśli broker pobrał 19% zamiast 15%?',
        a: 'W PIT-38 odliczysz tylko 15%, czyli limit z UPO Polska-USA. Nadwyżka 4 pp nie kompensuje polskiego podatku. Trzeba ją wyjaśnić u brokera albo odzyskać za granicą.',
      },
      {
        q: 'Czy potrzebuję PIT/ZG przy dywidendach USA?',
        a: 'Tak. Dywidendy zagraniczne wymagają załącznika PIT/ZG per kraj. Krajem źródła jest rezydencja emitenta, więc dla amerykańskich spółek wpisujesz USA, a nie giełdę notowania.',
      },
      {
        q: 'Jak przeliczyć dywidendę USD na PLN?',
        a: 'Stosujesz średni kurs NBP tabela A z ostatniego dnia roboczego poprzedzającego datę uzyskania dywidendy. Ta sama zasada dotyczy brutto dywidendy i podatku pobranego za granicą.',
      },
      {
        q: 'Po co jest W-8BEN?',
        a: 'W-8BEN potwierdza, że nie jesteś rezydentem podatkowym USA. Po jego złożeniu broker może użyć stawki 15% z umowy Polska-USA zamiast domyślnego 30% podatku u źródła.',
      },
    ],
    relatedLinks: [
      { label: 'PIT/ZG dla dywidend', href: '/docs/pit-zg' },
      { label: 'W-8BEN w IBKR', href: '/docs/ibkr/w8ben' },
      { label: 'FAQ PIT-38', href: '/docs/faq' },
    ],
    sourcesTitle: 'Podstawa prawna i źródła',
    sources: [
      { label: 'Ustawa o PIT, art. 30a', href: 'https://isap.sejm.gov.pl/' },
      { label: 'Ustawa o PIT, art. 11a', href: 'https://isap.sejm.gov.pl/' },
      {
        label: 'UPO Polska-USA z 8 października 1974 r.',
        href: 'https://isap.sejm.gov.pl/',
      },
      {
        label: 'IRS Form W-8BEN',
        href: 'https://www.irs.gov/forms-pubs/about-form-w-8-ben',
      },
    ],
    howToName: 'Jak rozliczyć dywidendę USA w PIT-38',
    howToSteps: [
      'Pobierz statement z brokera.',
      'Sprawdź WHT pobrany w USA.',
      'Przelicz brutto USD na PLN kursem NBP z dnia poprzedzającego.',
      'Oblicz 19% polskiego podatku od brutto PLN.',
      'Oblicz limit UPO: 15% brutto PLN.',
      'Nadwyżkę WHT ponad limit potraktuj jako nieodliczalną w Polsce.',
      'Wpisz wartości w sekcję G PIT-38 oraz odpowiedni PIT/ZG.',
    ],
  },
  uk: {
    metaTitle: 'Дивіденди США в PIT-38 - 15% чи 19%? Пастка IB | kloPIT',
    metaDescription:
      'Дивіденди США в PIT-38: коли діє кредит 15% за угодою і W-8BEN, коли брокер утримує 19% або 30%, ліміт відрахування, ст. 30a та повернення надплати за кордоном.',
    pageTitle: 'Дивіденди США в PIT-38',
    updatedLabel: 'Останнє оновлення: 27 квітня 2026',
    h1: 'Дивіденди США в PIT-38: 15% чи 19%?',
    intro:
      'Коротко: Польща застосовує 19% фіксований податок до дивідендів зі США. За податковою угодою Польща-США можна зарахувати іноземний податок лише до 15% валової дивіденди. Якщо брокер утримав 30% або 19%, надлишок понад 15 процентних пунктів не зменшує польський податок.',
    cta: 'Введіть дивіденд і розрахуйте PIT-38',
    decisionTitle: 'Матриця рішень для 100 PLN валової дивіденди',
    decisionHeaders: [
      'Сценарій',
      'WHT брокера',
      'Зарахування в Польщі',
      'Доплата в Польщі',
      'Що зробити',
    ],
    scenarios: [
      {
        name: 'W-8BEN подано',
        wht: '15 PLN',
        credit: '15 PLN',
        tax: '4 PLN',
        action: 'стандартний варіант, без повернення надлишку',
      },
      {
        name: 'Немає W-8BEN',
        wht: '30 PLN',
        credit: '15 PLN',
        tax: '4 PLN',
        action: 'поверніть надлишок за кордоном, якщо це виправдано сумою',
      },
      {
        name: 'Брокер утримав 19%',
        wht: '19 PLN',
        credit: '15 PLN',
        tax: '4 PLN',
        action: 'надлишок 4 п.п. не зменшує податок у Польщі',
      },
      {
        name: 'US REIT або нетипова виплата',
        wht: 'часто 30 PLN',
        credit: '15 PLN',
        tax: '4 PLN',
        action: 'перевірте тип виплати і ставку у звіті брокера',
      },
    ],
    exampleTitle: 'Числовий приклад: Interactive Brokers утримав 19%',
    exampleBody:
      'Інвестор отримав 100 USD дивідендів від компанії зі США. Брокер утримав 19% WHT, а курс NBP з попереднього робочого дня становив 4,1234 PLN/USD.',
    exampleHeaders: ['Крок', 'Значення', 'Джерело / формула'],
    exampleRows: [
      ['Валова сума USD', '100,00 USD', 'звіт брокера'],
      ['WHT 19%', '19,00 USD', 'звіт брокера'],
      [
        'Курс NBP USD/PLN з попереднього робочого дня',
        '4,1234 PLN',
        'таблиця A NBP',
      ],
      ['Валова сума PLN', '412,34 PLN', '100 x 4,1234'],
      ['WHT у PLN', '78,34 PLN', '19 x 4,1234'],
      ['Польський податок 19%', '78,34 PLN', '412,34 x 0,19'],
      ['Ліміт угоди 15%', '61,85 PLN', '412,34 x 0,15'],
      ['Надлишок WHT', '16,49 PLN', '78,34 - 61,85'],
      ['Польський податок до доплати', '16,49 PLN', '78,34 - 61,85'],
    ],
    exampleConclusion:
      'Висновок: навіть якщо за кордоном утримано 19%, PIT-38 все одно показує доплату, бо зарахування обмежується лімітом угоди 15%.',
    faqTitle: 'Поширені запитання',
    faqPairs: [
      {
        q: 'Чи сплачую я податок двічі з дивідендів США?',
        a: 'Ні. Ст. 30a п. 9 польського закону про PIT дозволяє зарахувати податок, сплачений у США, до ліміту податкової угоди. Для дивідендів США стандартний ліміт становить 15%, тому з чинною W-8BEN у Польщі зазвичай доплачується відсутні 4 процентні пункти до польської ставки 19%.',
      },
      {
        q: 'Що якщо брокер утримав 19% замість 15%?',
        a: "У PIT-38 можна зарахувати лише 15%, тобто ліміт угоди Польща-США. Надлишок 4 процентні пункти не компенсує польський податок. Його потрібно з'ясувати з брокером або повертати за кордоном.",
      },
      {
        q: 'Чи потрібен PIT/ZG для дивідендів США?',
        a: 'Так. Іноземні дивіденди потребують додатка PIT/ZG окремо для кожної країни. Країна джерела - це резидентство емітента, тому для американських компаній вказується США, а не біржа торгів.',
      },
      {
        q: 'Як перерахувати дивіденд USD у PLN?',
        a: 'Застосовується середній курс NBP, таблиця A, з останнього робочого дня перед датою отримання доходу. Те саме правило діє для валової дивіденди і податку, утриманого за кордоном.',
      },
      {
        q: 'Для чого потрібна W-8BEN?',
        a: 'W-8BEN підтверджує, що ви не є податковим резидентом США. Після подання форми брокер може застосувати ставку 15% за угодою Польща-США замість стандартного 30% податку у джерела.',
      },
    ],
    relatedLinks: [
      { label: 'PIT/ZG для дивідендів', href: '/docs/pit-zg' },
      { label: 'W-8BEN в IBKR', href: '/docs/ibkr/w8ben' },
      { label: 'FAQ PIT-38', href: '/docs/faq' },
    ],
    sourcesTitle: 'Правова основа і джерела',
    sources: [
      {
        label: 'Польський закон про PIT, ст. 30a',
        href: 'https://isap.sejm.gov.pl/',
      },
      {
        label: 'Польський закон про PIT, ст. 11a',
        href: 'https://isap.sejm.gov.pl/',
      },
      {
        label: 'Податкова угода Польща-США від 8 жовтня 1974 р.',
        href: 'https://isap.sejm.gov.pl/',
      },
      {
        label: 'Форма IRS W-8BEN',
        href: 'https://www.irs.gov/forms-pubs/about-form-w-8-ben',
      },
    ],
    howToName: 'Як розрахувати дивіденд США в PIT-38',
    howToSteps: [
      'Завантажте звіт брокера.',
      'Перевірте WHT, утриманий у США.',
      'Перерахуйте валову суму USD у PLN за курсом NBP з попереднього робочого дня.',
      'Розрахуйте польський податок 19% від валової суми PLN.',
      'Розрахуйте ліміт угоди: 15% від валової суми PLN.',
      'Надлишок WHT понад ліміт вважайте таким, що не зараховується в Польщі.',
      'Внесіть значення до секції G PIT-38 та відповідного додатка PIT/ZG.',
    ],
  },
};

export const load = () => {
  const content = contentByLocale[getLocale()];

  return {
    content,
    meta: {
      title: content.metaTitle,
      description: content.metaDescription,
      ogType: 'article',
      datePublished: '2026-04-27',
      dateModified: '2026-04-27',
      jsonLd: [
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
        {
          '@type': 'HowTo',
          'name': content.howToName,
          'step': content.howToSteps.map((text, index) => ({
            '@type': 'HowToStep',
            'position': index + 1,
            text,
          })),
        },
      ],
    },
  };
};
