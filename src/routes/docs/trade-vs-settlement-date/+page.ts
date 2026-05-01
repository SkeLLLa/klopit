import type { GroundingSource } from '$lib/components/docs/grounding';
import { getLocale, type Locale } from '$lib/paraglide/runtime';

interface TradeSettlementPageContent {
  metaTitle: string;
  metaDescription: string;
  pageTitle: string;
  h1: string;
  intro: string;
  behaviorTitle: string;
  behaviorBody: string;
  currentUsageTitle: string;
  currentUsageHeaders: [string, string, string];
  currentUsageRows: { area: string; dateUsed: string; why: string }[];
  reasonsIntro: string;
  reasons: string[];
  consistencyTitle: string;
  consistencyBody: string;
  futureTitle: string;
  futureBody: string;
  futureListIntro: string;
  futureReasons: string[];
  frameworkTitle: string;
  frameworkItems: string[];
  yearEndTitle: string;
  yearEndIntro: string;
  yearEndPoints: string[];
  yearEndCalendarNote: string;
  yearEndHeaders: [string, string, string, string];
  yearEndRows: {
    tradeDate: string;
    settlementDate: string;
    settlementYear: string;
    tradeYear: string;
  }[];
  yearEndIbkrTitle: string;
  yearEndIbkrBody: string;
  yearEndWarning: string;
  settlementTitle: string;
  tradeTitle: string;
  argumentsForTitle: string;
  argumentsAgainstTitle: string;
  settlementFor: string[];
  settlementAgainst: string[];
  tradeFor: string[];
  tradeAgainst: string[];
  citTitle: string;
  citBody: string;
  citItems: { label: string; body: string }[];
  citConclusion: string;
  matrixTitle: string;
  matrixHeaders: [string, string, string];
  matrixRows: { scenario: string; date: string; why: string }[];
  bottomLineTitle: string;
  bottomLine: string[];
  sourcesTitle: string;
  sources: GroundingSource[];
  disclaimer: string;
  itemListName: string;
  faqPairs: { q: string; a: string }[];
}

const sourceBases: GroundingSource[] = [
  {
    key: 'art17',
    label: 'Art. 17 ust. 1ab updof - sip.lex.pl',
    href: 'https://sip.lex.pl/akty-prawne/dzu-dziennik-ustaw/podatek-dochodowy-od-osob-fizycznych-16794311/art-17',
  },
  {
    key: 'art7',
    label: 'Art. 7 ustawy o obrocie instrumentami finansowymi - lexlege.pl',
    href: 'https://lexlege.pl/ustawa-o-obrocie-instrumentami-finansowymi/art-7/',
  },
  {
    key: 'mfShares',
    label: 'MF - Zbycie akcji (podatki.gov.pl)',
    href: 'https://www.podatki.gov.pl/podatki-osobiste/pit/informacje-podstawowe/co-jest-opodatkowane/zbycie-akcji/',
  },
  {
    key: 'siiT2',
    label: 'SII - Co oznacza T+2 dla podatku',
    href: 'https://www.sii.org.pl/4921/ochrona-praw/eksperci-sii-radza/co-to-znaczy-ze-rozliczenie-transakcji-gieldowej-nastepuje-w-dniu-t2-jakie-to-ma-praktyczne-konsekwencje-dla-zwyklego-inwestora.html',
  },
  {
    key: 'kisYearEnd',
    label: 'KIS 0112-KDIL2-1.4011.351.2024.1.JK - year-end GPW sale',
    href: 'https://anylawyer.com/interpretacje-podatkowe/opodatkowanie-przychodow-ze-sprzedazy-akcji--0112-kdil2-1-4011-351-2024-1-jk',
  },
  {
    key: 'kisPit8c',
    label:
      'KIS 0114-KDIP3-2.4011.34.2019.2.AK1 - settlement date and PIT-8C duties',
    href: 'https://anylawyer.com/interpretacje-podatkowe/moment-powstania-przychodu-ze-sprzedazy-papierow-wartosciowych-po-stronie-klientow-i-zwiazanych-z-tym-faktem-obowiazkow-p-atnika-i-obowiazkow-informacyjnych-ciazacych-na-wnioskodawcy--0114-kdip3-2-4011-34-2019-2-ak1',
  },
  {
    key: 'katowice2009',
    label:
      'IBPBII/2/415-308/09/MM - historical pre-2016 trade-date interpretation',
    href: 'https://www.interpretacje.pl/pit/9192521,kiedy-powstaje-przychod-ze-sprzedazy-akcji-czy-w-momencie-realizacji.html',
  },
  {
    key: 'stockwatchT2',
    label: 'StockWatch - T+3 -> T+2 a podatek',
    href: 'https://www.stockwatch.pl/wiadomosci/od-6-pazdziernika-skraca-sie-czas-rozliczania-transakcji-gieldowych,akcje,114014',
  },
  {
    key: 'grant2016',
    label: 'Grant Thornton - moment przychodu, nowelizacja PIT 2016',
    href: 'https://grantthornton.pl/publikacja/moment-powstania-przychodow-z-odplatnego-zbycia-udzialow-akcji-i-papierow-wartosciowych-nowelizacja-ustawy-pit/',
  },
  {
    key: 'xtbPit8c',
    label: 'XTB - Dlaczego dane w PIT-8C różnią się od platformy',
    href: 'https://www.xtb.com/pl/centrum-pomocy/rozliczenie-podatkowe-4/dlaczego-dane-w-pit-8c-roznia-sie-od-platformy',
  },
  {
    key: 'epity',
    label: 'e-pity - Broszura PIT-8C (stanowisko trade-date)',
    href: 'https://www.platnik.e-pity.pl/pit8c/broszura-pit8c-opis-pol/',
  },
  {
    key: 'kisOwnership',
    label:
      'KIS 0113-KDIPT2-3.4011.143.2023.2.MS - moment przeniesienia własności',
    href: 'https://www.inforlex.pl/dok/tresc,FOB0000000000006292325,Interpretacja-indywidualna-z-dnia-16-sierpnia-2023-r-Dyrektor-Krajowej-Informacji-Skarbowej-sygn-0113-KDIPT2-3-4011-143-2023-2-MS.html',
  },
  {
    key: 'kisCit',
    label: 'KIS 0111-KDIB1-1.4010.85.2025.1.KM (CIT, 18.03.2025)',
    href: 'https://www.inforlex.pl/dok/tresc,FOB0000000000006895003,Interpretacja-indywidualna-z-dnia-18-marca-2025-r-Dyrektor-Krajowej-Informacji-Skarbowej-sygn-0111-KDIB1-1-4010-85-2025-1-KM.html',
  },
  {
    key: 'kisEarnout',
    label: 'KIS 0112-KDIL2-1.4011.401.2025.1.TR (PIT, 09.06.2025) - earn-out',
    href: 'https://www.interpretacje.pl/pit/9823241,interpretacja-indywidualna-stanowisko-prawidlowe-interpretacja-0.html',
  },
  {
    key: 'nsaEarnout',
    label: 'NSA II FSK 1648/17 (30.05.2019)',
    href: 'https://orzeczenia.nsa.gov.pl/doc/A6F12A2C8E',
  },
  {
    key: 'ibkrStatements',
    label: 'IBKR - Statement Type glossary',
    href: 'https://www.interactivebrokers.com/campus/glossary-terms/statement-type/',
  },
];

