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
