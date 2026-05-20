# `eslint-plugin-simple-header`

Simple to use license header plugin for ESLint.

## Installation

Add `eslint-plugin-simple-header` as a dev dependency using your package manager:

``` sh
$ pnpm add -D eslint-plugin-simple-header
# or yarn, npm etc
```

## Usage

Given the following configuration:

``` js
import simpleHeader from "eslint-plugin-simple-header"

export default [
  {
    plugins: {
      "simple-header": simpleHeader,
    },
    rules: {
      "simple-header/header": ["error", {
        text: [
          "Copyright (c) {year} {author}",
          "SPDX-License-Identifier: GPL-3.0-or-later",
        ],
        templates: { author: [".*", "rini"] },
      }]
    },
  },
]
```

The rule will match a header like this:

    /*
     * Copyright (c) 1970 Linus Torvalds
     * SPDX-License-Identifier: GPL-3.0-or-later
     */

And when running auto-fix, will insert a header like so:

    /*
     * Copyright (c) 2023 Rini
     * SPDX-License-Identifier: GPL-3.0-or-later
     */

(Where 2023 is the current year, if you are from the future)

`text` may be an array of lines, or an entire string. It’s also possible to give an array of paths to `files`. In both
cases, they can include comment syntax and won’t be autoformatted (i.e. prefixed with `*`s).

Inside the header’s text `{template}` syntax can be used, which correlates to the `template` key. The first value is a
regex used to match the header, and the second is a default value. By default, `year` matches `\d{4}` and defaults the
current year.

A few other options include:

- `newlines` specifies exactly how many lines should be after the header, and defaults to 1. If the file is empty
  otherwise, no newlines are added.
- `syntax` specifies the comment syntax, defaults to `["/*", "*/"]`. It may also be a string, for single-line comment
  blocks (e.g. `//`)
- `decor` specifies how the comment is formatted with a tuple of start, indent and end. When `syntax` is a block
  comment, this defaults to `["\n", " * ", "\n "]`, and defaults to `" "` otherwise.
- `linebreak` specifies the line ending to expect on files: `"unix"` for LF, `"windows"` for CRLF. By default it will auto-detect from the file.