const sourceQuotes: Record<string, string> = {
  art17: '„przychód powstaje w momencie przeniesienia na nabywcę własności”',
  art7: '„przeniesienie następuje z chwilą dokonania odpowiedniego zapisu”',
  mfShares: '„przychód ... powstaje w momencie przeniesienia ich własności”',
  siiT2: '„rozliczenie transakcji giełdowej następuje w dniu T+2”',
  kisYearEnd:
    '„dochód z powyższej transakcji winien Pan rozliczyć ... za rok 2024”',
  kisPit8c:
    '„momentem powstania przychodu ... jest chwila przeniesienia własności”',
  katowice2009: '„są nim przychody należne, a nie otrzymane”',
  stockwatchT2: '„skraca się czas rozliczania transakcji giełdowych”',
  grant2016: '„moment powstania przychodów ... nowelizacja ustawy PIT”',
  xtbPit8c: '„Dlaczego dane w PIT-8C różnią się od platformy”',
  epity: '„przychód wykazać należy w dniu transakcji”',
  kisOwnership:
    '„przychód powstaje w momencie przeniesienia ... własności udziałów”',
  kisCit: '„przychód powstanie w dacie przeniesienia własności”',
  kisEarnout: '„kwota musi być należna, a nie jedynie warunkowa”',
  nsaEarnout: '„przychód należny to przychód wymagalny”',
  ibkrStatements:
    '“Activity Statement ... includes information about your account activity by trade date.”',
};

const localizedSources = (): TradeSettlementPageContent['sources'] =>
  sourceBases.map((source) => ({
    ...source,
    quote: sourceQuotes[source.key],
  }));

