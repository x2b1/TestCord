'use strict';

const {URL} = require('url');

const UNITS = require('../data/units');
const {ParseError, MissingCharError} = require('./error');
const {LevenshteinDistanceWithMax} = require('./levensthein-distance');
const {
  eatLine,
  eatWhitespace,
  parseEOT,
  parseJSON,
  parseString,
  parseStringToEnd,
  parseStringUnquoted,
  parseWord,
  parseChar,
  isValidVersion
} = require('./parse-util');

const UNITS_SET = new Set(UNITS);

const DEFAULT_PARSER = {
  name: parseStringToEnd,
  version: parseStringToEnd,
  namespace: parseStringToEnd,
  author: parseStringToEnd,
  description: parseStringToEnd,
  homepageURL: parseStringToEnd,
  supportURL: parseStringToEnd,
  updateURL: parseStringToEnd,
  license: parseStringToEnd,
  preprocessor: parseStringToEnd
};

const DEFAULT_VALIDATOR = {
  version: validateVersion,
  homepageURL: validateURL,
  supportURL: validateURL,
  updateURL: validateURL
};

const DEFAULT_VAR_PARSER = {
  text: parseStringToEnd,
  color: parseStringToEnd,
  checkbox: parseChar,
  select: parseSelect,
  dropdown: {
    advanced: parseVarXStyle
  },
  image: {
    var: parseSelect,
    advanced: parseVarXStyle
  },
  number: parseRange,
  range: parseRange
};

const DEFAULT_VAR_VALIDATOR = {
  checkbox: validateCheckbox,
  number: validateRange,
  range: validateRange
};

const MANDATORY_META = ['name', 'namespace', 'version'];
const RANGE_PROPS = ['default', 'min', 'max', 'step'];

function parseRange(state) {
  parseJSON(state);
  const result = {
    min: null,
    max: null,
    step: null,
    units: null
  };
  if (typeof state.value === 'number') {
    result.default = state.value;
  } else if (Array.isArray(state.value)) {
    let i = 0;
    for (const item of state.value) {
      if (typeof item === 'string') {
        if (result.units != null) {
          throw new ParseError({
            code: 'invalidRangeMultipleUnits',
            message: 'units is alredy defined',
            args: [state.type],
            index: state.valueIndex
          });
        }

        result.units = item;
      } else if (typeof item === 'number' || item === null) {
        if (i >= RANGE_PROPS.length) {
          throw new ParseError({
            code: 'invalidRangeTooManyValues',
            message: 'the array contains too many values',
            args: [state.type],
            index: state.valueIndex
          });
        }

        result[RANGE_PROPS[i++]] = item;
      } else {
        throw new ParseError({
          code: 'invalidRangeValue',
          message: 'value must be number, string, or null',
          args: [state.type],
          index: state.valueIndex
        });
      }
    }
  } else {
    throw new ParseError({
      code: 'invalidRange',
      message: 'the default value must be an array or a number',
      index: state.valueIndex,
      args: [state.type]
    });
  }

  state.value = result.default;
  Object.assign(state.varResult, result);
}

function parseSelect(state) {
  parseJSON(state);
  if (typeof state.value !== 'object' || !state.value) {
    throw new ParseError({
      code: 'invalidSelect',
      message: 'The value must be an array or object'
    });
  }

  const options = Array.isArray(state.value) ?
    state.value.map(key => createOption(key)) :
    Object.keys(state.value).map(key => createOption(key, state.value[key]));
  if (new Set(options.map(o => o.name)).size < options.length) {
    throw new ParseError({
      code: 'invalidSelectNameDuplicated',
      message: 'Option name is duplicated'
    });
  }

  if (options.length === 0) {
    throw new ParseError({
      code: 'invalidSelectEmptyOptions',
      message: 'Option list is empty'
    });
  }

  const defaults = options.filter(o => o.isDefault);
  if (defaults.length > 1) {
    throw new ParseError({
      code: 'invalidSelectMultipleDefaults',
      message: 'multiple default values'
    });
  }

  options.forEach(o => {
    delete o.isDefault;
  });
  state.varResult.options = options;
  state.value = (defaults.length > 0 ? defaults[0] : options[0]).name;
}

function parseVarXStyle(state) {
  const pos = state.lastIndex;
  if (state.text[state.lastIndex] !== '{') {
    throw new MissingCharError(['{'], pos);
  }

  const options = [];
  state.lastIndex++;
  while (state.text[state.lastIndex] !== '}') {
    const option = {};

    parseStringUnquoted(state);
    option.name = state.value;

    parseString(state);
    option.label = state.value;

    if (state.type === 'dropdown') {
      parseEOT(state);
    } else {
      parseString(state);
    }

    option.value = state.value;

    options.push(option);
  }

  state.lastIndex++;
  eatWhitespace(state);
  if (options.length === 0) {
    throw new ParseError({
      code: 'invalidSelectEmptyOptions',
      message: 'Option list is empty',
      index: pos
    });
  }

  if (state.type === 'dropdown') {
    state.varResult.type = 'select';
    state.type = 'select';
  }

  state.varResult.options = options;
  state.value = options[0].name;
}

