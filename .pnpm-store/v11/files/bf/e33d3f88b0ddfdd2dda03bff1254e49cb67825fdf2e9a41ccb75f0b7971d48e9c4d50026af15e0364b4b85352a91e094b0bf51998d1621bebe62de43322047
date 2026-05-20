const {ParseError, MissingCharError, EOFError} = require('./error');

const RX_EOT = /<<<EOT([\s\S]+?)EOT;/y;
const RX_LINE = /.*/y;
const RX_NUMBER = /-?(\d+(\.\d+)?|\.\d+)([eE]-?\d+)?\s*/y;
const RX_WHITESPACE = /\s*/y;
const RX_WHITESPACE_SAMELINE = /[^\S\n]*/y;
const RX_WORD = /([\w-]+)\s*/y;
const RX_STRING_BACKTICK = /(`(?:\\`|[\s\S])*?`)/y;
const RX_STRING_QUOTED = /((['"])(?:\\\2|[^\n])*?\2|\w+)/y;
const RX_STRING_UNQUOTED = /[^"]*/y;
/** Relaxed semver:
 * dot-separated digits sequence e.g. 1 or 1.2 or 1.2.3.4.5
 * optional pre-release chunk: "-" followed by dot-separated word characters, "-"
 * optional build chunk: "+" followed by dot-separated word characters, "-"
 */
// FIXME: should we allow leading 'v'?
const RX_VERSION = /^v?\d+(\.\d+)*(?:-(\w[-\w]*(\.[-\w]+)*))?(?:\+(\w[-\w]*(\.[-\w]+)*))?$/;

const JSON_PRIME = {
  __proto__: null,
  'null': null,
  'true': true,
  'false': false
};

function unescapeComment(s) {
  return s.replace(/\*\\\//g, '*/');
}

function unquote(s) {
  const q = s[0];
  if (q === s[s.length - 1] && (q === '"' || q === "'" || q === '`')) {
    // http://www.json.org/
    return s.slice(1, -1).replace(
      new RegExp(`\\\\([${q}\\\\/bfnrt]|u[0-9a-fA-F]{4})`, 'g'),
      s => {
        if (s[1] === q) {
          return q;
        }

        return JSON.parse(`"${s}"`);
      }
    );
  }

  return unescapeComment(s);
}

function eatLine(state) {
  RX_LINE.lastIndex = state.lastIndex;
  RX_LINE.exec(state.text);
  state.lastIndex = RX_LINE.lastIndex;
}

function eatWhitespace(state) {
  RX_WHITESPACE.lastIndex = state.lastIndex;
  state.lastIndex += RX_WHITESPACE.exec(state.text)[0].length;
}

function eatSameLineWhitespace(state) {
  RX_WHITESPACE_SAMELINE.lastIndex = state.lastIndex;
  state.lastIndex += RX_WHITESPACE_SAMELINE.exec(state.text)[0].length;
}

function parseChar(state) {
  if (state.lastIndex >= state.text.length) {
    throw new EOFError(state.lastIndex);
  }

  state.index = state.lastIndex;
  state.value = state.text[state.lastIndex];
  state.lastIndex++;
  eatWhitespace(state);
}

function parseWord(state) {
  const pos = state.lastIndex;
  RX_WORD.lastIndex = pos;
  const match = RX_WORD.exec(state.text);
  if (!match) {
    throw new ParseError({
      code: 'invalidWord',
      message: 'Invalid word',
      index: pos
    });
  }

  state.index = pos;
  state.value = match[1];
  state.lastIndex += match[0].length;
}

function parseJSON(state) {
  const pos = state.lastIndex;
  try {
    parseJSONValue(state);
  } catch (err) {
    err.message = `Invalid JSON: ${err.message}`;
    throw err;
  }

  state.index = pos;
}

function parseEOT(state) {
  const pos = state.lastIndex;
  RX_EOT.lastIndex = pos;
  const match = RX_EOT.exec(state.text);
  if (!match) {
    throw new ParseError({
      code: 'missingEOT',
      message: 'Missing EOT',
      index: pos
    });
  }

  state.index = pos;
  state.lastIndex += match[0].length;
  state.value = unescapeComment(match[1].trim());
  eatWhitespace(state);
}

