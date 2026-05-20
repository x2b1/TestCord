class ParseError extends Error {
  constructor(err) {
    super(err.message);
    delete err.message;
    this.name = 'ParseError';
    Object.assign(this, err);
  }
}

class MissingCharError extends ParseError {
  constructor(chars, index) {
    super({
      code: 'missingChar',
      args: chars,
      message: `Missing character: ${chars.map(c => `'${c}'`).join(', ')}`,
      index
    });
  }
}

class EOFError extends ParseError {
  constructor(index) {
    super({
      code: 'EOF',
      message: 'Unexpected end of file',
      index
    });
  }
}

module.exports = {
  ParseError,
  MissingCharError,
  EOFError
};