function createOption(label, value) {
  if (typeof label !== 'string' || value && typeof value !== 'string') {
    throw new ParseError({
      code: 'invalidSelectValue',
      message: 'Values in the object/array must be strings'
    });
  }

  let isDefault = false;
  if (label.endsWith('*')) {
    isDefault = true;
    label = label.slice(0, -1);
  }

  let name;
  const match = label.match(/^(\w+):(.*)/);
  if (match) {
    ([, name, label] = match);
  }

  if (!name) {
    name = label;
  }

  if (!label) {
    throw new ParseError({
      code: 'invalidSelectLabel',
      message: 'Option label is empty'
    });
  }

  if (value == null) {
    value = name;
  }

  return {name, label, value, isDefault};
}

function collectErrors(fn, errors) {
  if (errors) {
    try {
      fn();
    } catch (err) {
      errors.push(err);
    }
  } else {
    fn();
  }
}

function validateVersion(state) {
  if (!isValidVersion(state.value)) {
    throw new ParseError({
      code: 'invalidVersion',
      args: [state.value],
      message: `Invalid version: ${state.value}`,
      index: state.valueIndex
    });
  }

  state.value = normalizeVersion(state.value);
}

function validateURL(state) {
  let url;
  try {
    url = new URL(state.value);
  } catch (err) {
    err.args = [state.value];
    err.index = state.valueIndex;
    throw err;
  }

  if (!/^https?:/.test(url.protocol)) {
    throw new ParseError({
      code: 'invalidURLProtocol',
      args: [url.protocol],
      message: `Invalid protocol: ${url.protocol}`,
      index: state.valueIndex
    });
  }
}

function validateCheckbox(state) {
  if (state.value !== '1' && state.value !== '0') {
    throw new ParseError({
      code: 'invalidCheckboxDefault',
      message: 'value must be 0 or 1',
      index: state.valueIndex
    });
  }
}

function validateRange(state) {
  const value = state.value;
  if (typeof value !== 'number') {
    throw new ParseError({
      code: 'invalidRangeDefault',
      message: `the default value of @var ${state.type} must be a number`,
      index: state.valueIndex,
      args: [state.type]
    });
  }

  const result = state.varResult;
  if (result.min != null && value < result.min) {
    throw new ParseError({
      code: 'invalidRangeMin',
      message: 'the value is smaller than the minimum',
      index: state.valueIndex,
      args: [state.type]
    });
  }

  if (result.max != null && value > result.max) {
    throw new ParseError({
      code: 'invalidRangeMax',
      message: 'the value is larger than the maximum',
      index: state.valueIndex,
      args: [state.type]
    });
  }

  if (
    result.step != null &&
    [value, result.min, result.max]
      .some(n => n != null && !isMultipleOf(n, result.step))
  ) {
    throw new ParseError({
      code: 'invalidRangeStep',
      message: 'the value is not a multiple of the step',
      index: state.valueIndex,
      args: [state.type]
    });
  }

  if (result.units && !UNITS_SET.has(result.units)) {
    throw new ParseError({
      code: 'invalidRangeUnits',
      message: `Invalid CSS unit: ${result.units}`,
      index: state.valueIndex,
      args: [state.type, result.units]
    });
  }
}

function isMultipleOf(value, step) {
  const n = Math.abs(value / step);
  const nInt = Math.round(n);
  // IEEE 754 double-precision numbers can reliably store 15 decimal digits
  // of which some are already occupied by the integer part
  return Math.abs(n - nInt) < Math.pow(10, (`${nInt}`.length - 16));
}

