# Third-Party Notices

This project is licensed under AGPL-3.0-only. The following notices are
preserved for third-party projects used as references, inspirations, or sources
for parts of this project.

## pbialon/pit-38

Parts of the IBI Capital support are based on
[**pbialon/pit-38**](https://github.com/pbialon/pit-38) by Przemek Białoń.

- Project: https://github.com/pbialon/pit-38
- Upstream commit used for IBI Capital work:
  `296427a15542d754ae6840bd0bb803c25d39b380`
- Material used or adapted:
  - `pit38/plugins/stock/ibi_capital/companies.json`, ported to
    `src/core/parsers/ibi/companies.ts`
  - Small IBI Capital field-extraction details, including selected regular
    expressions, adapted for kloPIT's TypeScript parser modules under
    `src/core/parsers/ibi/`
- License: MIT
- Copyright: Copyright (c) 2025 Przemek Białoń

Original MIT license notice:

```text
MIT License

Copyright (c) 2025 Przemek Białoń

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## volodymyr-kovtun/Pitly

- Project: https://github.com/volodymyr-kovtun/Pitly
- Upstream commit used for attribution:
  `a68c1eafd07547fe08f2c2f7cdca4feb3b7cfb01`
- Material used directly:
  `samples/sample-activity-statement.csv`, copied to
  `examples/sample-activity-statement.public.csv`
- General attribution: kloPIT was inspired by Pitly, but its tax calculation
  logic differs significantly in areas such as PIT-38 form mapping, dividend
  withholding credit treatment, PIT/ZG support, prior-year loss carry-forward,
  and broker-specific parsing.
- License: MIT
- Copyright: Copyright (c) 2025 Volodymyr Kovtun

Original MIT license notice:

```text
MIT License

Copyright (c) 2025 Volodymyr Kovtun

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