function parseStringUnquoted(state) {
  RX_STRING_UNQUOTED.lastIndex = state.lastIndex;
  const match = RX_STRING_UNQUOTED.exec(state.text);
  state.index = state.lastIndex;
  state.lastIndex = RX_STRING_UNQUOTED.lastIndex;
  state.value = match[0].trim().replace(/\s+/g, '-');
}

function parseString(state, sameLine = false) {
  const pos = state.lastIndex;
  const rx = state.text[pos] === '`' ? RX_STRING_BACKTICK : RX_STRING_QUOTED;
  rx.lastIndex = pos;
  const match = rx.exec(state.text);
  if (!match) {
    throw new ParseError({
      code: 'invalidString',
      message: 'Invalid string',
      index: pos
    });
  }

  state.index = pos;
  state.lastIndex += match[0].length;
  state.value = unquote(match[1]);
  if (sameLine) {
    eatSameLineWhitespace(state);
  } else {
    eatWhitespace(state);
  }
}

function parseJSONValue(state) {
  const {text} = state;
  if (text[state.lastIndex] === '{') {
    // object
    const object = {};
    state.lastIndex++;
    eatWhitespace(state);
    while (text[state.lastIndex] !== '}') {
      parseString(state);
      const key = state.value;
      if (text[state.lastIndex] !== ':') {
        throw new MissingCharError([':'], state.lastIndex);
      }

      state.lastIndex++;
      eatWhitespace(state);
      parseJSONValue(state);
      object[key] = state.value;
      if (text[state.lastIndex] === ',') {
        state.lastIndex++;
        eatWhitespace(state);
      } else if (text[state.lastIndex] !== '}') {
        throw new MissingCharError([',', '}'], state.lastIndex);
      }
    }

    state.lastIndex++;
    eatWhitespace(state);
    state.value = object;
  } else if (text[state.lastIndex] === '[') {
    // array
    const array = [];
    state.lastIndex++;
    eatWhitespace(state);
    while (text[state.lastIndex] !== ']') {
      parseJSONValue(state);
      array.push(state.value);
      if (text[state.lastIndex] === ',') {
        state.lastIndex++;
        eatWhitespace(state);
      } else if (text[state.lastIndex] !== ']') {
        throw new MissingCharError([',', ']'], state.lastIndex);
      }
    }

    state.lastIndex++;
    eatWhitespace(state);
    state.value = array;
  } else if (text[state.lastIndex] === '"' || text[state.lastIndex] === "'" || text[state.lastIndex] === '`') {
    // string
    parseString(state);
  } else if (/[-\d.]/.test(text[state.lastIndex])) {
    // number
    parseNumber(state);
  } else {
    parseWord(state);
    if (!(state.value in JSON_PRIME)) {
      throw new ParseError({
        code: 'unknownJSONLiteral',
        args: [state.value],
        message: `Unknown literal '${state.value}'`,
        index: state.index
      });
    }

    state.value = JSON_PRIME[state.value];
  }
}

function parseNumber(state) {
  const pos = state.lastIndex;
  RX_NUMBER.lastIndex = pos;
  const match = RX_NUMBER.exec(state.text);
  if (!match) {
    throw new ParseError({
      code: 'invalidNumber',
      message: 'Invalid number',
      index: pos
    });
  }

  state.index = pos;
  state.value = Number(match[0].trim());
  state.lastIndex += match[0].length;
}

function parseStringToEnd(state) {
  RX_LINE.lastIndex = state.lastIndex;
  const match = RX_LINE.exec(state.text);
  const value = match[0].trim();
  if (!value) {
    throw new ParseError({
      code: 'missingValue',
      message: 'Missing value',
      index: RX_LINE.lastIndex
    });
  }

  state.index = state.lastIndex;
  state.value = unquote(value);
  state.lastIndex = RX_LINE.lastIndex;
}

function isValidVersion(version) {
  return RX_VERSION.test(version);
}

module.exports = {
  eatLine,
  eatWhitespace,
  parseChar,
  parseEOT,
  parseJSON,
  parseNumber,
  parseString,
  parseStringToEnd,
  parseStringUnquoted,
  parseWord,
  unquote,
  isValidVersion
};
