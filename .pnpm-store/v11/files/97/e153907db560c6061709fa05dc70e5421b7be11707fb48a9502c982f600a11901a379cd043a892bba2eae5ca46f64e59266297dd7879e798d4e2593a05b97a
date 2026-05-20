# usercss-meta
> Parse usercss metadata supported by the Stylus userstyle manager


## Install

[NPM](https://www.npmjs.com/package/usercss-meta)

```
$ npm install --save usercss-meta
```

unpkg.com CDN:

* <https://unpkg.com/usercss-meta/dist/usercss-meta.js>
* <https://unpkg.com/usercss-meta/dist/usercss-meta.min.js>

This module depends on `URL` parser. In Node.js, the module requires `url` module. In the browser build, it uses global variable `URL`.

## Usage

```js
const usercssMeta = require('usercss-meta');

const {metadata} = usercssMeta.parse(`/* ==UserStyle==
@name        test
@namespace   github.com/openstyles/stylus
@version     0.1.0
@description my userstyle
@author      Me
@var text my-color "Select a color" #123456
==/UserStyle== */`);

/* => {
  "vars": {
    "my-color": {
      "type": "text",
      "label": "Select a color",
      "name": "my-color",
      "value": null,
      "default": "#123456",
      "options": null
    }
  },
  "name": "test",
  "namespace": "github.com/openstyles/stylus",
  "version": "0.1.0",
  "description": "my userstyle",
  "author": "Me"
}
*/

usercssMeta.stringify(metadata, {alignKeys: true});

/* => `/* ==UserStyle==
@name        test
@namespace   github.com/openstyles/stylus
@version     0.1.0
@description my userstyle
@author      Me
@var         text my-color "Select a color" #123456
==/UserStyle== *\/`

*/
```

## API Reference

This module exports following members:

* To parse metadata:
  * `parse`: Function. Parse metadata and return an object.
  * `createParser`: Function. Create a metadata parser.
  * `ParseError`: Class.
  * `util`: Object. A collection of parser utilities.
* To stringify metadata:
  * `stringify`: Function. Stringify metadata object and return the string.
  * `createStringifier`: Function. Create a metadata stringifier.

### parse

```js
const parseResult = parse(text: String, options?: Object);
```

This is a shortcut of

```js
createParser(options).parse(text);
```

### createParser

```js
const parser = createParser({
  unknownKey?: String,
  mandatoryKeys?: Array<key: String>
  parseKey?: Object,
  parseVar?: Object,
  validateKey?: Object,
  validateVar?: Object,
  allowErrors?: Boolean
});
```

`unknownKey` decides how to parse unknown keys. Possible values are:

- `ignore`: The directive is ignored. Default.
- `assign`: Assign the text value (characters before `\s*\n`) to result object.
- `throw`: Throw a `ParseError`.

`mandatoryKeys` marks multiple keys as mandatory. If some keys are missing then throw a `ParseError`. Default: `['name', 'namespace', 'version']`.

`parseKey` is a `key`/`parseFunction` map. It allows users to extend the parser. Example:

```js
const parser = createParser({
  mandatoryKeys: [],
  parseKey: {
    myKey: util.parseNumber
  }
});
const {metadata} = parser.parse(`
  /* ==UserStyle==
  @myKey 123456
  ==/UserStyle==
`);
assert.equal(metadata.myKey, 123456);
```

`parseVar` is a `variableType`/`parseFunction` map. It extends the parser to parse additional variable types. For example:

```js
const parser = createParser({
  mandatoryKeys: [],
  parseVar: {
    myvar: util.parseNumber
  }
});
const {metadata} = parser.parse(`/* ==UserStyle==
@var myvar var-name 'Customized variable' 123456
==/UserStyle== */`);
const va = metadata.vars['var-name'];
assert.equal(va.type, 'myvar');
assert.equal(va.label, 'Customized variable');
assert.equal(va.default, 123456);
```

`validateKey` is a `key`/`validateFunction` map, which is used to validate the metadata value. The function accepts a `state` object:

```js
const parser = createParser({
  validateKey: {
    updateURL: state => {
      if (/example\.com/.test(state.value)) {
        throw new ParseError({
          message: 'Example.com is not a good URL',
          index: state.valueIndex
        });
      }
    }
  }
});
```

There are some builtin validators, which can be overwritten:

|Key|Description|
|---|-----------|
|`version`|Ensure the value matches [semver-regex](https://github.com/sindresorhus/semver-regex) then strip the leading `v` or `=`.|
|`homepageURL`|Ensure it is a valid URL and the protocol must be `http` or `https`.|
|`updateURL`|Same as above.|
|`supportURL`|Same as above.|

`validateVar` is a `variableType`/`validateFunction` map, which is used to validate variables. The function accepts a `state` object:

```js
const parser = createParser({
  validateVar: {
    color: state => {
      if (state.value === 'red') {
        throw new ParseError({
          message: '`red` is not allowed',
          index: state.valueIndex
        });
      }
    }
  }
});
```

Builtin validators:

|Variable Type|Description|
|-------------|-----------|
|`checkbox`|Ensure the value is 0 or 1.|
|`number`|Ensure sure the value is a number, doesn't exceed the minimum/maximum, and is a multiple of the step value.|
|`range`|Same as above.|

If `allowErrors` is `true`, the parser will collect parsing errors while `parser.parse()` and return them as `parseResult.errors`. Otherwise, the first parsing error will be thrown.

### parser.parse

```js
const {
  metadata: Object,
  errors: Array
} = parser.parse(text: String);
```

Parse the text (metadata header) and return the result.

### parser.validateVar

```js
parser.validateVar(varObj);
```

Validate the value of the variable object. This function uses the validators defined in `createParser`.

`varObj` is the variable object in `metadata.vars`:

```js
const {metadata} = parse(text);

/* modify metadata.vars['some-var'].value ... */

for (const varObj of Object.values(metadata.vars)) {
  validateVar(varObj);
}
```

### ParseError

```js
throw new ParseError(properties: Object);
```

Use this class to initiate a parse error.

`properties` would be assigned to the error object. There are some special properties:

* `code` - error code.
* `message` - error message.
* `index` - the string index where the error occurs.
* `args` - an array of values that is used to compose the error message. This allows other clients to generate i18n error message.

A table of errors thrown by the parser:

|`err.code`|`err.args`|Description|
|----------|----------|-----------|
|`invalidCheckboxDefault`||Expect 0 or 1.|
|`invalidRange`|Variable type|Expect a number or an array.|
|`invalidRangeMultipleUnits`|Variable type|Two different units are defined.|
|`invalidRangeTooManyValues`|Variable type|Too many values in the array.|
|`invalidRangeValue`|Variable type|Values in the array must be number, string, or null.|
|`invalidRangeDefault`|Variable type|The default value of `@var range` must be a number. This error may be thrown when parsing `number` or `range` variables.|
|`invalidRangeMin`|Variable type|The value is smaller than the minimum value.|
|`invalidRangeMax`|Variable type|The value is larger than the maximum value.|
|`invalidRangeStep`|Variable type|The value is not a multiple of the step value.|
|`invalidRangeUnits`|`[VARIABLE_TYPE, UNITS]`|The value is not a valid CSS unit.|
|`invalidNumber`||Expect a number.|
|`invalidSelect`||The value of `@var select` must be an array or an object.|
|`invalidSelectValue`||The value in the array/object must be a string.|
|`invalidSelectEmptyOptions`||The options list of `@var select` is empty.|
|`invalidSelectLabel`||The label of the option is empty.|
|`invalidSelectMultipleDefaults`||Multiple options are specified as the default value.|
|`invalidSelectNameDuplicated`||Found duplicated option names.|
|`invalidString`||Expect a string that is quoted with `'`, `"`, or `` ` ``.|
|`invalidURLProtocol`|Protocol of the URL|Only http and https are allowed.|
|`invalidVersion`|Version string|https://github.com/sindresorhus/semver-regex|
|`invalidWord`||Expect a word.|
|`missingChar`|A list of valid characters|Expect a specific character.|
|`missingEOT`||Expect `<<EOT ...` data.|
|`missingMandatory`|A list of missing keys|This error doesn't have `err.index`.|
|`missingValue`||Expect a non-whitespace value.|
|`unknownJSONLiteral`|Literal value|JSON has only 3 literals: `true`, `false`, and `null`.|
|`unknownMeta`|`[META_KEY, SUGGESTED_META_KEY]`|Unknown `@metadata`. It may suggest the correct metadata name if there is a typo. `SUGGESTED_META_KEY` can be null|
|`unknownVarType`|`[META_KEY, VARIABLE_TYPE]`|Unknown variable type. `META_KEY` could be `var` or `advanced`.|

### util

A collection of parser utilities. Some of them might be useful when extending the parser.

* `eatWhitespace(state)`: Move `state.lastIndex` to next non-whitespace character.
* `parseEOT(state)`: Parse EOT multiline string used by xStyle extension.
* `parseJSON(state)`: Parse JSON value. Note that the JSON parser can parse some additional syntax like single quoted string, backtick quoted multiline string, etc.
* `parseNumber(state)`: Parse numbers.
* `parseString(state)`: Parse quoted string.
* `parseStringToEnd(state)`: Parse the text value before line feed.
* `parseWord(state)`: Parse a word. (`[\w-]+`)

### stringify

```js
const text = stringify(metadata: Object, options?: Object);
```

This is a shortcut of:

```js
createStringifier(options).stringify(metadata);
```

### createStringifier

```js
const stringifier = createStringifier(options?: Object);
```

`options` may contain following properties:

* `alignKeys`: Boolean. Decide whether to align metadata keys. Default: `false`.
* `space`: Number|String. Same as the `space` parameter for `JSON.stringify`.
* `format`: String. Possible values are `'stylus'` and `'xstyle'`. This changes how variables are stringified (`@var` v.s. `@advanced`). Default: `'stylus'`.
* `stringifyKey`: Object. Extend the stringifier to handle specified keys.

  The object is a map of `key: stringifyFunction` pair. `stringifyFunction` would receive one argument:

  - `value`: The value of the key, which is the same as `metadataObject[key]`.

  The function should return a string or an array of strings.

* `stringifyVar`: Object. Extend the stringifier to handle custom variable type.

  The object is a map of `varType: stringifyFunction` pair. The function would receive three arguments:

  - `variable`: The variable which should be stringified, which is the same as `metadataObject.vars[variable.name]`.
  - `format`: The `format` parameter of the option.
  - `space`: The `space` parameter of the option.

  The function should return a string which represents the *default value* of the variable.

## Related

- [Stylus userstyle manager](https://github.com/openstyles/stylus) - source of most of this code
- [usercss metadata spec](https://github.com/openstyles/stylus/wiki/UserCSS-authors)
- [xStyle metadata spec](https://github.com/FirefoxBar/xStyle/wiki/Style-format#userless-representation) - Also supported by this parser

## License

MIT

## Run tests

This repo includes 3 tests:

* `xo` linter - which could be invoked with `xo` command.
* `ava` test - which could be invoked with `ava` command.
* Browser test - we currently support Chrome 49+. To run the test:

  1. Run `npm run build` to build the browser dist.
  2. Run `node browser-test` to generate browser test.
  3. Open `browser-test.html` with a browser.
  4. Open the console and ensure everything is OK.

## Changelog

* 0.12.0 (Aug 1, 2021)

  - Add: detect typo in `unknownMeta` error.
  - Change: `unknownMeta` error has two arguments now.

* 0.11.0 (Jul 6, 2021)

  - Change: the version validator no longer follows semver strictly. Implement your own validator if you need strict version check.

* 0.10.1 (Jul 6, 2021)

  - Fix: remove incompat features. Pass Chrome 49 browser test.

* 0.10.0 (Nov 19, 2020)

  - Fix: precision issue when validating decimals.
  - Change: allow hyphen in key name.
  - Change: bump node version to 8.3.0.

* 0.9.0 (Nov 26, 2018)

  - The repository is moved.
  - **Change: `parseStringToEnd` now throws an error if matched nothing.**
  - Add: `missingValue` error.

* 0.8.4 (Nov 20, 2018)

  - Add: support Chrome 49.

* 0.8.3 (Nov 7, 2018)

  - Add: `invalidSelectLabel`/`invalidSelectNameDuplicated` errors.
  - Add: `invalidSelect`/`invalidSelectValue` errors.
  - Add: parse number exponent.
  - Fix: version validator doesn't match the entire string.
  - Fix: step validator doesn't match against min/max values.

* 0.8.2 (Oct 3, 2018)

  - Add: `invalidRangeUnits` error.
  - Fix: empty variable would make the parser consume the data after `\n`.
  - Fix: step validator is broken.

* 0.8.1 (Sep 26, 2018)

  - Add: attach variable type to range errors.

* 0.8.0 (Sep 23, 2018)

  - Bump dependencies. Move `semver-regex` to package dependencies.
  - Change: while parsing `@advanced dropdown`, the result type would be `select`.
  - Add: the parser/stringifier for `@var number` and `@var range`.
  - Add: parser method `parser.validateVar`.
  - Add: now `parseNumber` and `parseJSON` accept decimals without leading zeros e.g. `.5` like CSS.
  - Add: asterisk syntax in `@var select`.
  - Add: `validateKey` and `validateVar` arguments to `createParser`.
  - Fix: when stringifying `@var select` in xstyle format, it should produce `@advanced dropdown` instead of `@advanced select`.
  - Fix: should throw an error with `@var dropdown`.
  - Fix: don't assign `advanced` key to metadata object.

* 0.7.1 (Sep 9, 2018)

  - **Breaking: the return value of `parser.parse` is changed.**
  - **Breaking: the signature of `ParseError` is changed.**
  - Add: `createParser` now accepts `allowErrors` arg.
  - Change: some error messages are changed.

* 0.6.1 (Jul 22, 2018)

  - Fix: `stringify` would throw if the value is number instead of string.

* 0.6.0 (Jul 13, 2018)

  - **Change: the `url` module is shimmed with `self.URL` by using `pkg.browser`.**
  - Fix: stringify multi-line description.

* 0.5.0 (May 16, 2018)

  - **Change: the ParseResult object doesn't contain `vars` key if there is no variable in the input.**
  - Fix: `var` key is accidentally assigned to ParseResult object.

* 0.4.0 (May 9, 2018)

  - Rewrite the parser, cleanup unused stuff.
  - Add stringify feature.