function createParser({
  unknownKey = 'ignore',
  mandatoryKeys = MANDATORY_META,
  parseKey: userParseKey,
  parseVar: userParseVar,
  validateKey: userValidateKey,
  validateVar: userValidateVar,
  allowErrors = false
} = {}) {
  if (!['ignore', 'assign', 'throw'].includes(unknownKey)) {
    throw new TypeError("unknownKey must be 'ignore', 'assign', or 'throw'");
  }

  const parser = Object.assign(Object.create(null), DEFAULT_PARSER, userParseKey);
  const keysOfParser = [...Object.keys(parser), 'advanced', 'var'];
  const varParser = Object.assign({}, DEFAULT_VAR_PARSER, userParseVar);
  const validator = Object.assign({}, DEFAULT_VALIDATOR, userValidateKey);
  const varValidator = Object.assign({}, DEFAULT_VAR_VALIDATOR, userValidateVar);

  return {parse, validateVar};

  function validateVar(varObject) {
    const state = {
      key: 'var',
      type: varObject.type,
      value: varObject.value,
      varResult: varObject
    };
    _validateVar(state);
  }

  function _validateVar(state) {
    const validate = typeof varValidator[state.type] === 'object' ?
      varValidator[state.type][state.key] : varValidator[state.type];
    if (validate) {
      validate(state);
    }
  }

  function parseVar(state) {
    const result = {
      type: null,
      label: null,
      name: null,
      value: null,
      default: null,
      options: null
    };
    state.varResult = result;

    parseWord(state);
    state.type = state.value;
    result.type = state.type;

    const doParse = typeof varParser[state.type] === 'object' ?
      varParser[state.type][state.key] : varParser[state.type];
    if (!doParse) {
      throw new ParseError({
        code: 'unknownVarType',
        message: `Unknown @${state.key} type: ${state.type}`,
        args: [state.key, state.type],
        index: state.index
      });
    }

    parseWord(state);
    result.name = state.value;

    parseString(state, true);
    result.label = state.value;

    state.valueIndex = state.lastIndex;
    doParse(state);
    _validateVar(state);
    result.default = state.value;
    if (!state.usercssData.vars) {
      state.usercssData.vars = {};
    }

    state.usercssData.vars[result.name] = result;
    if (state.key === 'advanced') {
      state.maybeUSO = true;
    }
  }

  function parse(text) {
    if (text.includes('\r')) {
      throw new TypeError("metadata includes invalid character: '\\r'");
    }

    const usercssData = {};
    const errors = [];

    const re = /@([\w-]+)[^\S\r\n]*/gm;
    const state = {
      index: 0,
      lastIndex: 0,
      text,
      usercssData,
      warn: err => errors.push(err)
    };

    // parse
    let match;
    while ((match = re.exec(text))) {
      state.index = match.index;
      state.lastIndex = re.lastIndex;
      state.key = match[1];
      state.shouldIgnore = false;

      collectErrors(() => {
        try {
          if (state.key === 'var' || state.key === 'advanced') {
            parseVar(state);
          } else {
            parseKey(state);
          }
        } catch (err) {
          if (err.index === undefined) {
            err.index = state.index;
          }

          throw err;
        }

        if (state.key !== 'var' && state.key !== 'advanced' && !state.shouldIgnore) {
          usercssData[state.key] = state.value;
        }
      }, allowErrors && errors);

      re.lastIndex = state.lastIndex;
    }

    if (state.maybeUSO && !usercssData.preprocessor) {
      usercssData.preprocessor = 'uso';
    }

    collectErrors(() => {
      const missing = mandatoryKeys.filter(k =>
        !Object.prototype.hasOwnProperty.call(usercssData, k) || !usercssData[k]
      );
      if (missing.length > 0) {
        throw new ParseError({
          code: 'missingMandatory',
          args: missing,
          message: `Missing metadata: ${missing.map(k => `@${k}`).join(', ')}`
        });
      }
    }, allowErrors && errors);

    return {
      metadata: usercssData,
      errors
    };
  }

  function parseKey(state) {
    let doParse = parser[state.key];
    if (!doParse) {
      if (unknownKey === 'assign') {
        doParse = parseStringToEnd;
      } else {
        eatLine(state);
        if (unknownKey === 'ignore') {
          state.shouldIgnore = true;
          return;
        }

        // TODO: Suggest the item with the smallest distance or even multiple results?
        // Implementation note: swtich to Levenshtein automaton variation.
        const MAX_EDIT = Math.log2(state.key.length);
        const maybeSuggestion = keysOfParser.find(metaKey => LevenshteinDistanceWithMax(metaKey, state.key, MAX_EDIT));

        // throw
        throw new ParseError({
          code: 'unknownMeta',
          args: [state.key, maybeSuggestion],
          message: `Unknown metadata: @${state.key}${maybeSuggestion ? `, did you mean @${maybeSuggestion}?` : ''}`,
          index: state.index
        });
      }
    }

    state.valueIndex = state.lastIndex;
    doParse(state);
    if (validator[state.key]) {
      validator[state.key](state);
    }
  }
}

function normalizeVersion(version) {
  // https://docs.npmjs.com/misc/semver#versions
  if (version[0] === 'v' || version[0] === '=') {
    return version.slice(1);
  }

  return version;
}

module.exports = {
  parse(text, options) {
    return createParser(options).parse(text);
  },
  createParser,
  isMultipleOf,
};