const contentByLocale: Record<Locale, TradeSettlementPageContent> = {
  en: {
    metaTitle: 'Trade date vs settlement date in PIT-38 | kloPIT',
    metaDescription:
      'Trade date or T+2 settlement date for PIT-38 share disposals: year-end 30/31 December trades, why kloPIT uses trade date for foreign brokers, and when settlement date matters.',
    pageTitle: 'Trade date vs settlement date',
    h1: 'Trade date vs settlement date: when does PIT-38 income arise?',
    intro:
      'Polish tax law ties share-disposal income to the moment ownership is transferred. For listed and dematerialized securities this creates a practical question: trade execution date (T) or settlement date (usually T+2). This page explains both positions and why kloPIT currently uses trade date for foreign-broker imports.',
    behaviorTitle: 'Current kloPIT behavior: trade date',
    behaviorBody:
      'kloPIT currently targets foreign brokers such as Interactive Brokers and IBI Capital. For imported stock trades, the execution date from the broker statement is the controlling date. Settlement date is not currently used for tax-year assignment, and the IBKR Activity Statement CSV examples in this repository do not include a trade-level settlement-date column.',
    currentUsageTitle: 'Dates used today',
    currentUsageHeaders: ['Area', 'Date used', 'Why'],
    currentUsageRows: [
      {
        area: 'Tax year',
        dateUsed: 'Trade/execution date',
        why: 'The imported foreign-broker statement is normally organized around execution date, and some supported brokers do not provide settlement date. Using execution date keeps the generated PIT-38 aligned with the source document.',
      },
      {
        area: 'FIFO matching',
        dateUsed: 'Trade/execution date',
        why: 'Purchases and sales are ordered by the documented transaction date. This keeps the disposal sequence, buy-leg cost basis and sale proceeds on one convention.',
      },
      {
        area: 'NBP rate lookup',
        dateUsed: 'Previous Polish business day before the trade date',
        why: 'kloPIT converts both sale proceeds and acquisition costs using the date convention chosen for the transaction, so PLN values do not mix trade-date and settlement-date logic.',
      },
      {
        area: 'Future settlement-date mode',
        dateUsed: 'Not enabled today',
        why: 'A future setting should switch all affected calculations together: tax year, FIFO dates and NBP lookup dates. For IBKR this would require a settlement-date statement/export or a trade-level settlement field if the user provides one; the current Activity Statement examples only provide Date/Time for Trades.',
      },
    ],
    reasonsIntro: 'Reasons:',
    reasons: [
      'Several supported broker statements do not provide a settlement date at all. Synthesizing T+2 by adding business days would be a guess, because actual settlement can vary by venue, instrument and calendar.',
      'Foreign brokers are not part of the Polish KDPW settlement chain governed by art. 7 of the Polish trading-instruments act, so the domestic “account entry after KDPW settlement” trigger does not map cleanly to IBKR or IBI.',
      'In Interactive Brokers, sale cash is available immediately after execution for trading purposes, so the economic disposal effectively happens at trade time.',
      'The trade-date approach is supported by the PIT-8C brochure published by e-pity, which states that brokerage-account income is shown on the transaction date, not the day funds are credited.',
      'It is consistent with the “amounts due” doctrine: at execution the price is fixed, the contract is binding and the seller has an enforceable claim.',
    ],
    consistencyTitle: 'Consistency note: ',
    consistencyBody:
      'whichever date convention you choose, apply it consistently to sale proceeds, buy-leg cost basis, FIFO matches and NBP rates. Mixing conventions can produce wrong PLN results and shift gains between tax years.',
    futureTitle: 'Future direction',
    futureBody:
      'The desirable long-term behavior is a per-session setting that lets the user choose between trade-date and settlement-date semantics, with that choice applied uniformly across all FIFO matches and rate lookups.',
    futureListIntro:
      'This becomes important once kloPIT supports Polish domestic brokers such as XTB, mBank or DM BOS, where:',
    futureReasons: [
      'The PIT-8C issued by the broker usually follows settlement date.',
      'Reconciliation against PIT-8C values is the user’s primary need, so kloPIT should be able to match the broker’s convention.',
      'Settlement date is the cleaner statutory reading of art. 17 ust. 1ab pkt 1 updof together with art. 7 ust. 2 of the trading-instruments act for domestic dematerialized shares.',
    ],
    frameworkTitle: 'Statutory framework',
    frameworkItems: [
      'Art. 17 ust. 1ab pkt 1 updof: capital-gains income arises “w momencie przeniesienia na nabywcę własności udziałów (akcji) oraz papierów wartościowych”. This is an accrual rule, not a cash rule.',
      'Art. 17 ust. 1 pkt 6 lit. a updof and art. 30b updof: 19% flat tax on capital gains, settled annually in PIT-38.',
      'Art. 11 ust. 1 updof: the general cash-basis rule is displaced for capital gains by art. 17 ust. 1ab, but still matters for dividends and contingent amounts that are not yet due.',
      'Art. 7 ust. 1 of the trading-instruments act: rights from dematerialized securities arise from the first entry on a securities account.',
      'Art. 7 ust. 2 of the same act: an agreement to transfer dematerialized securities transfers them when the relevant securities-account entry is made.',
      'KDPW settlement is the operational cycle that creates that account entry, historically T+2 and moving toward T+1 in EU markets.',
    ],
    yearEndTitle: 'Year-end trades: 30/31 December',
    yearEndIntro:
      'The boundary between December and January is the clearest place where the two conventions diverge. Under settlement-date treatment, a sale executed in the last trading days of December can belong to the next tax year if the securities-account entry settles in January.',
    yearEndPoints: [
      'A 2024 KIS interpretation addressed this exact pattern for GPW shares: sale on 29 December 2023, settlement on 3 January 2024, no PIT-8C for 2023. The authority held that the income belonged to 2024 because art. 17 ust. 1ab points to ownership transfer and art. 7 ust. 2 ties that transfer to the account entry.',
      'Older pre-2016 interpretations were not uniform. The 2009 Katowice interpretation accepted trade-date reporting under the “amounts due” wording, but that line should be treated as historical for domestic listed shares after the 2016 ownership-transfer rule.',
      'For Polish domestic brokers, reconciliation normally follows the PIT-8C. If the broker places a late-December sale in the next year because settlement occurred in January, kloPIT should not try to override that broker convention.',
    ],
    yearEndCalendarNote:
      'Illustrative T+2 calendar for a year where 27 December is Friday and 1 January is a holiday; the exact dates shift with weekends and market holidays.',
    yearEndHeaders: [
      'Trade date',
      'Settlement date',
      'Tax year by settlement date',
      'Tax year by trade date',
    ],
    yearEndRows: [
      {
        tradeDate: '27 Dec (Fri)',
        settlementDate: '31 Dec (Tue)',
        settlementYear: 'Year N',
        tradeYear: 'Year N',
      },
      {
        tradeDate: '30 Dec (Mon)',
        settlementDate: '2 Jan, Year N+1',
        settlementYear: 'Year N+1',
        tradeYear: 'Year N',
      },
      {
        tradeDate: '31 Dec (Tue)',
        settlementDate: '3 Jan, Year N+1',
        settlementYear: 'Year N+1',
        tradeYear: 'Year N',
      },
    ],
    yearEndIbkrTitle: 'IBKR statement boundary',
    yearEndIbkrBody:
      'If an IBKR annual Activity Statement includes a 31 December trade in that year, it helps as a documentary and reconciliation point, but it is not binding Polish tax authority. It supports a good-faith trade-date workflow because IBKR activity statements are trade-date based and sale cash is usable at execution. The repo examples match that: their Trades rows use Date/Time and do not include SettleDate or Settle Date. IBKR documents separate settlement-date statement types, so a future settlement-date mode should import that kind of export instead of guessing T+2 where the source file has no trade-level settlement date.',
    yearEndWarning:
      'Year-end loss harvesting is sensitive. kloPIT currently keeps foreign-broker trades in the trade year by default; a conservative settlement-date treatment can move 30/31 December sales into the next tax year.',
    settlementTitle: 'Position A: settlement date (T+2)',
    tradeTitle: 'Position B: trade date (T)',
    argumentsForTitle: 'Arguments for',
    argumentsAgainstTitle: 'Arguments against',
    settlementFor: [
      'The literal chain is clean: PIT keys to ownership transfer, the trading-instruments act defines transfer as the account entry, and the account entry happens at settlement.',
      'The 2016 codification was meant to replace older “amounts due” reasoning with an ownership-transfer test.',
      'Polish domestic brokers issue PIT-8C using settlement date, and investor guidance commonly treats late-December sales as next-year tax events when settlement falls in January.',
      'Ministry of Finance guidance emphasizes ownership transfer rather than payment, which supports settlement-date reasoning for domestic dematerialized shares.',
    ],
    settlementAgainst: [
      'The year-end user experience is awkward: a sale executed in December can belong to the following tax year.',
      'Foreign broker imports often do not expose a settlement date, and the KDPW account-entry concept does not transfer cleanly outside the Polish domestic chain.',
    ],
    tradeFor: [
      'At execution the contract is binding, the price is fixed and the seller’s claim is enforceable, which is the classic “amounts due” argument.',
      'The e-pity PIT-8C brochure explicitly supports reporting brokerage-account income on the transaction date rather than the cash-credit date.',
      'A 2025 KIS CIT ruling confirms that the date of legal disposal, not payment timing, is the relevant trigger where ownership passes at contract signing.',
      'For IBKR and similar foreign brokers, trade date is the only reliably parseable anchor and matches when the user economically disposes of the position.',
    ],
    tradeAgainst: [
      'It partially revives pre-2016 “amounts due” reasoning even though art. 17 ust. 1ab introduced an ownership-transfer test.',
      'It can conflate price fixation with ownership transfer, which are different moments for domestic dematerialized shares.',
      'It will not reconcile with PIT-8C values from Polish domestic brokers that use settlement date.',
      'NSA II FSK 1648/17 and a 2025 PIT earn-out ruling show that contract date is not a universal income date when payment is conditional or not yet due.',
    ],
    citTitle: 'CIT analogy and its limits',
    citBody:
      'KIS 0111-KDIB1-1.4010.85.2025.1.KM is a CIT ruling about unlisted sp. z o.o. shares sold for voluntary redemption. The contract had dispositive effect, so ownership passed at signing.',
    citItems: [
      {
        label: 'Helpful: ',
        body: 'it confirms that payment timing is not what triggers income when legal disposal has already occurred.',
      },
      {
        label: 'Limit: ',
        body: 'for listed dematerialized shares, legal disposal may be defined by the securities-account entry rather than the contract, so the analogy cannot skip art. 7 ust. 2.',
      },
    ],
    citConclusion:
      'Current KIS practice directly supports settlement date for domestic year-end GPW trades. For foreign brokers outside the KDPW chain, settlement date is still the conservative reading, while trade date has stronger documentation and reconciliation arguments.',
    matrixTitle: 'Decision matrix',
    matrixHeaders: ['Scenario', 'Recommended date', 'Why'],
    matrixRows: [
      {
        scenario:
          'IBKR, IBI Capital or another foreign broker with no Polish PIT-8C',
        date: 'Trade date',
        why: 'Settlement date is often missing, no Polish PIT-8C needs reconciliation, and this is the current kloPIT default.',
      },
      {
        scenario: 'Polish domestic broker issuing PIT-8C',
        date: 'Settlement date',
        why: 'Matches the broker’s PIT-8C and the cleaner domestic statutory chain.',
      },
      {
        scenario: 'Unlisted sp. z o.o. share sale',
        date: 'Contract date, if ownership passes at signing',
        why: 'Consistent with the 2025 KIS CIT analogy, subject to the contract terms.',
      },
      {
        scenario: 'Earn-out or contingent payment',
        date: 'Year when the amount becomes due',
        why: 'Conditional amounts are not necessarily taxable on the original contract date.',
      },
      {
        scenario: 'Foreign dividend',
        date: 'Pay date',
        why: 'Dividends follow the cash-basis rule rather than the share-disposal rule.',
      },
    ],
    bottomLineTitle: 'Bottom line for kloPIT users',
    bottomLine: [
      'kloPIT currently applies trade date consistently across foreign-broker imports: sale proceeds, buy-leg cost basis, FIFO matching and NBP rate lookup.',
      'If you also have a Polish broker PIT-8C, prefer that broker’s numbers for the covered trades to avoid reconciliation noise.',
      'For an audit-defense file on foreign-broker trades, keep the broker statement and cite the e-pity brochure, the “amounts due” doctrine and the practical absence of the domestic KDPW chain; also note that domestic KIS year-end practice favors settlement date.',
      'For 30/31 December trades, check whether a settlement date is available in the actual export. The IBKR Activity Statement CSV examples in this repository do not expose trade-level settlement dates; a settlement-date workflow would need a settlement-date IBKR export or another documented source.',
      'The conservative position is settlement date. The practical position for foreign brokers is trade date. The important point is consistency.',
    ],
    sourcesTitle: 'Sources',
    sources: localizedSources(),
    disclaimer:
      'Disclaimer: educational summary, not tax advice. For high-stakes situations request an individual KIS ruling or consult a tax adviser.',
    itemListName: 'Trade date vs settlement date scenarios in PIT-38',
    faqPairs: [
      {
        q: 'Does kloPIT use trade date or settlement date?',
        a: 'For current foreign-broker imports kloPIT uses trade date consistently for FIFO, NBP rates and tax-year assignment.',
      },
      {
        q: 'Which date should I use for a Polish broker PIT-8C?',
        a: 'For trades covered by a Polish PIT-8C, settlement date is usually the practical choice because it reconciles with the broker’s form.',
      },
      {
        q: 'Can a 30 or 31 December share sale belong to the next tax year?',
        a: 'Yes. Under settlement-date treatment, a late-December sale can move to the next tax year when settlement and the securities-account entry occur in January.',
      },
    ],
  },
  pl: {
    metaTitle: 'Data transakcji czy rozrachunku w PIT-38 | kloPIT',
    metaDescription:
      'Data transakcji czy data rozrachunku T+2 przy sprzedaży akcji w PIT-38: transakcje 30/31 grudnia, brokerzy zagraniczni i kiedy ma znaczenie data rozrachunku.',
    pageTitle: 'Data transakcji vs data rozrachunku',
    h1: 'Data transakcji vs data rozrachunku: kiedy powstaje przychód w PIT-38?',
    intro:
      'Polska ustawa o PIT wiąże przychód ze zbycia akcji z momentem przeniesienia własności. Dla papierów notowanych i zdematerializowanych rodzi to praktyczne pytanie: data wykonania transakcji (T) czy data rozrachunku, zwykle T+2. Ta strona wyjaśnia oba podejścia oraz powód, dla którego kloPIT obecnie używa daty transakcji przy imporcie od brokerów zagranicznych.',
    behaviorTitle: 'Obecne zachowanie kloPIT: data transakcji',
    behaviorBody:
      'kloPIT jest dziś nastawiony na brokerów zagranicznych, takich jak Interactive Brokers i IBI Capital. Dla importowanych transakcji akcjami datą sterującą jest data wykonania ze statementu brokera. Data rozrachunku nie jest dziś używana do przypisania roku podatkowego, a przykładowe CSV IBKR Activity Statement w tym repozytorium nie zawierają kolumny rozrachunku na poziomie transakcji.',
    currentUsageTitle: 'Daty używane obecnie',
    currentUsageHeaders: ['Obszar', 'Używana data', 'Dlaczego'],
    currentUsageRows: [
      {
        area: 'Rok podatkowy',
        dateUsed: 'Data transakcji / wykonania',
        why: 'Statement brokera zagranicznego zwykle jest zorganizowany według daty wykonania, a część obsługiwanych brokerów nie podaje daty rozrachunku. Data wykonania utrzymuje PIT-38 w zgodzie z dokumentem źródłowym.',
      },
      {
        area: 'Dopasowanie FIFO',
        dateUsed: 'Data transakcji / wykonania',
        why: 'Zakupy i sprzedaże są porządkowane według udokumentowanej daty transakcji. Dzięki temu kolejność zbyć, koszt nabycia i przychód ze sprzedaży pozostają w jednej konwencji.',
      },
      {
        area: 'Kurs NBP',
        dateUsed: 'Poprzedni polski dzień roboczy przed datą transakcji',
        why: 'kloPIT przelicza przychód i koszt według tej samej konwencji daty, która steruje transakcją, żeby wartości PLN nie mieszały logiki trade-date i settlement-date.',
      },
      {
        area: 'Przyszły tryb settlement-date',
        dateUsed: 'Dziś niewłączony',
        why: 'Przyszłe ustawienie powinno przełączać wszystkie zależne obliczenia razem: rok podatkowy, daty FIFO i daty kursów NBP. Dla IBKR wymagałoby to statementu/eksportu według daty rozrachunku albo pola rozrachunku na poziomie transakcji, jeśli użytkownik je dostarczy; obecne przykłady Activity Statement mają w Trades tylko Date/Time.',
      },
    ],
    reasonsIntro: 'Powody:',
    reasons: [
      'Część obsługiwanych statementów w ogóle nie podaje daty rozrachunku. Wyliczanie T+2 przez dodanie dni roboczych byłoby zgadywaniem, bo rzeczywisty rozrachunek zależy od rynku, instrumentu i kalendarza.',
      'Brokerzy zagraniczni nie są elementem polskiego łańcucha rozrachunku KDPW z art. 7 ustawy o obrocie, więc krajowy mechanizm „zapis po rozrachunku KDPW” nie przekłada się czysto na IBKR lub IBI.',
      'W Interactive Brokers środki ze sprzedaży są dostępne do handlu od razu po wykonaniu transakcji, więc ekonomiczne zbycie następuje w praktyce w dniu transakcji.',
      'Podejście trade-date wspiera broszura PIT-8C publikowana przez e-pity, która wskazuje, że przychód na rachunku maklerskim wykazuje się w dniu transakcji, a nie faktycznego uznania środków.',
      'Jest to spójne z doktryną kwot należnych: w momencie wykonania cena jest ustalona, umowa wiążąca, a roszczenie sprzedającego wymagalne.',
    ],
    consistencyTitle: 'Uwaga o spójności: ',
    consistencyBody:
      'niezależnie od wybranej konwencji stosuj ją jednolicie do przychodu ze sprzedaży, kosztu nabycia, dopasowań FIFO i kursów NBP. Mieszanie konwencji może dawać błędne wartości PLN i przesuwać dochód między latami.',
    futureTitle: 'Docelowy kierunek',
    futureBody:
      'Docelowo najlepszym rozwiązaniem jest ustawienie per sesja, w którym użytkownik wybiera semantykę daty transakcji albo daty rozrachunku, a wybór jest stosowany jednolicie do wszystkich dopasowań FIFO i kursów NBP.',
    futureListIntro:
      'To stanie się ważne, gdy kloPIT zacznie obsługiwać polskich brokerów, np. XTB, mBank lub DM BOS, gdzie:',
    futureReasons: [
      'PIT-8C wystawiany przez brokera zwykle opiera się na dacie rozrachunku.',
      'Uzgodnienie z PIT-8C jest dla użytkownika kluczowe, więc kloPIT powinien umieć odtworzyć konwencję brokera.',
      'Data rozrachunku jest czystszą wykładnią art. 17 ust. 1ab pkt 1 updof w połączeniu z art. 7 ust. 2 ustawy o obrocie dla krajowych akcji zdematerializowanych.',
    ],
    frameworkTitle: 'Ramy prawne',
    frameworkItems: [
      'Art. 17 ust. 1ab pkt 1 updof: przychód z kapitałów pieniężnych powstaje „w momencie przeniesienia na nabywcę własności udziałów (akcji) oraz papierów wartościowych”. To zasada memoriałowa, nie kasowa.',
      'Art. 17 ust. 1 pkt 6 lit. a updof i art. 30b updof: 19% podatek od zysków kapitałowych rozliczany rocznie w PIT-38.',
      'Art. 11 ust. 1 updof: ogólna zasada kasowa jest wyparta dla zbycia akcji przez art. 17 ust. 1ab, ale pozostaje istotna dla dywidend i kwot warunkowych, które nie są jeszcze należne.',
      'Art. 7 ust. 1 ustawy o obrocie: prawa ze zdematerializowanych papierów wartościowych powstają z chwilą pierwszego zapisu na rachunku papierów wartościowych.',
      'Art. 7 ust. 2 tej ustawy: umowa zobowiązująca do przeniesienia zdematerializowanych papierów wartościowych przenosi je z chwilą odpowiedniego zapisu na rachunku.',
      'Rozrachunek KDPW jest operacyjnym cyklem, który prowadzi do tego zapisu: historycznie T+2, docelowo w UE przesuwany w stronę T+1.',
    ],
    yearEndTitle: 'Transakcje na koniec roku: 30/31 grudnia',
    yearEndIntro:
      'Przełom grudnia i stycznia najlepiej pokazuje różnicę między konwencjami. Przy dacie rozrachunku sprzedaż wykonana w ostatnich dniach sesyjnych grudnia może trafić do kolejnego roku podatkowego, jeśli zapis na rachunku papierów wartościowych nastąpi dopiero w styczniu.',
    yearEndPoints: [
      'Interpretacja KIS z 2024 r. dotyczyła właśnie takiej sytuacji dla akcji GPW: sprzedaż 29 grudnia 2023 r., rozrachunek 3 stycznia 2024 r. i brak PIT-8C za 2023 r. Organ uznał, że przychód należy do 2024 r., bo art. 17 ust. 1ab odwołuje się do przeniesienia własności, a art. 7 ust. 2 wiąże to przeniesienie z zapisem na rachunku.',
      'Starsze interpretacje sprzed 2016 r. nie były jednolite. Interpretacja katowicka z 2009 r. dopuszczała datę transakcji na podstawie konstrukcji kwot należnych, ale po wprowadzeniu reguły przeniesienia własności należy ją traktować jako historyczny argument dla krajowych akcji notowanych.',
      'Dla polskich brokerów krajowych praktyczne uzgodnienie zwykle idzie za PIT-8C. Jeśli broker ujmuje grudniową sprzedaż dopiero w kolejnym roku, bo rozrachunek przypadł w styczniu, kloPIT nie powinien nadpisywać tej konwencji.',
    ],
    yearEndCalendarNote:
      'Przykładowy kalendarz T+2 dla roku, w którym 27 grudnia wypada w piątek, a 1 stycznia jest dniem wolnym; konkretne daty przesuwają się zależnie od weekendów i świąt giełdowych.',
    yearEndHeaders: [
      'Data transakcji',
      'Data rozrachunku',
      'Rok podatkowy wg rozrachunku',
      'Rok podatkowy wg transakcji',
    ],
    yearEndRows: [
      {
        tradeDate: '27 gru (pt.)',
        settlementDate: '31 gru (wt.)',
        settlementYear: 'Rok N',
        tradeYear: 'Rok N',
      },
      {
        tradeDate: '30 gru (pon.)',
        settlementDate: '2 sty, rok N+1',
        settlementYear: 'Rok N+1',
        tradeYear: 'Rok N',
      },
      {
        tradeDate: '31 gru (wt.)',
        settlementDate: '3 sty, rok N+1',
        settlementYear: 'Rok N+1',
        tradeYear: 'Rok N',
      },
    ],
    yearEndIbkrTitle: 'Granica roku w statementach IBKR',
    yearEndIbkrBody:
      'Jeśli roczny IBKR Activity Statement obejmuje transakcję z 31 grudnia w danym roku, pomaga to dokumentacyjnie i przy uzgodnieniu danych, ale nie wiąże polskiego organu podatkowego. Wspiera dobrą wiarę przy podejściu trade-date, bo activity statements IBKR są oparte na dacie transakcji, a środki ze sprzedaży są używalne od wykonania zlecenia. Przykłady w repozytorium to potwierdzają: wiersze Trades mają Date/Time i nie zawierają SettleDate ani Settle Date. IBKR dokumentuje osobne typy statementów według daty rozrachunku, więc przyszły tryb settlement-date powinien importować taki eksport zamiast zgadywać T+2, gdy plik źródłowy nie ma daty rozrachunku transakcji.',
    yearEndWarning:
      'Planowanie strat pod koniec roku jest wrażliwe na tę konwencję. kloPIT dziś domyślnie zostawia transakcje brokerów zagranicznych w roku transakcji; konserwatywne podejście settlement-date może przesunąć sprzedaż z 30/31 grudnia do kolejnego roku podatkowego.',
    settlementTitle: 'Stanowisko A: data rozrachunku (T+2)',
    tradeTitle: 'Stanowisko B: data transakcji (T)',
    argumentsForTitle: 'Argumenty za',
    argumentsAgainstTitle: 'Argumenty przeciw',
    settlementFor: [
      'Łańcuch literalny jest prosty: PIT odwołuje się do przeniesienia własności, ustawa o obrocie definiuje je przez zapis na rachunku, a zapis następuje przy rozrachunku.',
      'Nowelizacja z 2016 r. miała zastąpić wcześniejsze rozumowanie o kwotach należnych testem przeniesienia własności.',
      'Polscy brokerzy wystawiają PIT-8C według daty rozrachunku, a praktyczne opracowania inwestorskie traktują sprzedaż z końca grudnia jako zdarzenie kolejnego roku, jeśli rozrachunek przypada w styczniu.',
      'Stanowisko MF akcentuje przeniesienie własności, nie płatność, co dla krajowych papierów zdematerializowanych wzmacnia argument za datą rozrachunku.',
    ],
    settlementAgainst: [
      'Doświadczenie użytkownika na przełomie roku jest nieintuicyjne: sprzedaż wykonana w grudniu może trafić do kolejnego roku podatkowego.',
      'Importy od brokerów zagranicznych często nie zawierają daty rozrachunku, a pojęcie zapisu w KDPW nie przenosi się czysto poza polski łańcuch krajowy.',
    ],
    tradeFor: [
      'W chwili wykonania transakcji umowa jest wiążąca, cena ustalona, a roszczenie sprzedającego wymagalne, czyli działa klasyczny argument kwot należnych.',
      'Broszura PIT-8C e-pity wprost wspiera wykazanie przychodu z rachunku maklerskiego w dniu transakcji, a nie w dniu uznania środków.',
      'Interpretacja KIS z 2025 r. w CIT potwierdza, że przy przeniesieniu własności w chwili podpisania umowy liczy się data prawnego zbycia, a nie termin płatności.',
      'Dla IBKR i podobnych brokerów zagranicznych data transakcji jest jedyną pewnie parsowalną osią i odpowiada momentowi ekonomicznego wyjścia z pozycji.',
    ],
    tradeAgainst: [
      'Częściowo przywraca przednowelizacyjne rozumowanie o kwotach należnych, mimo że art. 17 ust. 1ab wprowadził test przeniesienia własności.',
      'Może mieszać ustalenie ceny z przeniesieniem własności, a dla krajowych papierów zdematerializowanych to różne momenty.',
      'Nie uzgodni się z wartościami PIT-8C od polskich brokerów używających daty rozrachunku.',
      'NSA II FSK 1648/17 oraz interpretacja PIT z 2025 r. o earn-out pokazują, że data umowy nie jest uniwersalną datą przychodu, gdy płatność jest warunkowa lub jeszcze nienależna.',
    ],
    citTitle: 'Analogiczna interpretacja CIT i jej granice',
    citBody:
      'KIS 0111-KDIB1-1.4010.85.2025.1.KM dotyczy CIT i sprzedaży niepublicznych udziałów sp. z o.o. w celu dobrowolnego umorzenia. Umowa miała skutek rozporządzający, więc własność przechodziła przy podpisaniu.',
    citItems: [
      {
        label: 'Pomaga: ',
        body: 'potwierdza, że termin płatności nie wyznacza przychodu, jeśli prawne zbycie już nastąpiło.',
      },
      {
        label: 'Ograniczenie: ',
        body: 'dla notowanych papierów zdematerializowanych prawne zbycie może wynikać z zapisu na rachunku, a nie z samej umowy, więc analogia nie może pominąć art. 7 ust. 2.',
      },
    ],
    citConclusion:
      'Aktualna praktyka KIS bezpośrednio wspiera datę rozrachunku dla krajowych transakcji GPW na przełomie roku. Dla brokerów zagranicznych poza łańcuchem KDPW data rozrachunku pozostaje stanowiskiem konserwatywnym, a data transakcji ma silniejsze argumenty dokumentacyjne i uzgodnieniowe.',
    matrixTitle: 'Macierz decyzyjna',
    matrixHeaders: ['Scenariusz', 'Rekomendowana data', 'Dlaczego'],
    matrixRows: [
      {
        scenario:
          'IBKR, IBI Capital lub inny broker zagraniczny bez polskiego PIT-8C',
        date: 'Data transakcji',
        why: 'Data rozrachunku często nie występuje w statementach, nie ma PIT-8C do uzgodnienia, a to obecny domyślny wariant kloPIT.',
      },
      {
        scenario: 'Polski broker krajowy wystawiający PIT-8C',
        date: 'Data rozrachunku',
        why: 'Zgadza się z PIT-8C brokera i z czystszym krajowym łańcuchem ustawowym.',
      },
      {
        scenario: 'Sprzedaż niepublicznych udziałów sp. z o.o.',
        date: 'Data umowy, jeśli własność przechodzi przy podpisaniu',
        why: 'Zgodne z analogią z interpretacji KIS w CIT z 2025 r., z zastrzeżeniem treści umowy.',
      },
      {
        scenario: 'Earn-out lub płatność warunkowa',
        date: 'Rok, w którym kwota staje się należna',
        why: 'Kwoty warunkowe nie zawsze są opodatkowane w dacie pierwotnej umowy.',
      },
      {
        scenario: 'Dywidenda zagraniczna',
        date: 'Data wypłaty',
        why: 'Dywidendy podlegają zasadzie kasowej, a nie regule zbycia akcji.',
      },
    ],
    bottomLineTitle: 'Wniosek dla użytkowników kloPIT',
    bottomLine: [
      'kloPIT dziś stosuje datę transakcji jednolicie w importach od brokerów zagranicznych: do przychodu, kosztu, FIFO i kursów NBP.',
      'Jeśli masz również PIT-8C od polskiego brokera, dla transakcji objętych tym PIT-8C praktycznie lepiej trzymać się wartości brokera.',
      'Do pliku obronnego dla transakcji u brokera zagranicznego zachowaj statement brokera i ostrożnie wskaż broszurę e-pity, doktrynę kwot należnych oraz praktyczny brak krajowego łańcucha KDPW; jednocześnie odnotuj, że krajowa praktyka KIS na przełomie roku wspiera datę rozrachunku.',
      'Dla transakcji z 30/31 grudnia sprawdź, czy data rozrachunku występuje w konkretnym eksporcie. Przykładowe IBKR Activity Statement CSV w tym repozytorium nie pokazują daty rozrachunku na poziomie transakcji; tryb settlement-date wymagałby eksportu IBKR według rozrachunku albo innego udokumentowanego źródła.',
      'Stanowisko konserwatywne to data rozrachunku. Stanowisko praktyczne dla brokerów zagranicznych to data transakcji. Najważniejsza jest spójność.',
    ],
    sourcesTitle: 'Źródła',
    sources: localizedSources(),
    disclaimer:
      'Zastrzeżenie: materiał edukacyjny, nie porada podatkowa. W sytuacjach istotnych finansowo złóż własny wniosek o interpretację KIS albo skonsultuj się z doradcą podatkowym.',
    itemListName: 'Scenariusze daty transakcji i daty rozrachunku w PIT-38',
    faqPairs: [
      {
        q: 'Czy kloPIT używa daty transakcji czy daty rozrachunku?',
        a: 'Dla obecnych importów od brokerów zagranicznych kloPIT używa daty transakcji jednolicie do FIFO, kursów NBP i przypisania do roku podatkowego.',
      },
      {
        q: 'Jaką datę stosować przy polskim PIT-8C?',
        a: 'Dla transakcji objętych polskim PIT-8C praktycznie wybiera się zwykle datę rozrachunku, bo pozwala uzgodnić wynik z formularzem brokera.',
      },
      {
        q: 'Czy sprzedaż akcji 30 albo 31 grudnia może trafić do kolejnego roku podatkowego?',
        a: 'Tak. Przy konwencji daty rozrachunku sprzedaż z końca grudnia może przejść do kolejnego roku, jeśli rozrachunek i zapis na rachunku nastąpią w styczniu.',
      },
    ],
  },
  uk: {
    metaTitle: 'Дата угоди чи розрахунку в PIT-38 | kloPIT',
    metaDescription:
      'Дата угоди чи дата розрахунку T+2 для продажу акцій у PIT-38: угоди 30/31 грудня, іноземні брокери і коли важлива дата розрахунку.',
    pageTitle: 'Дата угоди vs дата розрахунку',
    h1: 'Дата угоди vs дата розрахунку: коли виникає дохід у PIT-38?',
    intro:
      'Польський закон про PIT прив’язує дохід від продажу акцій до моменту переходу права власності. Для біржових і дематеріалізованих паперів це створює практичне питання: дата виконання угоди (T) чи дата розрахунку, зазвичай T+2. Ця сторінка пояснює обидва підходи і чому kloPIT зараз використовує дату угоди для імпорту від іноземних брокерів.',
    behaviorTitle: 'Поточна поведінка kloPIT: дата угоди',
    behaviorBody:
      'kloPIT зараз орієнтований на іноземних брокерів, зокрема Interactive Brokers та IBI Capital. Для імпортованих операцій з акціями керівною датою є дата виконання зі звіту брокера. Дата розрахунку зараз не використовується для податкового року, а приклади IBKR Activity Statement CSV у цьому репозиторії не містять колонки розрахунку на рівні угоди.',
    currentUsageTitle: 'Дати, які використовуються зараз',
    currentUsageHeaders: ['Область', 'Дата', 'Чому'],
    currentUsageRows: [
      {
        area: 'Податковий рік',
        dateUsed: 'Дата угоди / виконання',
        why: 'Звіт іноземного брокера зазвичай організований за датою виконання, а частина підтримуваних брокерів не дає дати розрахунку. Дата виконання тримає PIT-38 узгодженим із джерельним документом.',
      },
      {
        area: 'FIFO-зіставлення',
        dateUsed: 'Дата угоди / виконання',
        why: 'Купівлі та продажі впорядковуються за задокументованою датою транзакції. Так порядок продажів, собівартість купівлі і виручка від продажу залишаються в одній конвенції.',
      },
      {
        area: 'Курс NBP',
        dateUsed: 'Попередній польський робочий день перед датою угоди',
        why: 'kloPIT конвертує виручку і собівартість за тією самою конвенцією дати, яка керує транзакцією, щоб суми PLN не змішували логіку trade-date і settlement-date.',
      },
      {
        area: 'Майбутній режим settlement-date',
        dateUsed: 'Зараз не ввімкнений',
        why: 'Майбутнє налаштування має перемикати всі залежні розрахунки разом: податковий рік, дати FIFO і дати курсів NBP. Для IBKR це потребувало б statement/експорту за датою розрахунку або поля розрахунку на рівні угоди, якщо користувач його надасть; поточні приклади Activity Statement мають у Trades лише Date/Time.',
      },
    ],
    reasonsIntro: 'Причини:',
    reasons: [
      'Деякі підтримувані звіти брокерів взагалі не містять дати розрахунку. Штучне T+2 через додавання робочих днів було б припущенням, бо фактичний розрахунок залежить від ринку, інструмента і календаря.',
      'Іноземні брокери не є частиною польського розрахункового ланцюга KDPW за ст. 7 закону про торгівлю фінансовими інструментами, тому польський тригер запису після розрахунку KDPW не переноситься чисто на IBKR або IBI.',
      'В Interactive Brokers кошти від продажу доступні для торгівлі одразу після виконання угоди, тому економічне вибуття позиції фактично відбувається в день угоди.',
      'Підхід за датою угоди підтримує брошура PIT-8C від e-pity, де зазначено, що дохід з брокерського рахунку показується у день транзакції, а не у день фактичного зарахування коштів.',
      'Це узгоджується з доктриною належних сум: у момент виконання ціна визначена, договір є обов’язковим, а вимога продавця підлягає виконанню.',
    ],
    consistencyTitle: 'Примітка про послідовність: ',
    consistencyBody:
      'яку б дату ви не обрали, застосовуйте її однаково до виручки від продажу, собівартості купівлі, FIFO-зіставлень і курсів NBP. Змішування підходів може дати неправильні суми PLN і зсунути прибуток між роками.',
    futureTitle: 'Подальший напрям',
    futureBody:
      'Бажана довгострокова поведінка - налаштування на рівні сесії, де користувач вибирає семантику дати угоди або дати розрахунку, а вибір застосовується однаково до всіх FIFO-зіставлень і курсів NBP.',
    futureListIntro:
      'Це стане важливим, коли kloPIT підтримуватиме польських внутрішніх брокерів, наприклад XTB, mBank або DM BOS, де:',
    futureReasons: [
      'PIT-8C, який видає брокер, зазвичай базується на даті розрахунку.',
      'Звірка з PIT-8C є головною потребою користувача, тому kloPIT має вміти відтворити підхід брокера.',
      'Дата розрахунку є чистішим прочитанням ст. 17 ust. 1ab pkt 1 updof разом зі ст. 7 ust. 2 закону про торгівлю фінансовими інструментами для польських дематеріалізованих акцій.',
    ],
    frameworkTitle: 'Правова рамка',
    frameworkItems: [
      'Art. 17 ust. 1ab pkt 1 updof: дохід від капіталу виникає “w momencie przeniesienia na nabywcę własności udziałów (akcji) oraz papierów wartościowych”. Це правило нарахування, не касове правило.',
      'Art. 17 ust. 1 pkt 6 lit. a updof і art. 30b updof: 19% податок на приріст капіталу, який щороку декларується в PIT-38.',
      'Art. 11 ust. 1 updof: загальне касове правило витісняється для продажу акцій art. 17 ust. 1ab, але залишається важливим для дивідендів і умовних сум, які ще не стали належними.',
      'Art. 7 ust. 1 закону про торгівлю фінансовими інструментами: права з дематеріалізованих цінних паперів виникають з першого запису на рахунку цінних паперів.',
      'Art. 7 ust. 2 цього закону: договір про перенесення дематеріалізованих цінних паперів переносить їх з моменту відповідного запису на рахунку.',
      'Розрахунок KDPW є операційним циклом, який створює цей запис: історично T+2, а в ЄС поступово рухається до T+1.',
    ],
    yearEndTitle: 'Угоди наприкінці року: 30/31 грудня',
    yearEndIntro:
      'Межа між груднем і січнем найкраще показує різницю між підходами. За датою розрахунку продаж, виконаний в останні торгові дні грудня, може належати до наступного податкового року, якщо запис на рахунку цінних паперів відбувається вже в січні.',
    yearEndPoints: [
      'Роз’яснення KIS 2024 року розглядало саме такий випадок для акцій GPW: продаж 29 грудня 2023 року, розрахунок 3 січня 2024 року і відсутність PIT-8C за 2023 рік. Орган вирішив, що дохід належить до 2024 року, бо art. 17 ust. 1ab посилається на перехід власності, а art. 7 ust. 2 пов’язує цей перехід із записом на рахунку.',
      'Старі роз’яснення до 2016 року не були однорідними. Катовицьке роз’яснення 2009 року приймало дату угоди через конструкцію належних сум, але після введення правила переходу власності це радше історичний аргумент для польських біржових акцій.',
      'Для польських внутрішніх брокерів практична звірка зазвичай іде за PIT-8C. Якщо брокер показує грудневий продаж лише в наступному році через січневий розрахунок, kloPIT не має перекривати цю брокерську конвенцію.',
    ],
    yearEndCalendarNote:
      'Приклад календаря T+2 для року, де 27 грудня є п’ятницею, а 1 січня святковим днем; конкретні дати змінюються залежно від вихідних і біржових свят.',
    yearEndHeaders: [
      'Дата угоди',
      'Дата розрахунку',
      'Податковий рік за розрахунком',
      'Податковий рік за угодою',
    ],
    yearEndRows: [
      {
        tradeDate: '27 гру (пт)',
        settlementDate: '31 гру (вт)',
        settlementYear: 'Рік N',
        tradeYear: 'Рік N',
      },
      {
        tradeDate: '30 гру (пн)',
        settlementDate: '2 січ, рік N+1',
        settlementYear: 'Рік N+1',
        tradeYear: 'Рік N',
      },
      {
        tradeDate: '31 гру (вт)',
        settlementDate: '3 січ, рік N+1',
        settlementYear: 'Рік N+1',
        tradeYear: 'Рік N',
      },
    ],
    yearEndIbkrTitle: 'Річна межа у звітах IBKR',
    yearEndIbkrBody:
      'Якщо річний IBKR Activity Statement включає угоду 31 грудня до цього року, це допомагає як документальна опора і для звірки, але не є обов’язковим для польського податкового органу. Це підтримує добросовісний підхід за датою угоди, бо activity statements IBKR базуються на даті угоди, а кошти від продажу можна використовувати з моменту виконання. Приклади в репозиторії це підтверджують: рядки Trades мають Date/Time і не містять SettleDate або Settle Date. IBKR документує окремі типи statement за датою розрахунку, тому майбутній режим settlement-date має імпортувати такий експорт замість припускати T+2, коли джерельний файл не має дати розрахунку угоди.',
    yearEndWarning:
      'Планування збитків наприкінці року дуже залежить від цієї конвенції. kloPIT зараз за замовчуванням залишає операції іноземних брокерів у році угоди; консервативний підхід settlement-date може перенести продажі 30/31 грудня до наступного податкового року.',
    settlementTitle: 'Позиція A: дата розрахунку (T+2)',
    tradeTitle: 'Позиція B: дата угоди (T)',
    argumentsForTitle: 'Аргументи за',
    argumentsAgainstTitle: 'Аргументи проти',
    settlementFor: [
      'Буквальний ланцюг простий: PIT посилається на перехід власності, закон про торгівлю інструментами визначає його через запис на рахунку, а запис відбувається під час розрахунку.',
      'Кодифікація 2016 року мала замінити старішу логіку належних сум тестом переходу власності.',
      'Польські брокери видають PIT-8C за датою розрахунку, а інвесторські роз’яснення часто вважають продаж наприкінці грудня подією наступного року, якщо розрахунок припадає на січень.',
      'Позиція Міністерства фінансів акцентує перехід власності, а не платіж, що підтримує дату розрахунку для польських дематеріалізованих акцій.',
    ],
    settlementAgainst: [
      'На межі року це неінтуїтивно: продаж, виконаний у грудні, може потрапити до наступного податкового року.',
      'Імпорти від іноземних брокерів часто не містять дати розрахунку, а поняття запису KDPW не переноситься чисто за межі польського внутрішнього ланцюга.',
    ],
    tradeFor: [
      'У момент виконання угоди договір є обов’язковим, ціна визначена, а вимога продавця підлягає виконанню - це класичний аргумент належних сум.',
      'Брошура PIT-8C e-pity прямо підтримує показ доходу з брокерського рахунку в день транзакції, а не в день зарахування коштів.',
      'Роз’яснення KIS 2025 року для CIT підтверджує, що при переході власності в момент підписання договору релевантна дата правового відчуження, а не строк оплати.',
      'Для IBKR і подібних іноземних брокерів дата угоди є єдиною надійно парсованою опорою і відповідає моменту економічного виходу з позиції.',
    ],
    tradeAgainst: [
      'Частково повертає логіку належних сум до 2016 року, хоча art. 17 ust. 1ab запровадив тест переходу власності.',
      'Може змішувати фіксацію ціни з переходом власності, а для польських дематеріалізованих паперів це різні моменти.',
      'Не звіряється з PIT-8C від польських брокерів, які використовують дату розрахунку.',
      'NSA II FSK 1648/17 і роз’яснення PIT 2025 року щодо earn-out показують, що дата договору не є універсальною датою доходу, коли платіж умовний або ще не належний.',
    ],
    citTitle: 'Аналогія з CIT та її межі',
    citBody:
      'KIS 0111-KDIB1-1.4010.85.2025.1.KM стосується CIT і продажу непублічних часток sp. z o.o. для добровільного викупу. Договір мав розпорядчий ефект, тому власність переходила при підписанні.',
    citItems: [
      {
        label: 'Допомагає: ',
        body: 'підтверджує, що строк оплати не запускає дохід, якщо правове відчуження вже відбулося.',
      },
      {
        label: 'Обмеження: ',
        body: 'для біржових дематеріалізованих паперів правове відчуження може визначатися записом на рахунку, а не самим договором, тому аналогія не може оминути art. 7 ust. 2.',
      },
    ],
    citConclusion:
      'Поточна практика KIS прямо підтримує дату розрахунку для польських угод GPW наприкінці року. Для іноземних брокерів поза ланцюгом KDPW дата розрахунку залишається консервативним прочитанням, а дата угоди має сильніші аргументи для документування і звірки.',
    matrixTitle: 'Матриця рішень',
    matrixHeaders: ['Сценарій', 'Рекомендована дата', 'Чому'],
    matrixRows: [
      {
        scenario:
          'IBKR, IBI Capital або інший іноземний брокер без польського PIT-8C',
        date: 'Дата угоди',
        why: 'Дата розрахунку часто відсутня у звітах, немає польського PIT-8C для звірки, і це поточне значення за замовчуванням у kloPIT.',
      },
      {
        scenario: 'Польський внутрішній брокер, який видає PIT-8C',
        date: 'Дата розрахунку',
        why: 'Відповідає PIT-8C брокера і чистішому польському правовому ланцюгу.',
      },
      {
        scenario: 'Продаж непублічних часток sp. z o.o.',
        date: 'Дата договору, якщо власність переходить при підписанні',
        why: 'Узгоджується з аналогією KIS для CIT 2025 року, з урахуванням умов договору.',
      },
      {
        scenario: 'Earn-out або умовний платіж',
        date: 'Рік, коли сума стає належною',
        why: 'Умовні суми не завжди оподатковуються в дату первісного договору.',
      },
      {
        scenario: 'Іноземна дивіденда',
        date: 'Дата виплати',
        why: 'Дивіденди йдуть за касовим правилом, а не за правилом продажу акцій.',
      },
    ],
    bottomLineTitle: 'Висновок для користувачів kloPIT',
    bottomLine: [
      'kloPIT сьогодні послідовно застосовує дату угоди в імпортах від іноземних брокерів: до виручки, собівартості, FIFO і курсів NBP.',
      'Якщо у вас також є PIT-8C від польського брокера, для операцій, охоплених цим PIT-8C, практично краще триматися значень брокера.',
      'Для захисного файлу щодо операцій в іноземного брокера збережіть брокерський звіт і обережно посилайтеся на брошуру e-pity, доктрину належних сум та практичну відсутність польського ланцюга KDPW; водночас зазначте, що польська практика KIS на межі року підтримує дату розрахунку.',
      'Для угод 30/31 грудня перевірте, чи дата розрахунку є в конкретному експорті. Приклади IBKR Activity Statement CSV у цьому репозиторії не показують дату розрахунку на рівні угоди; settlement-date workflow потребував би експорту IBKR за розрахунком або іншого задокументованого джерела.',
      'Консервативна позиція - дата розрахунку. Практична позиція для іноземних брокерів - дата угоди. Найважливіше - послідовність.',
    ],
    sourcesTitle: 'Джерела',
    sources: localizedSources(),
    disclaimer:
      'Застереження: освітній матеріал, не податкова консультація. Для фінансово значущих ситуацій подайте власний запит на індивідуальне роз’яснення KIS або зверніться до податкового консультанта.',
    itemListName: 'Сценарії дати угоди і дати розрахунку в PIT-38',
    faqPairs: [
      {
        q: 'kloPIT використовує дату угоди чи дату розрахунку?',
        a: 'Для поточних імпортів від іноземних брокерів kloPIT використовує дату угоди послідовно для FIFO, курсів NBP і податкового року.',
      },
      {
        q: 'Яку дату використовувати для польського PIT-8C?',
        a: 'Для операцій, охоплених польським PIT-8C, практично зазвичай обирають дату розрахунку, бо вона звіряється з формою брокера.',
      },
      {
        q: 'Чи може продаж акцій 30 або 31 грудня належати до наступного податкового року?',
        a: 'Так. За підходом дати розрахунку продаж наприкінці грудня може перейти до наступного року, якщо розрахунок і запис на рахунку відбуваються в січні.',
      },
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
      datePublished: '2026-05-01',
      dateModified: '2026-05-01',
      jsonLd: [
        {
          '@type': 'ItemList',
          'name': content.itemListName,
          'itemListElement': content.matrixRows.map((row, index) => ({
            '@type': 'ListItem',
            'position': index + 1,
            'name': row.scenario,
            'description': `${row.date}: ${row.why}`,
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
