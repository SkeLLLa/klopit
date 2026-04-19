## [1.13.1](https://github.com/SkeLLLa/klopit/compare/v1.13.0...v1.13.1) (2026-04-19)

### 🛠 Fixes

* **ui:** homepage ux improvements ([e527684](https://github.com/SkeLLLa/klopit/commit/e52768469df7f9f2418d30f93a1ca6f34f6e812b))

## [1.13.0](https://github.com/SkeLLLa/klopit/compare/v1.12.0...v1.13.0) (2026-04-19)

### 🚀 Features

* **ibi:** add RSU statement parser and user guide ([644b549](https://github.com/SkeLLLa/klopit/commit/644b54998da05870594164fec6c18a9814440b4a))

## [1.12.0](https://github.com/SkeLLLa/klopit/compare/v1.11.1...v1.12.0) (2026-04-19)

### 🛠 Fixes

* lint ([29fb71b](https://github.com/SkeLLLa/klopit/commit/29fb71b628d683788ecf568298191155bbe94a9f))
* svelte warnings on init ([bea031c](https://github.com/SkeLLLa/klopit/commit/bea031c49d717a9c06a7315b007d044a1868f73c))
* **country-mapping:** satisfy Dexie IndexableTypeArray return type for empty fallback ([6696afa](https://github.com/SkeLLLa/klopit/commit/6696afa105aee7326c2ea6ebb5dc270243246e8e))
* **data:** use interface for TabCounts to satisfy ESLint ([13e2b5d](https://github.com/SkeLLLa/klopit/commit/13e2b5dd0ef69750b1a69e636117a75c893a51b4))
* **i18n:** update PIT-38 form version from (17) to (18) ([94c2d56](https://github.com/SkeLLLa/klopit/commit/94c2d560009774dd37ce90013da755ba841ff1d7))
* **i18n:** use imperative verb in UK transparency banner CTA ([bbebf11](https://github.com/SkeLLLa/klopit/commit/bbebf11367e4560268259457eb136d68c9d912be))
* **ibi:** flag missing Total Fees instead of silently defaulting to 0 ([7a42142](https://github.com/SkeLLLa/klopit/commit/7a4214234da205c3c3330a52e8d6d2e111757b07))
* **nbp:** correct TimeoutError handling, native Error.cause, export timeout constant ([12b2c3c](https://github.com/SkeLLLa/klopit/commit/12b2c3cc12e14737cf2d4a02f9d6edffbcd583d2))

### 🚀 Features

* **dashboard:** add [#trades](https://github.com/SkeLLLa/klopit/issues/trades)/[#dividends](https://github.com/SkeLLLa/klopit/issues/dividends) anchors and link W-8BEN warning ([ea7c371](https://github.com/SkeLLLa/klopit/commit/ea7c371ab299478621d4852724709b66267ff986))
* **dividends:** add manual entry form component ([f45ab0d](https://github.com/SkeLLLa/klopit/commit/f45ab0d9d02d8db4841c196db6b306df02265e1b))
* **dividends:** add service layer for manual CRUD ([a809b09](https://github.com/SkeLLLa/klopit/commit/a809b099356bdb5b5f91b13d6539869f21154761))
* **dividends:** wire DividendForm into DividendsTable (add/edit) ([b8dfc41](https://github.com/SkeLLLa/klopit/commit/b8dfc4168810b167e4b606a44cced4e7ec2282de))
* **docs:** add /docs/ibkr/w8ben page with nav and breadcrumb ([3e2d5a6](https://github.com/SkeLLLa/klopit/commit/3e2d5a6a15530cf5d0d024e464abeb3f165fba73))
* **docs:** link W-8BEN on /docs/ibkr and note upcoming brokers ([a7b0474](https://github.com/SkeLLLa/klopit/commit/a7b0474767962d38cb855b6ff99e2d24961712f6))
* **home:** add transparency feature card ([8858d02](https://github.com/SkeLLLa/klopit/commit/8858d0289e502adb3369992ab72d4c4c784d95f7))
* **i18n:** add keys for transparency, multi-broker, and W-8BEN doc ([33a7c9c](https://github.com/SkeLLLa/klopit/commit/33a7c9ce933e2d983862d395781e30a59acc33c3))
* **nbp:** add 10s fetch timeout with typed NbpFetchError ([b61e6c1](https://github.com/SkeLLLa/klopit/commit/b61e6c1a4db6a2a7583e7ca89d5effc50aa21f8c))
* **parsers:** add locale-aware parseDecimalLocale, document IBKR-specific assumptions ([b0f3e6e](https://github.com/SkeLLLa/klopit/commit/b0f3e6e65bfc242453f4eddfdb323c0b7ddc2f7a))
* **tax-form:** add transparency banner and section-to-dashboard links ([2e23638](https://github.com/SkeLLLa/klopit/commit/2e23638f78acd479a08c807f94651648768b03f5))
* **trade-form:** translate validation error strings ([6eb313b](https://github.com/SkeLLLa/klopit/commit/6eb313bdbcb7d9545b2ebacbd483bad9957bc5b0))

### 📔 Docs

* highlight transparency, W-8BEN, and parser plugin architecture ([001156f](https://github.com/SkeLLLa/klopit/commit/001156f7a43f3f72818571a3bd4003a7d7a359f2))
* update ([7517ce4](https://github.com/SkeLLLa/klopit/commit/7517ce4d5b1c673028948bdc17bf0093b3ca1a05))

### ✂️ Refactor

* **data:** remove unsafe m-as-Record casts, use typed Paraglide calls directly ([86dd21d](https://github.com/SkeLLLa/klopit/commit/86dd21d5d9f2fba8635f6d82d427c9cdee90edfe))
* **import:** share import loop between dialog and panel ([94c6720](https://github.com/SkeLLLa/klopit/commit/94c67203838ae51c8d49626bb5f41288657c4f6a))
* **parsers:** centralize ALL_PARSERS barrel, registry consumes list ([ccf591f](https://github.com/SkeLLLa/klopit/commit/ccf591ff55e46361aff7aed83d700579a702efb9))
* **parsers:** drop `as BrokerId` casts using typed constants ([946b93f](https://github.com/SkeLLLa/klopit/commit/946b93fbbfee61914e21c11855d196cd50d02bc7))
* **prior-losses:** reuse DeleteConfirm dialog for consistent a11y ([702a173](https://github.com/SkeLLLa/klopit/commit/702a17375859dd7b88439ae1ee1b7c3ff43a6e5f))
* **routes:** drop redundant \$effect around pageTitle.set ([7fdc3fe](https://github.com/SkeLLLa/klopit/commit/7fdc3fea2433d6e75211a1201358a53009355ee1))
* **routes:** extract useSessionBootstrap, remove 4-way duplication ([03c12bd](https://github.com/SkeLLLa/klopit/commit/03c12bd8d9882058614fa4a1a6b3f6b6c23c198d))
* **skipped-rows:** extract kindLabel to shared util ([b8246c0](https://github.com/SkeLLLa/klopit/commit/b8246c08ec60a79cc2b485296376abb4c07aea7d))
* **TradeForm:** init local state from props once; drop fragile sync $effect ([8ea1fae](https://github.com/SkeLLLa/klopit/commit/8ea1faee921442af54ccfa0845677ed41b21325c))

### ⏩ Performance

* **country-mapping:** use compound-index uniqueKeys instead of full array scan ([9b90cc0](https://github.com/SkeLLLa/klopit/commit/9b90cc0d148c08f44a4fa6692401f0f5c0e312ec))
* **dashboard:** pre-map timestamps before sort to avoid per-compare Date alloc ([fb0b670](https://github.com/SkeLLLa/klopit/commit/fb0b670b3955dde6cd5f7a9c7ab3748a6ea831d4))
* **data:** merge 6 count queries into one Dexie transaction ([91af4ad](https://github.com/SkeLLLa/klopit/commit/91af4ada4691a9f9d51f45e29feac024131cee1a))
* **opp-donation:** debounce KRS/details persistence to 400ms ([7f5a01a](https://github.com/SkeLLLa/klopit/commit/7f5a01ac0b3cf2964eeb7cbddcc9fe2848fe0dc6))

## [1.11.1](https://github.com/SkeLLLa/klopit/compare/v1.11.0...v1.11.1) (2026-04-18)

### 🛠 Fixes

* **ui:** make scroll not so ugly ([70d72d9](https://github.com/SkeLLLa/klopit/commit/70d72d97f6d7eb62d2a2c84f18677bdced3993f1))

## [1.11.0](https://github.com/SkeLLLa/klopit/compare/v1.10.0...v1.11.0) (2026-04-18)

### 🛠 Fixes

* ibi refactoring and pit 38 general info ([e09607d](https://github.com/SkeLLLa/klopit/commit/e09607de6017af7b2b8c14979420126ec005bcfc))
* lint ([bf26349](https://github.com/SkeLLLa/klopit/commit/bf2634991e592c881d13aa03f9b5f3458659f090))

### 🚀 Features

* SEO/home improvements and IBI broker support ([a9b9511](https://github.com/SkeLLLa/klopit/commit/a9b9511e14f717eb952b966d1f01a758c0cb3c1b))

## [1.10.0](https://github.com/SkeLLLa/klopit/compare/v1.9.0...v1.10.0) (2026-04-16)

### 🚀 Features

* country and curency exposure graphs ([abea759](https://github.com/SkeLLLa/klopit/commit/abea7595c491697ea391c7c8e8b9a00874724777))

## [1.9.0](https://github.com/SkeLLLa/klopit/compare/v1.8.2...v1.9.0) (2026-04-16)

### 🚀 Features

* **tax:** add support for interest rates ([2497065](https://github.com/SkeLLLa/klopit/commit/2497065d6ab1131583d8ed18dbd74de44c20dc5b))

## [1.8.2](https://github.com/SkeLLLa/klopit/compare/v1.8.1...v1.8.2) (2026-04-15)

### 🛠 Fixes

* rm millennium ([ca11aa5](https://github.com/SkeLLLa/klopit/commit/ca11aa593bbbd7b9278b69951b539122ba427626))

## [1.8.1](https://github.com/SkeLLLa/klopit/compare/v1.8.0...v1.8.1) (2026-04-15)

### 🛠 Fixes

* **parser:** capture headers per section ([25a483e](https://github.com/SkeLLLa/klopit/commit/25a483e635cfd160fbd9bcaa982ce5f0d0502d4d))

## [1.8.0](https://github.com/SkeLLLa/klopit/compare/v1.7.0...v1.8.0) (2026-04-15)

### 🚀 Features

* show skipped rows ([f03bb28](https://github.com/SkeLLLa/klopit/commit/f03bb289774ba7f79c70d0a7398278123bf7575c))

## [1.7.0](https://github.com/SkeLLLa/klopit/compare/v1.6.0...v1.7.0) (2026-04-14)

### 🛠 Fixes

* lint stuff ([fa0c436](https://github.com/SkeLLLa/klopit/commit/fa0c436855786bc3ea5c490d72137895a24be03b))

### ✂️ Refactor

* **dashboard:** use pre-computed tax fields and aggregates module ([5406941](https://github.com/SkeLLLa/klopit/commit/540694100c328ee14225701bf6256b54d8936ab7))
* **tax:** use aggregates module in calculator, pit38, and pit-zg ([980893b](https://github.com/SkeLLLa/klopit/commit/980893b1f834ce6e481d2cc9bb781b90cca569cf))

### 🚀 Features

* **db:** bump Dexie to v7 with database wipe for per-row tax fields ([b4ccd85](https://github.com/SkeLLLa/klopit/commit/b4ccd856d6f12dc26b831e0ecf15494ef8ca3ccc))
* **tax:** add per-row tax fields to types and aggregates module ([4431888](https://github.com/SkeLLLa/klopit/commit/4431888115fd73e8c53dd271dbe77681255b82ab))
* **tax:** populate per-row tax fields on DividendResult and TradeResult ([6a0c1a3](https://github.com/SkeLLLa/klopit/commit/6a0c1a396397fc3ac9265e9d7657205823aad369))

## [1.6.0](https://github.com/SkeLLLa/klopit/compare/v1.5.0...v1.6.0) (2026-04-14)

### 🛠 Fixes

* lint ([364690a](https://github.com/SkeLLLa/klopit/commit/364690a459236897c038b8e968168bfb583d8883))

### 🚀 Features

* **dashboard:** add W-8BEN lapse & no country warns ([8c28ffd](https://github.com/SkeLLLa/klopit/commit/8c28ffd40396efb46a0ab0b112270e7e49813f2a))

## [1.5.0](https://github.com/SkeLLLa/klopit/compare/v1.4.2...v1.5.0) (2026-04-13)

### 🚀 Features

* **tax:** add prior losses handling ([4f97dca](https://github.com/SkeLLLa/klopit/commit/4f97dca272938c461b4e9b38de8721222e4e8003))

## [1.4.2](https://github.com/SkeLLLa/klopit/compare/v1.4.1...v1.4.2) (2026-04-13)

### 🛠 Fixes

* **dashboard:** add capped witholding tax ([7ce7124](https://github.com/SkeLLLa/klopit/commit/7ce71245bf5e54e8c63f81ca09b295531734851a))

## [1.4.1](https://github.com/SkeLLLa/klopit/compare/v1.4.0...v1.4.1) (2026-04-13)

### 🛠 Fixes

* **dashboard:** display properly capped taxes ([a4c34a1](https://github.com/SkeLLLa/klopit/commit/a4c34a19fb7392b5e1e8fffa37d315f235117b00))

## [1.4.0](https://github.com/SkeLLLa/klopit/compare/v1.3.0...v1.4.0) (2026-04-13)

### 🚀 Features

* add all DTT rates ([e6d9079](https://github.com/SkeLLLa/klopit/commit/e6d9079dbcf59fa90aeaca3cd87b3189d7f0e22a))
* **tax:** add Norway DTT rate and link official treaty list ([f52aa8e](https://github.com/SkeLLLa/klopit/commit/f52aa8e4b1df03649396f1ebe60ae5938d667ecf))
* **tax:** add treaty-based dividend withholding cap map ([c0fa358](https://github.com/SkeLLLa/klopit/commit/c0fa358ad924ddea1a1646f9104e96a4c673d758))
* **tax:** cap dividend credit by DTT rate in buildSummary ([5fe9208](https://github.com/SkeLLLa/klopit/commit/5fe9208803fd7de352247f870a4974ff27683853))
* **tax:** cap dividend credit by DTT rate in PIT/ZG per-country ([882412a](https://github.com/SkeLLLa/klopit/commit/882412ac1602093fe8ce25fbc880475921b809d6))

### 📔 Docs

* document DTT-based dividend credit cap in HOW-IT-WORKS ([c4af36e](https://github.com/SkeLLLa/klopit/commit/c4af36ecbb8cfc95a195bf44ad11700c279cf2ed))
* **i18n:** update faq_08 to describe DTT-based dividend cap ([ef8cc47](https://github.com/SkeLLLa/klopit/commit/ef8cc479d0a405fb50e55ab7d51f0da427827fce))

## [1.3.0](https://github.com/SkeLLLa/klopit/compare/v1.2.7...v1.3.0) (2026-04-13)

### 🚀 Features

* add stale bar to dashboard as well ([62c23bb](https://github.com/SkeLLLa/klopit/commit/62c23bb619d08d37ed57b620ba499fea41a35761))
* **data:** show recalculate button in ActionBar when results are stale ([477caed](https://github.com/SkeLLLa/klopit/commit/477caede7809f80f3e5475576946ff0536beea38))
* **db:** add dataUpdatedAt and calculatedAt to SessionRecord (schema v4) ([01ab431](https://github.com/SkeLLLa/klopit/commit/01ab43141e278a70ba09bfc5a697e6d4d93ebb20))
* **db:** bump session dataUpdatedAt via Dexie hooks on source tables ([71ab149](https://github.com/SkeLLLa/klopit/commit/71ab149fb58eda150f7c8ea68c532f73b47b5a78))
* **i18n:** add stale recalculation prompt strings ([7bf887e](https://github.com/SkeLLLa/klopit/commit/7bf887e60948dbaf6936a14590e49a386b0fcafc))
* **session:** allow updating dataUpdatedAt and calculatedAt ([a0e0986](https://github.com/SkeLLLa/klopit/commit/a0e09863b029de0ca791c31344cd9b6b0658d3e6))
* **stale:** add session staleness predicate helper ([fc8e5e3](https://github.com/SkeLLLa/klopit/commit/fc8e5e30ad581343555c352679f08584a4c87187))
* **tax-form:** show stale banner above PIT-38 when data has changed ([41cee56](https://github.com/SkeLLLa/klopit/commit/41cee560ce59689b4bbd4fbe04cf2cae7a0ab4c2))
* **tax:** record calculatedAt timestamp on session ([c1219eb](https://github.com/SkeLLLa/klopit/commit/c1219eb6a740eef7af71efa02e137f1d235fb06e))

### 🛠 Fixes

* match project lint conventions in stale helper and db hooks ([ef10123](https://github.com/SkeLLLa/klopit/commit/ef10123256e5dc59bfdb77c20b1250ab23d9b9bd))
* **i18n:** fink crazy escaping ([4b48301](https://github.com/SkeLLLa/klopit/commit/4b48301479fc354008d3efee5fa9ebf3bd9760ae))

### 🧾 Other

* apply lint/prettier fixups from earlier commits ([26519c1](https://github.com/SkeLLLa/klopit/commit/26519c19fbd36fec15a43e641764ff068c88e157))

## [1.2.7](https://github.com/SkeLLLa/klopit/compare/v1.2.6...v1.2.7) (2026-04-13)

### 🛠 Fixes

* **report:** manual adding trades ([4abd841](https://github.com/SkeLLLa/klopit/commit/4abd841183028ab7f1d0230c10e6fc6338799fee))

## [1.2.6](https://github.com/SkeLLLa/klopit/compare/v1.2.5...v1.2.6) (2026-04-12)

### 🛠 Fixes

* replace font and inlang config ([368006b](https://github.com/SkeLLLa/klopit/commit/368006b25301e197250ca008cd00e88c559d4110))

## [1.2.5](https://github.com/SkeLLLa/klopit/compare/v1.2.4...v1.2.5) (2026-04-12)

### 🛠 Fixes

* **i18n:** link to fink translations ([b81ea2a](https://github.com/SkeLLLa/klopit/commit/b81ea2acc9721b2149c128c7bcce375d6dadf809))

## [1.2.4](https://github.com/SkeLLLa/klopit/compare/v1.2.3...v1.2.4) (2026-04-12)

### 🛠 Fixes

* **routing:** 404 with trailing slash ([20c4259](https://github.com/SkeLLLa/klopit/commit/20c42594271b1fb98fef0aded11ef50adfd3b3d3))

## [1.2.3](https://github.com/SkeLLLa/klopit/compare/v1.2.2...v1.2.3) (2026-04-12)

### 🛠 Fixes

* **navbar:** reload flickering and highlight ([2c696ad](https://github.com/SkeLLLa/klopit/commit/2c696ad578f9ba81990bde0b5b7005902599fcf2))

## [1.2.2](https://github.com/SkeLLLa/klopit/compare/v1.2.1...v1.2.2) (2026-04-12)

### 🛠 Fixes

* navigation on mobile ([d342ec7](https://github.com/SkeLLLa/klopit/commit/d342ec79bdae8faed8716b71408fd419c514413e))

## [1.2.1](https://github.com/SkeLLLa/klopit/compare/v1.2.0...v1.2.1) (2026-04-12)

### 🛠 Fixes

* pages publishing job ([8c9347b](https://github.com/SkeLLLa/klopit/commit/8c9347b61011223cc0f6dc740d446b4f2852c887))

### 📔 Docs

* note on naming origin ([f1ea527](https://github.com/SkeLLLa/klopit/commit/f1ea52738c9d78323c5ec7c4e4286f798341362f))

## [1.2.0](https://github.com/SkeLLLa/klopit/compare/v1.1.2...v1.2.0) (2026-04-12)

### 🚀 Features

* add breadcrumbs for easier navigation ([56ee4b5](https://github.com/SkeLLLa/klopit/commit/56ee4b5dd8b7e17e7720a4364d655fae4adfc517))

## [1.1.2](https://github.com/SkeLLLa/klopit/compare/v1.1.1...v1.1.2) (2026-04-12)

### 🛠 Fixes

* **metainfo:** incorrect urls ([72114c4](https://github.com/SkeLLLa/klopit/commit/72114c4d562307f740a8c821474bd82e5e14bdd3))

## [1.1.1](https://github.com/SkeLLLa/klopit/compare/v1.1.0...v1.1.1) (2026-04-12)

### 🛠 Fixes

* menu reorder ([df0a40a](https://github.com/SkeLLLa/klopit/commit/df0a40a10e2bcb5bc4eeb9e5dfbf51560148243b))

### 🧾 Other

* **deps-dev:** bump the all-minor-patch group with 2 updates ([ae86cae](https://github.com/SkeLLLa/klopit/commit/ae86cae0248a3b52903da2f90fdaa85797ef5406))

## [1.1.0](https://github.com/SkeLLLa/klopit/compare/v1.0.2...v1.1.0) (2026-04-12)

### 🛠 Fixes

* use typeid to allow work on http localhost ([1555571](https://github.com/SkeLLLa/klopit/commit/15555714f28ecf78345df2b5b2cfdd5e8c7c2263))

### 🚀 Features

* add proper cname ([ef16813](https://github.com/SkeLLLa/klopit/commit/ef1681369b8da916e7e56526b5e0380dcc9a33c9))

## [1.0.2](https://github.com/SkeLLLa/klopit/compare/v1.0.1...v1.0.2) (2026-04-12)

### 🛠 Fixes

* build release ([ef67849](https://github.com/SkeLLLa/klopit/commit/ef67849b28e65ae598831271c4454563a443efcb))

### 🧾 Other

* bump mise tools ([73dceb4](https://github.com/SkeLLLa/klopit/commit/73dceb4b022862b574141c67360bcb1d0efd273f))

## [1.0.1](https://github.com/SkeLLLa/klopit/compare/v1.0.0...v1.0.1) (2026-04-12)

### 🛠 Fixes

* **deps:** bump svelte from 5.55.2 to 5.55.3 ([b33f8e0](https://github.com/SkeLLLa/klopit/commit/b33f8e0858e4284b737ccb239b6e7bc4cfeba521))

## 1.0.0 (2026-04-12)

### 🧾 Other

* **deps-dev:** bump @types/node from 24.12.2 to 25.6.0 ([7b2552c](https://github.com/SkeLLLa/klopit/commit/7b2552c70fa39c5b79923a6b8773eb72213ea974))

### 🛠 Fixes

* eslint errors ([c157eba](https://github.com/SkeLLLa/klopit/commit/c157eba3ecf127aa15119da8f08c5feab2b31104))
* **lint:** add global app_version ([20811a5](https://github.com/SkeLLLa/klopit/commit/20811a5f29d4d457dc5c522dc31f80f1a1fa06c3))
* **security:** GHSA-pxg6-pf52-xh8x ([c991291](https://github.com/SkeLLLa/klopit/commit/c9912912545e150d1de35ecefcbc40a4f3ecc194))

### 🚀 Features

* add github releases and changelog ([adc21f7](https://github.com/SkeLLLa/klopit/commit/adc21f7cc98dd8f1fbbab17b7d9c2264e0a9f4c3))
* add version to header ([041764f](https://github.com/SkeLLLa/klopit/commit/041764fb2256b6a4cc4a20f34be93e7b59db01c7))
* initial release ([36430c0](https://github.com/SkeLLLa/klopit/commit/36430c067fbde8dac996951a3846971fdeb45f66))

# Changelog
