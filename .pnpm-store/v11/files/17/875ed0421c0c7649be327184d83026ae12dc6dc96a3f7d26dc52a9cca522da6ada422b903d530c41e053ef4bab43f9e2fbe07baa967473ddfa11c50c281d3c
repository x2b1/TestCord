var FontStyle
;(function (FontStyle) {
  FontStyle[(FontStyle['NotSet'] = -1)] = 'NotSet'
  FontStyle[(FontStyle['None'] = 0)] = 'None'
  FontStyle[(FontStyle['Italic'] = 1)] = 'Italic'
  FontStyle[(FontStyle['Bold'] = 2)] = 'Bold'
  FontStyle[(FontStyle['Underline'] = 4)] = 'Underline'
})(FontStyle || (FontStyle = {}))
class StackElementMetadata {
  static toBinaryStr(metadata) {
    let r = metadata.toString(2)
    while (r.length < 32) {
      r = '0' + r
    }
    return r
  }
  static printMetadata(metadata) {
    let languageId = StackElementMetadata.getLanguageId(metadata)
    let tokenType = StackElementMetadata.getTokenType(metadata)
    let fontStyle = StackElementMetadata.getFontStyle(metadata)
    let foreground = StackElementMetadata.getForeground(metadata)
    let background = StackElementMetadata.getBackground(metadata)
    console.log({
      languageId: languageId,
      tokenType: tokenType,
      fontStyle: fontStyle,
      foreground: foreground,
      background: background
    })
  }
  static getLanguageId(metadata) {
    return (
      (metadata & 255) /* MetadataConsts.LANGUAGEID_MASK */ >>>
      0 /* MetadataConsts.LANGUAGEID_OFFSET */
    )
  }
  static getTokenType(metadata) {
    return (
      (metadata & 1792) /* MetadataConsts.TOKEN_TYPE_MASK */ >>>
      8 /* MetadataConsts.TOKEN_TYPE_OFFSET */
    )
  }
  static getFontStyle(metadata) {
    return (
      (metadata & 14336) /* MetadataConsts.FONT_STYLE_MASK */ >>>
      11 /* MetadataConsts.FONT_STYLE_OFFSET */
    )
  }
  static getForeground(metadata) {
    return (
      (metadata & 8372224) /* MetadataConsts.FOREGROUND_MASK */ >>>
      14 /* MetadataConsts.FOREGROUND_OFFSET */
    )
  }
  static getBackground(metadata) {
    return (
      (metadata & 4286578688) /* MetadataConsts.BACKGROUND_MASK */ >>>
      23 /* MetadataConsts.BACKGROUND_OFFSET */
    )
  }
  static set(metadata, languageId, tokenType, fontStyle, foreground, background) {
    let _languageId = StackElementMetadata.getLanguageId(metadata)
    let _tokenType = StackElementMetadata.getTokenType(metadata)
    let _fontStyle = StackElementMetadata.getFontStyle(metadata)
    let _foreground = StackElementMetadata.getForeground(metadata)
    let _background = StackElementMetadata.getBackground(metadata)
    if (languageId !== 0) {
      _languageId = languageId
    }
    if (tokenType !== 0 /* TemporaryStandardTokenType.Other */) {
      _tokenType =
        tokenType === 8 /* TemporaryStandardTokenType.MetaEmbedded */
          ? 0 /* StandardTokenType.Other */
          : tokenType
    }
    if (fontStyle !== FontStyle.NotSet) {
      _fontStyle = fontStyle
    }
    if (foreground !== 0) {
      _foreground = foreground
    }
    if (background !== 0) {
      _background = background
    }
    return (
      ((_languageId << 0) /* MetadataConsts.LANGUAGEID_OFFSET */ |
        (_tokenType << 8) /* MetadataConsts.TOKEN_TYPE_OFFSET */ |
        (_fontStyle << 11) /* MetadataConsts.FONT_STYLE_OFFSET */ |
        (_foreground << 14) /* MetadataConsts.FOREGROUND_OFFSET */ |
        (_background << 23) /* MetadataConsts.BACKGROUND_OFFSET */) >>>
      0
    )
  }
}

/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
class Resolver {
  constructor(onigLibPromise, onigLibName) {
    this.languagesPath = 'languages/'
    this.languageMap = {}
    this.scopeToLangMap = {}
    this._onigLibPromise = onigLibPromise
    this._onigLibName = onigLibName
  }
  get onigLib() {
    return this._onigLibPromise
  }
  getOnigLibName() {
    return this._onigLibName
  }
  getLangRegistration(langIdOrAlias) {
    return this.languageMap[langIdOrAlias]
  }
  async loadGrammar(scopeName) {
    const lang = this.scopeToLangMap[scopeName]
    if (!lang) {
      return null
    }
    if (lang.grammar) {
      return lang.grammar
    }
    return null
  }
  addLanguage(l) {
    this.languageMap[l.id] = l
    if (l.aliases) {
      l.aliases.forEach(a => {
        this.languageMap[a] = l
      })
    }
    this.scopeToLangMap[l.scopeName] = l
  }
}

var commonjsGlobal =
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
    ? window
    : typeof global !== 'undefined'
    ? global
    : typeof self !== 'undefined'
    ? self
    : {}

var main$1 = { exports: {} }

;(function (module, exports) {
  !(function (e, t) {
    module.exports = t()
  })(commonjsGlobal, function () {
    return (function (e) {
      var t = {}
      function n(r) {
        if (t[r]) return t[r].exports
        var i = (t[r] = { i: r, l: !1, exports: {} })
        return e[r].call(i.exports, i, i.exports, n), (i.l = !0), i.exports
      }
      return (
        (n.m = e),
        (n.c = t),
        (n.d = function (e, t, r) {
          n.o(e, t) || Object.defineProperty(e, t, { enumerable: !0, get: r })
        }),
        (n.r = function (e) {
          'undefined' != typeof Symbol &&
            Symbol.toStringTag &&
            Object.defineProperty(e, Symbol.toStringTag, { value: 'Module' }),
            Object.defineProperty(e, '__esModule', { value: !0 })
        }),
        (n.t = function (e, t) {
          if ((1 & t && (e = n(e)), 8 & t)) return e
          if (4 & t && 'object' == typeof e && e && e.__esModule) return e
          var r = Object.create(null)
          if (
            (n.r(r),
            Object.defineProperty(r, 'default', { enumerable: !0, value: e }),
            2 & t && 'string' != typeof e)
          )
            for (var i in e)
              n.d(
                r,
                i,
                function (t) {
                  return e[t]
                }.bind(null, i)
              )
          return r
        }),
        (n.n = function (e) {
          var t =
            e && e.__esModule
              ? function () {
                  return e.default
                }
              : function () {
                  return e
                }
          return n.d(t, 'a', t), t
        }),
        (n.o = function (e, t) {
          return Object.prototype.hasOwnProperty.call(e, t)
        }),
        (n.p = ''),
        n((n.s = 3))
      )
    })([
      function (e, t, n) {
        Object.defineProperty(t, '__esModule', { value: !0 })
        var r = n(1),
          i = n(5),
          o = n(6),
          s = n(2),
          a =
            'undefined' == typeof performance
              ? function () {
                  return Date.now()
                }
              : function () {
                  return performance.now()
                }
        t.createGrammar = function (e, t, n, r, i, o) {
          return new v(e, t, n, r, i, o)
        }
        var c = function (e) {
          this.scopeName = e
        }
        t.FullScopeDependency = c
        var u = (function () {
          function e(e, t) {
            ;(this.scopeName = e), (this.include = t)
          }
          return (
            (e.prototype.toKey = function () {
              return this.scopeName + '#' + this.include
            }),
            e
          )
        })()
        t.PartialScopeDependency = u
        var l = (function () {
          function e() {
            ;(this.full = []),
              (this.partial = []),
              (this.visitedRule = new Set()),
              (this._seenFull = new Set()),
              (this._seenPartial = new Set())
          }
          return (
            (e.prototype.add = function (e) {
              e instanceof c
                ? this._seenFull.has(e.scopeName) ||
                  (this._seenFull.add(e.scopeName), this.full.push(e))
                : this._seenPartial.has(e.toKey()) ||
                  (this._seenPartial.add(e.toKey()), this.partial.push(e))
            }),
            e
          )
        })()
        function h(e, t, n, i, o) {
          for (var s = 0, a = i; s < a.length; s++) {
            var l = a[s]
            if (!e.visitedRule.has(l)) {
              e.visitedRule.add(l)
              var d = l.repository ? r.mergeObjects({}, o, l.repository) : o
              Array.isArray(l.patterns) && h(e, t, n, l.patterns, d)
              var g = l.include
              if (g)
                if ('$base' === g || g === t.scopeName) f(e, t, t)
                else if ('$self' === g || g === n.scopeName) f(e, t, n)
                else if ('#' === g.charAt(0)) p(e, t, n, g.substring(1), d)
                else {
                  var m = g.indexOf('#')
                  if (m >= 0) {
                    var _ = g.substring(0, m),
                      y = g.substring(m + 1)
                    _ === t.scopeName
                      ? p(e, t, t, y, d)
                      : _ === n.scopeName
                      ? p(e, t, n, y, d)
                      : e.add(new u(_, g.substring(m + 1)))
                  } else e.add(new c(g))
                }
            }
          }
        }
        function p(e, t, n, r, i) {
          ;(void 0 === i && (i = n.repository), i && i[r]) && h(e, t, n, [i[r]], i)
        }
        function f(e, t, n) {
          if (
            (n.patterns && Array.isArray(n.patterns) && h(e, t, n, n.patterns, n.repository),
            n.injections)
          ) {
            var r = []
            for (var i in n.injections) r.push(n.injections[i])
            h(e, t, n, r, n.repository)
          }
        }
        function d(e, t) {
          if (!e) return !1
          if (e === t) return !0
          var n = t.length
          return e.length > n && e.substr(0, n) === t && '.' === e[n]
        }
        function g(e, t) {
          if (t.length < e.length) return !1
          var n = 0
          return e.every(function (e) {
            for (var r = n; r < t.length; r++) if (d(t[r], e)) return (n = r + 1), !0
            return !1
          })
        }
        function m(e, t, n, r, s) {
          for (
            var a = o.createMatchers(t, g),
              c = i.RuleFactory.getCompiledRuleId(n, r, s.repository),
              u = 0,
              l = a;
            u < l.length;
            u++
          ) {
            var h = l[u]
            e.push({ matcher: h.matcher, ruleId: c, grammar: s, priority: h.priority })
          }
        }
        ;(t.ScopeDependencyCollector = l),
          (t.collectSpecificDependencies = p),
          (t.collectDependencies = f)
        var _ = function (e, t, n, r) {
          ;(this.scopeName = e), (this.languageId = t), (this.tokenType = n), (this.themeData = r)
        }
        t.ScopeMetadata = _
        var y = (function () {
            function e(t, n, r) {
              if (
                ((this._initialLanguage = t),
                (this._themeProvider = n),
                (this._cache = new Map()),
                (this._defaultMetaData = new _('', this._initialLanguage, 0, [
                  this._themeProvider.getDefaults()
                ])),
                (this._embeddedLanguages = Object.create(null)),
                r)
              )
                for (var i = Object.keys(r), o = 0, s = i.length; o < s; o++) {
                  var a = i[o],
                    c = r[a]
                  'number' == typeof c && 0 !== c
                    ? (this._embeddedLanguages[a] = c)
                    : console.warn(
                        'Invalid embedded language found at scope ' + a + ': <<' + c + '>>'
                      )
                }
              var u = Object.keys(this._embeddedLanguages).map(function (t) {
                return e._escapeRegExpCharacters(t)
              })
              0 === u.length
                ? (this._embeddedLanguagesRegex = null)
                : (u.sort(),
                  u.reverse(),
                  (this._embeddedLanguagesRegex = new RegExp(
                    '^((' + u.join(')|(') + '))($|\\.)',
                    ''
                  )))
            }
            return (
              (e.prototype.onDidChangeTheme = function () {
                ;(this._cache = new Map()),
                  (this._defaultMetaData = new _('', this._initialLanguage, 0, [
                    this._themeProvider.getDefaults()
                  ]))
              }),
              (e.prototype.getDefaultMetadata = function () {
                return this._defaultMetaData
              }),
              (e._escapeRegExpCharacters = function (e) {
                return e.replace(/[\-\\\{\}\*\+\?\|\^\$\.\,\[\]\(\)\#\s]/g, '\\$&')
              }),
              (e.prototype.getMetadataForScope = function (t) {
                if (null === t) return e._NULL_SCOPE_METADATA
                var n = this._cache.get(t)
                return n || ((n = this._doGetMetadataForScope(t)), this._cache.set(t, n), n)
              }),
              (e.prototype._doGetMetadataForScope = function (e) {
                var t = this._scopeToLanguage(e),
                  n = this._toStandardTokenType(e),
                  r = this._themeProvider.themeMatch(e)
                return new _(e, t, n, r)
              }),
              (e.prototype._scopeToLanguage = function (e) {
                if (!e) return 0
                if (!this._embeddedLanguagesRegex) return 0
                var t = e.match(this._embeddedLanguagesRegex)
                if (!t) return 0
                var n = this._embeddedLanguages[t[1]] || 0
                return n || 0
              }),
              (e.prototype._toStandardTokenType = function (t) {
                var n = t.match(e.STANDARD_TOKEN_TYPE_REGEXP)
                if (!n) return 0
                switch (n[1]) {
                  case 'comment':
                    return 1
                  case 'string':
                    return 2
                  case 'regex':
                    return 4
                  case 'meta.embedded':
                    return 8
                }
                throw new Error('Unexpected match for standard token type!')
              }),
              (e._NULL_SCOPE_METADATA = new _('', 0, 0, null)),
              (e.STANDARD_TOKEN_TYPE_REGEXP = /\b(comment|string|regex|meta\.embedded)\b/),
              e
            )
          })(),
          v = (function () {
            function e(e, t, n, r, i, s) {
              if (
                ((this._scopeMetadataProvider = new y(t, i, n)),
                (this._onigLib = s),
                (this._rootId = -1),
                (this._lastRuleId = 0),
                (this._ruleId2desc = [null]),
                (this._includedGrammars = {}),
                (this._grammarRepository = i),
                (this._grammar = C(e, null)),
                (this._injections = null),
                (this._tokenTypeMatchers = []),
                r)
              )
                for (var a = 0, c = Object.keys(r); a < c.length; a++)
                  for (var u = c[a], l = 0, h = o.createMatchers(u, g); l < h.length; l++) {
                    var p = h[l]
                    this._tokenTypeMatchers.push({ matcher: p.matcher, type: r[u] })
                  }
            }
            return (
              (e.prototype.dispose = function () {
                for (var e = 0, t = this._ruleId2desc; e < t.length; e++) {
                  var n = t[e]
                  n && n.dispose()
                }
              }),
              (e.prototype.createOnigScanner = function (e) {
                return this._onigLib.createOnigScanner(e)
              }),
              (e.prototype.createOnigString = function (e) {
                return this._onigLib.createOnigString(e)
              }),
              (e.prototype.onDidChangeTheme = function () {
                this._scopeMetadataProvider.onDidChangeTheme()
              }),
              (e.prototype.getMetadataForScope = function (e) {
                return this._scopeMetadataProvider.getMetadataForScope(e)
              }),
              (e.prototype.getInjections = function () {
                var e = this
                if (null === this._injections) {
                  this._injections = []
                  var t = this._grammar.injections
                  if (t) for (var n in t) m(this._injections, n, t[n], this, this._grammar)
                  if (this._grammarRepository) {
                    var r = this._grammarRepository.injections(this._grammar.scopeName)
                    r &&
                      r.forEach(function (t) {
                        var n = e.getExternalGrammar(t)
                        if (n) {
                          var r = n.injectionSelector
                          r && m(e._injections, r, n, e, n)
                        }
                      })
                  }
                  this._injections.sort(function (e, t) {
                    return e.priority - t.priority
                  })
                }
                return this._injections
              }),
              (e.prototype.registerRule = function (e) {
                var t = ++this._lastRuleId,
                  n = e(t)
                return (this._ruleId2desc[t] = n), n
              }),
              (e.prototype.getRule = function (e) {
                return this._ruleId2desc[e]
              }),
              (e.prototype.getExternalGrammar = function (e, t) {
                if (this._includedGrammars[e]) return this._includedGrammars[e]
                if (this._grammarRepository) {
                  var n = this._grammarRepository.lookup(e)
                  if (n)
                    return (
                      (this._includedGrammars[e] = C(n, t && t.$base)), this._includedGrammars[e]
                    )
                }
                return null
              }),
              (e.prototype.tokenizeLine = function (e, t) {
                var n = this._tokenize(e, t, !1)
                return {
                  tokens: n.lineTokens.getResult(n.ruleStack, n.lineLength),
                  ruleStack: n.ruleStack
                }
              }),
              (e.prototype.tokenizeLine2 = function (e, t) {
                var n = this._tokenize(e, t, !0)
                return {
                  tokens: n.lineTokens.getBinaryResult(n.ruleStack, n.lineLength),
                  ruleStack: n.ruleStack
                }
              }),
              (e.prototype._tokenize = function (e, t, n) {
                var r
                if (
                  (-1 === this._rootId &&
                    (this._rootId = i.RuleFactory.getCompiledRuleId(
                      this._grammar.repository.$self,
                      this,
                      this._grammar.repository
                    )),
                  t && t !== I.NULL)
                )
                  (r = !1), t.reset()
                else {
                  r = !0
                  var o = this._scopeMetadataProvider.getDefaultMetadata(),
                    s = o.themeData[0],
                    a = P.set(
                      0,
                      o.languageId,
                      o.tokenType,
                      s.fontStyle,
                      s.foreground,
                      s.background
                    ),
                    c = this.getRule(this._rootId).getName(null, null),
                    u = this._scopeMetadataProvider.getMetadataForScope(c),
                    l = x.mergeMetadata(a, null, u),
                    h = new x(null, null === c ? 'unknown' : c, l)
                  t = new I(null, this._rootId, -1, -1, !1, null, h, h)
                }
                e += '\n'
                var p = this.createOnigString(e),
                  f = p.content.length,
                  d = new T(n, e, this._tokenTypeMatchers),
                  g = S(this, p, r, 0, t, d, !0)
                return b(p), { lineLength: f, lineTokens: d, ruleStack: g }
              }),
              e
            )
          })()
        function b(e) {
          'function' == typeof e.dispose && e.dispose()
        }
        function C(e, t) {
          return (
            ((e = r.clone(e)).repository = e.repository || {}),
            (e.repository.$self = {
              $vscodeTextmateLocation: e.$vscodeTextmateLocation,
              patterns: e.patterns,
              name: e.scopeName
            }),
            (e.repository.$base = t || e.repository.$self),
            e
          )
        }
        function w(e, t, n, r, i, o, s) {
          if (0 !== o.length) {
            for (
              var a = t.content, c = Math.min(o.length, s.length), u = [], l = s[0].end, h = 0;
              h < c;
              h++
            ) {
              var p = o[h]
              if (null !== p) {
                var f = s[h]
                if (0 !== f.length) {
                  if (f.start > l) break
                  for (; u.length > 0 && u[u.length - 1].endPos <= f.start; )
                    i.produceFromScopes(u[u.length - 1].scopes, u[u.length - 1].endPos), u.pop()
                  if (
                    (u.length > 0
                      ? i.produceFromScopes(u[u.length - 1].scopes, f.start)
                      : i.produce(r, f.start),
                    p.retokenizeCapturedWithRuleId)
                  ) {
                    var d = p.getName(a, s),
                      g = r.contentNameScopesList.push(e, d),
                      m = p.getContentName(a, s),
                      _ = g.push(e, m),
                      y = r.push(p.retokenizeCapturedWithRuleId, f.start, -1, !1, null, g, _),
                      v = e.createOnigString(a.substring(0, f.end))
                    S(e, v, n && 0 === f.start, f.start, y, i, !1), b(v)
                  } else {
                    var C = p.getName(a, s)
                    if (null !== C) {
                      var w = (
                        u.length > 0 ? u[u.length - 1].scopes : r.contentNameScopesList
                      ).push(e, C)
                      u.push(new A(w, f.end))
                    }
                  }
                }
              }
            }
            for (; u.length > 0; )
              i.produceFromScopes(u[u.length - 1].scopes, u[u.length - 1].endPos), u.pop()
          }
        }
        function k(e) {
          for (var t = [], n = 0, r = e.rules.length; n < r; n++)
            t.push('   - ' + e.rules[n] + ': ' + e.debugRegExps[n])
          return t.join('\n')
        }
        function R(e, t, n, r, i, o) {
          var c = (function (e, t, n, r, i, o) {
              var c = i.getRule(e),
                u = c.compile(e, i.endRule, n, r === o),
                l = 0
              s.DebugFlags.InDebugMode && (l = a())
              var h = u.scanner.findNextMatchSync(t, r)
              if (s.DebugFlags.InDebugMode) {
                var p = a() - l
                p > 5 &&
                  console.warn(
                    'Rule ' +
                      c.debugName +
                      ' (' +
                      c.id +
                      ') matching took ' +
                      p +
                      " against '" +
                      t +
                      "'"
                  ),
                  h &&
                    console.log(
                      'matched rule id: ' +
                        u.rules[h.index] +
                        ' from ' +
                        h.captureIndices[0].start +
                        ' to ' +
                        h.captureIndices[0].end
                    )
              }
              return h
                ? { captureIndices: h.captureIndices, matchedRuleId: u.rules[h.index] }
                : null
            })(e, t, n, r, i, o),
            u = e.getInjections()
          if (0 === u.length) return c
          var l = (function (e, t, n, r, i, o, a) {
            for (
              var c,
                u = Number.MAX_VALUE,
                l = null,
                h = 0,
                p = o.contentNameScopesList.generateScopes(),
                f = 0,
                d = e.length;
              f < d;
              f++
            ) {
              var g = e[f]
              if (g.matcher(p)) {
                var m = t.getRule(g.ruleId).compile(t, null, r, i === a),
                  _ = m.scanner.findNextMatchSync(n, i)
                if (
                  (s.DebugFlags.InDebugMode &&
                    (console.log('  scanning for injections'), console.log(k(m))),
                  _)
                ) {
                  var y = _.captureIndices[0].start
                  if (
                    !(y >= u) &&
                    ((u = y),
                    (l = _.captureIndices),
                    (c = m.rules[_.index]),
                    (h = g.priority),
                    u === i)
                  )
                    break
                }
              }
            }
            return l ? { priorityMatch: -1 === h, captureIndices: l, matchedRuleId: c } : null
          })(u, e, t, n, r, i, o)
          if (!l) return c
          if (!c) return l
          var h = c.captureIndices[0].start,
            p = l.captureIndices[0].start
          return p < h || (l.priorityMatch && p === h) ? l : c
        }
        function S(e, t, n, r, o, a, c) {
          var u = t.content.length,
            l = !1,
            h = -1
          if (c) {
            var p = (function (e, t, n, r, o, a) {
              for (var c = o.beginRuleCapturedEOL ? 0 : -1, u = [], l = o; l; l = l.pop()) {
                var h = l.getRule(e)
                h instanceof i.BeginWhileRule && u.push({ rule: h, stack: l })
              }
              for (var p = u.pop(); p; p = u.pop()) {
                var f = p.rule.compileWhile(e, p.stack.endRule, n, c === r),
                  d = f.scanner.findNextMatchSync(t, r)
                if (
                  (s.DebugFlags.InDebugMode &&
                    (console.log('  scanning for while rule'), console.log(k(f))),
                  !d)
                ) {
                  s.DebugFlags.InDebugMode &&
                    console.log('  popping ' + p.rule.debugName + ' - ' + p.rule.debugWhileRegExp),
                    (o = p.stack.pop())
                  break
                }
                if (-2 !== f.rules[d.index]) {
                  o = p.stack.pop()
                  break
                }
                d.captureIndices &&
                  d.captureIndices.length &&
                  (a.produce(p.stack, d.captureIndices[0].start),
                  w(e, t, n, p.stack, a, p.rule.whileCaptures, d.captureIndices),
                  a.produce(p.stack, d.captureIndices[0].end),
                  (c = d.captureIndices[0].end),
                  d.captureIndices[0].end > r && ((r = d.captureIndices[0].end), (n = !1)))
              }
              return { stack: o, linePos: r, anchorPosition: c, isFirstLine: n }
            })(e, t, n, r, o, a)
            ;(o = p.stack), (r = p.linePos), (n = p.isFirstLine), (h = p.anchorPosition)
          }
          for (; !l; ) f()
          function f() {
            s.DebugFlags.InDebugMode &&
              (console.log(''),
              console.log(
                '@@scanNext ' + r + ': |' + t.content.substr(r).replace(/\n$/, '\\n') + '|'
              ))
            var c = R(e, t, n, r, o, h)
            if (!c)
              return (
                s.DebugFlags.InDebugMode && console.log('  no more matches.'),
                a.produce(o, u),
                void (l = !0)
              )
            var p = c.captureIndices,
              f = c.matchedRuleId,
              d = !!(p && p.length > 0) && p[0].end > r
            if (-1 === f) {
              var g = o.getRule(e)
              s.DebugFlags.InDebugMode &&
                console.log('  popping ' + g.debugName + ' - ' + g.debugEndRegExp),
                a.produce(o, p[0].start),
                (o = o.setContentNameScopesList(o.nameScopesList)),
                w(e, t, n, o, a, g.endCaptures, p),
                a.produce(o, p[0].end)
              var m = o
              if (((o = o.pop()), (h = m.getAnchorPos()), !d && m.getEnterPos() === r))
                return (
                  s.DebugFlags.InDebugMode &&
                    console.error(
                      '[1] - Grammar is in an endless loop - Grammar pushed & popped a rule without advancing'
                    ),
                  (o = m),
                  a.produce(o, u),
                  void (l = !0)
                )
            } else {
              var _ = e.getRule(f)
              a.produce(o, p[0].start)
              var y = o,
                v = _.getName(t.content, p),
                b = o.contentNameScopesList.push(e, v)
              if (
                ((o = o.push(f, r, h, p[0].end === u, null, b, b)), _ instanceof i.BeginEndRule)
              ) {
                var C = _
                s.DebugFlags.InDebugMode &&
                  console.log('  pushing ' + C.debugName + ' - ' + C.debugBeginRegExp),
                  w(e, t, n, o, a, C.beginCaptures, p),
                  a.produce(o, p[0].end),
                  (h = p[0].end)
                var k = C.getContentName(t.content, p),
                  S = b.push(e, k)
                if (
                  ((o = o.setContentNameScopesList(S)),
                  C.endHasBackReferences &&
                    (o = o.setEndRule(C.getEndWithResolvedBackReferences(t.content, p))),
                  !d && y.hasSameRuleAs(o))
                )
                  return (
                    s.DebugFlags.InDebugMode &&
                      console.error(
                        '[2] - Grammar is in an endless loop - Grammar pushed the same rule without advancing'
                      ),
                    (o = o.pop()),
                    a.produce(o, u),
                    void (l = !0)
                  )
              } else if (_ instanceof i.BeginWhileRule) {
                C = _
                s.DebugFlags.InDebugMode && console.log('  pushing ' + C.debugName),
                  w(e, t, n, o, a, C.beginCaptures, p),
                  a.produce(o, p[0].end),
                  (h = p[0].end)
                ;(k = C.getContentName(t.content, p)), (S = b.push(e, k))
                if (
                  ((o = o.setContentNameScopesList(S)),
                  C.whileHasBackReferences &&
                    (o = o.setEndRule(C.getWhileWithResolvedBackReferences(t.content, p))),
                  !d && y.hasSameRuleAs(o))
                )
                  return (
                    s.DebugFlags.InDebugMode &&
                      console.error(
                        '[3] - Grammar is in an endless loop - Grammar pushed the same rule without advancing'
                      ),
                    (o = o.pop()),
                    a.produce(o, u),
                    void (l = !0)
                  )
              } else {
                var P = _
                if (
                  (s.DebugFlags.InDebugMode &&
                    console.log('  matched ' + P.debugName + ' - ' + P.debugMatchRegExp),
                  w(e, t, n, o, a, P.captures, p),
                  a.produce(o, p[0].end),
                  (o = o.pop()),
                  !d)
                )
                  return (
                    s.DebugFlags.InDebugMode &&
                      console.error(
                        '[4] - Grammar is in an endless loop - Grammar is not advancing, nor is it pushing/popping'
                      ),
                    (o = o.safePop()),
                    a.produce(o, u),
                    void (l = !0)
                  )
              }
            }
            p[0].end > r && ((r = p[0].end), (n = !1))
          }
          return o
        }
        t.Grammar = v
        var P = (function () {
          function e() {}
          return (
            (e.toBinaryStr = function (e) {
              for (var t = e.toString(2); t.length < 32; ) t = '0' + t
              return t
            }),
            (e.printMetadata = function (t) {
              var n = e.getLanguageId(t),
                r = e.getTokenType(t),
                i = e.getFontStyle(t),
                o = e.getForeground(t),
                s = e.getBackground(t)
              console.log({
                languageId: n,
                tokenType: r,
                fontStyle: i,
                foreground: o,
                background: s
              })
            }),
            (e.getLanguageId = function (e) {
              return (255 & e) >>> 0
            }),
            (e.getTokenType = function (e) {
              return (1792 & e) >>> 8
            }),
            (e.getFontStyle = function (e) {
              return (14336 & e) >>> 11
            }),
            (e.getForeground = function (e) {
              return (8372224 & e) >>> 14
            }),
            (e.getBackground = function (e) {
              return (4286578688 & e) >>> 23
            }),
            (e.set = function (t, n, r, i, o, s) {
              var a = e.getLanguageId(t),
                c = e.getTokenType(t),
                u = e.getFontStyle(t),
                l = e.getForeground(t),
                h = e.getBackground(t)
              return (
                0 !== n && (a = n),
                0 !== r && (c = 8 === r ? 0 : r),
                -1 !== i && (u = i),
                0 !== o && (l = o),
                0 !== s && (h = s),
                ((a << 0) | (c << 8) | (u << 11) | (l << 14) | (h << 23)) >>> 0
              )
            }),
            e
          )
        })()
        t.StackElementMetadata = P
        var x = (function () {
          function e(e, t, n) {
            ;(this.parent = e), (this.scope = t), (this.metadata = n)
          }
          return (
            (e._equals = function (e, t) {
              for (;;) {
                if (e === t) return !0
                if (!e && !t) return !0
                if (!e || !t) return !1
                if (e.scope !== t.scope || e.metadata !== t.metadata) return !1
                ;(e = e.parent), (t = t.parent)
              }
            }),
            (e.prototype.equals = function (t) {
              return e._equals(this, t)
            }),
            (e._matchesScope = function (e, t, n) {
              return t === e || e.substring(0, n.length) === n
            }),
            (e._matches = function (e, t) {
              if (null === t) return !0
              for (var n = t.length, r = 0, i = t[r], o = i + '.'; e; ) {
                if (this._matchesScope(e.scope, i, o)) {
                  if (++r === n) return !0
                  o = (i = t[r]) + '.'
                }
                e = e.parent
              }
              return !1
            }),
            (e.mergeMetadata = function (e, t, n) {
              if (null === n) return e
              var r = -1,
                i = 0,
                o = 0
              if (null !== n.themeData)
                for (var s = 0, a = n.themeData.length; s < a; s++) {
                  var c = n.themeData[s]
                  if (this._matches(t, c.parentScopes)) {
                    ;(r = c.fontStyle), (i = c.foreground), (o = c.background)
                    break
                  }
                }
              return P.set(e, n.languageId, n.tokenType, r, i, o)
            }),
            (e._push = function (t, n, r) {
              for (var i = 0, o = r.length; i < o; i++) {
                var s = r[i],
                  a = n.getMetadataForScope(s),
                  c = e.mergeMetadata(t.metadata, t, a)
                t = new e(t, s, c)
              }
              return t
            }),
            (e.prototype.push = function (t, n) {
              return null === n
                ? this
                : n.indexOf(' ') >= 0
                ? e._push(this, t, n.split(/ /g))
                : e._push(this, t, [n])
            }),
            (e._generateScopes = function (e) {
              for (var t = [], n = 0; e; ) (t[n++] = e.scope), (e = e.parent)
              return t.reverse(), t
            }),
            (e.prototype.generateScopes = function () {
              return e._generateScopes(this)
            }),
            e
          )
        })()
        t.ScopeListElement = x
        var I = (function () {
          function e(e, t, n, r, i, o, s, a) {
            ;(this.parent = e),
              (this.depth = this.parent ? this.parent.depth + 1 : 1),
              (this.ruleId = t),
              (this._enterPos = n),
              (this._anchorPos = r),
              (this.beginRuleCapturedEOL = i),
              (this.endRule = o),
              (this.nameScopesList = s),
              (this.contentNameScopesList = a)
          }
          return (
            (e._structuralEquals = function (e, t) {
              for (;;) {
                if (e === t) return !0
                if (!e && !t) return !0
                if (!e || !t) return !1
                if (e.depth !== t.depth || e.ruleId !== t.ruleId || e.endRule !== t.endRule)
                  return !1
                ;(e = e.parent), (t = t.parent)
              }
            }),
            (e._equals = function (e, t) {
              return (
                e === t ||
                (!!this._structuralEquals(e, t) &&
                  e.contentNameScopesList.equals(t.contentNameScopesList))
              )
            }),
            (e.prototype.clone = function () {
              return this
            }),
            (e.prototype.equals = function (t) {
              return null !== t && e._equals(this, t)
            }),
            (e._reset = function (e) {
              for (; e; ) (e._enterPos = -1), (e._anchorPos = -1), (e = e.parent)
            }),
            (e.prototype.reset = function () {
              e._reset(this)
            }),
            (e.prototype.pop = function () {
              return this.parent
            }),
            (e.prototype.safePop = function () {
              return this.parent ? this.parent : this
            }),
            (e.prototype.push = function (t, n, r, i, o, s, a) {
              return new e(this, t, n, r, i, o, s, a)
            }),
            (e.prototype.getEnterPos = function () {
              return this._enterPos
            }),
            (e.prototype.getAnchorPos = function () {
              return this._anchorPos
            }),
            (e.prototype.getRule = function (e) {
              return e.getRule(this.ruleId)
            }),
            (e.prototype._writeString = function (e, t) {
              return (
                this.parent && (t = this.parent._writeString(e, t)),
                (e[t++] =
                  '(' +
                  this.ruleId +
                  ', TODO-' +
                  this.nameScopesList +
                  ', TODO-' +
                  this.contentNameScopesList +
                  ')'),
                t
              )
            }),
            (e.prototype.toString = function () {
              var e = []
              return this._writeString(e, 0), '[' + e.join(',') + ']'
            }),
            (e.prototype.setContentNameScopesList = function (e) {
              return this.contentNameScopesList === e
                ? this
                : this.parent.push(
                    this.ruleId,
                    this._enterPos,
                    this._anchorPos,
                    this.beginRuleCapturedEOL,
                    this.endRule,
                    this.nameScopesList,
                    e
                  )
            }),
            (e.prototype.setEndRule = function (t) {
              return this.endRule === t
                ? this
                : new e(
                    this.parent,
                    this.ruleId,
                    this._enterPos,
                    this._anchorPos,
                    this.beginRuleCapturedEOL,
                    t,
                    this.nameScopesList,
                    this.contentNameScopesList
                  )
            }),
            (e.prototype.hasSameRuleAs = function (e) {
              return this.ruleId === e.ruleId
            }),
            (e.NULL = new e(null, 0, 0, 0, !1, null, null, null)),
            e
          )
        })()
        t.StackElement = I
        var A = function (e, t) {
          ;(this.scopes = e), (this.endPos = t)
        }
        t.LocalStackElement = A
        var T = (function () {
          function e(e, t, n) {
            ;(this._emitBinaryTokens = e),
              (this._tokenTypeOverrides = n),
              s.DebugFlags.InDebugMode ? (this._lineText = t) : (this._lineText = null),
              (this._tokens = []),
              (this._binaryTokens = []),
              (this._lastTokenEndIndex = 0)
          }
          return (
            (e.prototype.produce = function (e, t) {
              this.produceFromScopes(e.contentNameScopesList, t)
            }),
            (e.prototype.produceFromScopes = function (e, t) {
              if (!(this._lastTokenEndIndex >= t)) {
                if (this._emitBinaryTokens) {
                  for (var n = e.metadata, r = 0, i = this._tokenTypeOverrides; r < i.length; r++) {
                    var o = i[r]
                    o.matcher(e.generateScopes()) && (n = P.set(n, 0, L(o.type), -1, 0, 0))
                  }
                  return (
                    (this._binaryTokens.length > 0 &&
                      this._binaryTokens[this._binaryTokens.length - 1] === n) ||
                      (this._binaryTokens.push(this._lastTokenEndIndex),
                      this._binaryTokens.push(n)),
                    void (this._lastTokenEndIndex = t)
                  )
                }
                var a = e.generateScopes()
                if (s.DebugFlags.InDebugMode) {
                  console.log(
                    '  token: |' +
                      this._lineText.substring(this._lastTokenEndIndex, t).replace(/\n$/, '\\n') +
                      '|'
                  )
                  for (var c = 0; c < a.length; c++) console.log('      * ' + a[c])
                }
                this._tokens.push({ startIndex: this._lastTokenEndIndex, endIndex: t, scopes: a }),
                  (this._lastTokenEndIndex = t)
              }
            }),
            (e.prototype.getResult = function (e, t) {
              return (
                this._tokens.length > 0 &&
                  this._tokens[this._tokens.length - 1].startIndex === t - 1 &&
                  this._tokens.pop(),
                0 === this._tokens.length &&
                  ((this._lastTokenEndIndex = -1),
                  this.produce(e, t),
                  (this._tokens[this._tokens.length - 1].startIndex = 0)),
                this._tokens
              )
            }),
            (e.prototype.getBinaryResult = function (e, t) {
              this._binaryTokens.length > 0 &&
                this._binaryTokens[this._binaryTokens.length - 2] === t - 1 &&
                (this._binaryTokens.pop(), this._binaryTokens.pop()),
                0 === this._binaryTokens.length &&
                  ((this._lastTokenEndIndex = -1),
                  this.produce(e, t),
                  (this._binaryTokens[this._binaryTokens.length - 2] = 0))
              for (
                var n = new Uint32Array(this._binaryTokens.length),
                  r = 0,
                  i = this._binaryTokens.length;
                r < i;
                r++
              )
                n[r] = this._binaryTokens[r]
              return n
            }),
            e
          )
        })()
        function L(e) {
          switch (e) {
            case 4:
              return 4
            case 2:
              return 2
            case 1:
              return 1
            case 0:
            default:
              return 8
          }
        }
      },
      function (e, t, n) {
        function r(e) {
          return Array.isArray(e)
            ? (function (e) {
                for (var t = [], n = 0, i = e.length; n < i; n++) t[n] = r(e[n])
                return t
              })(e)
            : 'object' == typeof e
            ? (function (e) {
                var t = {}
                for (var n in e) t[n] = r(e[n])
                return t
              })(e)
            : e
        }
        Object.defineProperty(t, '__esModule', { value: !0 }),
          (t.clone = function (e) {
            return r(e)
          }),
          (t.mergeObjects = function (e) {
            for (var t = [], n = 1; n < arguments.length; n++) t[n - 1] = arguments[n]
            return (
              t.forEach(function (t) {
                for (var n in t) e[n] = t[n]
              }),
              e
            )
          }),
          (t.basename = function e(t) {
            var n = ~t.lastIndexOf('/') || ~t.lastIndexOf('\\')
            return 0 === n
              ? t
              : ~n == t.length - 1
              ? e(t.substring(0, t.length - 1))
              : t.substr(1 + ~n)
          })
        var i = /\$(\d+)|\${(\d+):\/(downcase|upcase)}/,
          o = (function () {
            function e() {}
            return (
              (e.hasCaptures = function (e) {
                return null !== e && i.test(e)
              }),
              (e.replaceCaptures = function (e, t, n) {
                return e.replace(i, function (e, r, i, o) {
                  var s = n[parseInt(r || i, 10)]
                  if (!s) return e
                  for (var a = t.substring(s.start, s.end); '.' === a[0]; ) a = a.substring(1)
                  switch (o) {
                    case 'downcase':
                      return a.toLowerCase()
                    case 'upcase':
                      return a.toUpperCase()
                    default:
                      return a
                  }
                })
              }),
              e
            )
          })()
        t.RegexSource = o
      },
      function (e, t, n) {
        ;(function (e) {
          Object.defineProperty(t, '__esModule', { value: !0 }),
            (t.DebugFlags = { InDebugMode: void 0 !== e && !!e.env.VSCODE_TEXTMATE_DEBUG })
        }.call(this, n(7)))
      },
      function (e, t, n) {
        var r =
            (this && this.__awaiter) ||
            function (e, t, n, r) {
              return new (n || (n = Promise))(function (i, o) {
                function s(e) {
                  try {
                    c(r.next(e))
                  } catch (e) {
                    o(e)
                  }
                }
                function a(e) {
                  try {
                    c(r.throw(e))
                  } catch (e) {
                    o(e)
                  }
                }
                function c(e) {
                  var t
                  e.done
                    ? i(e.value)
                    : ((t = e.value),
                      t instanceof n
                        ? t
                        : new n(function (e) {
                            e(t)
                          })).then(s, a)
                }
                c((r = r.apply(e, t || [])).next())
              })
            },
          i =
            (this && this.__generator) ||
            function (e, t) {
              var n,
                r,
                i,
                o,
                s = {
                  label: 0,
                  sent: function () {
                    if (1 & i[0]) throw i[1]
                    return i[1]
                  },
                  trys: [],
                  ops: []
                }
              return (
                (o = { next: a(0), throw: a(1), return: a(2) }),
                'function' == typeof Symbol &&
                  (o[Symbol.iterator] = function () {
                    return this
                  }),
                o
              )
              function a(o) {
                return function (a) {
                  return (function (o) {
                    if (n) throw new TypeError('Generator is already executing.')
                    for (; s; )
                      try {
                        if (
                          ((n = 1),
                          r &&
                            (i =
                              2 & o[0]
                                ? r.return
                                : o[0]
                                ? r.throw || ((i = r.return) && i.call(r), 0)
                                : r.next) &&
                            !(i = i.call(r, o[1])).done)
                        )
                          return i
                        switch (((r = 0), i && (o = [2 & o[0], i.value]), o[0])) {
                          case 0:
                          case 1:
                            i = o
                            break
                          case 4:
                            return s.label++, { value: o[1], done: !1 }
                          case 5:
                            s.label++, (r = o[1]), (o = [0])
                            continue
                          case 7:
                            ;(o = s.ops.pop()), s.trys.pop()
                            continue
                          default:
                            if (
                              !((i = s.trys),
                              (i = i.length > 0 && i[i.length - 1]) || (6 !== o[0] && 2 !== o[0]))
                            ) {
                              s = 0
                              continue
                            }
                            if (3 === o[0] && (!i || (o[1] > i[0] && o[1] < i[3]))) {
                              s.label = o[1]
                              break
                            }
                            if (6 === o[0] && s.label < i[1]) {
                              ;(s.label = i[1]), (i = o)
                              break
                            }
                            if (i && s.label < i[2]) {
                              ;(s.label = i[2]), s.ops.push(o)
                              break
                            }
                            i[2] && s.ops.pop(), s.trys.pop()
                            continue
                        }
                        o = t.call(e, s)
                      } catch (e) {
                        ;(o = [6, e]), (r = 0)
                      } finally {
                        n = i = 0
                      }
                    if (5 & o[0]) throw o[1]
                    return { value: o[0] ? o[1] : void 0, done: !0 }
                  })([o, a])
                }
              }
            }
        Object.defineProperty(t, '__esModule', { value: !0 })
        var o = n(4),
          s = n(8),
          a = n(11),
          c = n(0),
          u = (function () {
            function e(e) {
              ;(this._options = e),
                (this._syncRegistry = new o.SyncRegistry(
                  a.Theme.createFromRawTheme(e.theme, e.colorMap),
                  e.onigLib
                )),
                (this._ensureGrammarCache = new Map())
            }
            return (
              (e.prototype.dispose = function () {
                this._syncRegistry.dispose()
              }),
              (e.prototype.setTheme = function (e, t) {
                this._syncRegistry.setTheme(a.Theme.createFromRawTheme(e, t))
              }),
              (e.prototype.getColorMap = function () {
                return this._syncRegistry.getColorMap()
              }),
              (e.prototype.loadGrammarWithEmbeddedLanguages = function (e, t, n) {
                return this.loadGrammarWithConfiguration(e, t, { embeddedLanguages: n })
              }),
              (e.prototype.loadGrammarWithConfiguration = function (e, t, n) {
                return this._loadGrammar(e, t, n.embeddedLanguages, n.tokenTypes)
              }),
              (e.prototype.loadGrammar = function (e) {
                return this._loadGrammar(e, 0, null, null)
              }),
              (e.prototype._doLoadSingleGrammar = function (e) {
                return r(this, void 0, void 0, function () {
                  var t, n
                  return i(this, function (r) {
                    switch (r.label) {
                      case 0:
                        return [4, this._options.loadGrammar(e)]
                      case 1:
                        return (
                          (t = r.sent()) &&
                            ((n =
                              'function' == typeof this._options.getInjections
                                ? this._options.getInjections(e)
                                : void 0),
                            this._syncRegistry.addGrammar(t, n)),
                          [2]
                        )
                    }
                  })
                })
              }),
              (e.prototype._loadSingleGrammar = function (e) {
                return r(this, void 0, void 0, function () {
                  return i(this, function (t) {
                    return (
                      this._ensureGrammarCache.has(e) ||
                        this._ensureGrammarCache.set(e, this._doLoadSingleGrammar(e)),
                      [2, this._ensureGrammarCache.get(e)]
                    )
                  })
                })
              }),
              (e.prototype._collectDependenciesForDep = function (e, t, n) {
                var r = this._syncRegistry.lookup(n.scopeName)
                if (r) {
                  n instanceof c.FullScopeDependency
                    ? c.collectDependencies(t, this._syncRegistry.lookup(e), r)
                    : c.collectSpecificDependencies(t, this._syncRegistry.lookup(e), r, n.include)
                  var i = this._syncRegistry.injections(n.scopeName)
                  if (i)
                    for (var o = 0, s = i; o < s.length; o++) {
                      var a = s[o]
                      t.add(new c.FullScopeDependency(a))
                    }
                } else if (n.scopeName === e) throw new Error('No grammar provided for <' + e + '>')
              }),
              (e.prototype._loadGrammar = function (e, t, n, o) {
                return r(this, void 0, void 0, function () {
                  var r,
                    s,
                    a,
                    u,
                    l,
                    h,
                    p,
                    f,
                    d,
                    g,
                    m,
                    _,
                    y = this
                  return i(this, function (i) {
                    switch (i.label) {
                      case 0:
                        ;(r = new Set()),
                          (s = new Set()),
                          r.add(e),
                          (a = [new c.FullScopeDependency(e)]),
                          (i.label = 1)
                      case 1:
                        return a.length > 0
                          ? ((u = a),
                            (a = []),
                            [
                              4,
                              Promise.all(
                                u.map(function (e) {
                                  return y._loadSingleGrammar(e.scopeName)
                                })
                              )
                            ])
                          : [3, 3]
                      case 2:
                        for (
                          i.sent(), l = new c.ScopeDependencyCollector(), h = 0, p = u;
                          h < p.length;
                          h++
                        )
                          (_ = p[h]), this._collectDependenciesForDep(e, l, _)
                        for (f = 0, d = l.full; f < d.length; f++)
                          (_ = d[f]), r.has(_.scopeName) || (r.add(_.scopeName), a.push(_))
                        for (g = 0, m = l.partial; g < m.length; g++)
                          (_ = m[g]),
                            r.has(_.scopeName) || s.has(_.toKey()) || (s.add(_.toKey()), a.push(_))
                        return [3, 1]
                      case 3:
                        return [2, this.grammarForScopeName(e, t, n, o)]
                    }
                  })
                })
              }),
              (e.prototype.addGrammar = function (e, t, n, o) {
                return (
                  void 0 === t && (t = []),
                  void 0 === n && (n = 0),
                  void 0 === o && (o = null),
                  r(this, void 0, void 0, function () {
                    return i(this, function (r) {
                      switch (r.label) {
                        case 0:
                          return (
                            this._syncRegistry.addGrammar(e, t),
                            [4, this.grammarForScopeName(e.scopeName, n, o)]
                          )
                        case 1:
                          return [2, r.sent()]
                      }
                    })
                  })
                )
              }),
              (e.prototype.grammarForScopeName = function (e, t, n, r) {
                return (
                  void 0 === t && (t = 0),
                  void 0 === n && (n = null),
                  void 0 === r && (r = null),
                  this._syncRegistry.grammarForScopeName(e, t, n, r)
                )
              }),
              e
            )
          })()
        ;(t.Registry = u),
          (t.INITIAL = c.StackElement.NULL),
          (t.parseRawGrammar = s.parseRawGrammar)
      },
      function (e, t, n) {
        var r =
            (this && this.__awaiter) ||
            function (e, t, n, r) {
              return new (n || (n = Promise))(function (i, o) {
                function s(e) {
                  try {
                    c(r.next(e))
                  } catch (e) {
                    o(e)
                  }
                }
                function a(e) {
                  try {
                    c(r.throw(e))
                  } catch (e) {
                    o(e)
                  }
                }
                function c(e) {
                  var t
                  e.done
                    ? i(e.value)
                    : ((t = e.value),
                      t instanceof n
                        ? t
                        : new n(function (e) {
                            e(t)
                          })).then(s, a)
                }
                c((r = r.apply(e, t || [])).next())
              })
            },
          i =
            (this && this.__generator) ||
            function (e, t) {
              var n,
                r,
                i,
                o,
                s = {
                  label: 0,
                  sent: function () {
                    if (1 & i[0]) throw i[1]
                    return i[1]
                  },
                  trys: [],
                  ops: []
                }
              return (
                (o = { next: a(0), throw: a(1), return: a(2) }),
                'function' == typeof Symbol &&
                  (o[Symbol.iterator] = function () {
                    return this
                  }),
                o
              )
              function a(o) {
                return function (a) {
                  return (function (o) {
                    if (n) throw new TypeError('Generator is already executing.')
                    for (; s; )
                      try {
                        if (
                          ((n = 1),
                          r &&
                            (i =
                              2 & o[0]
                                ? r.return
                                : o[0]
                                ? r.throw || ((i = r.return) && i.call(r), 0)
                                : r.next) &&
                            !(i = i.call(r, o[1])).done)
                        )
                          return i
                        switch (((r = 0), i && (o = [2 & o[0], i.value]), o[0])) {
                          case 0:
                          case 1:
                            i = o
                            break
                          case 4:
                            return s.label++, { value: o[1], done: !1 }
                          case 5:
                            s.label++, (r = o[1]), (o = [0])
                            continue
                          case 7:
                            ;(o = s.ops.pop()), s.trys.pop()
                            continue
                          default:
                            if (
                              !((i = s.trys),
                              (i = i.length > 0 && i[i.length - 1]) || (6 !== o[0] && 2 !== o[0]))
                            ) {
                              s = 0
                              continue
                            }
                            if (3 === o[0] && (!i || (o[1] > i[0] && o[1] < i[3]))) {
                              s.label = o[1]
                              break
                            }
                            if (6 === o[0] && s.label < i[1]) {
                              ;(s.label = i[1]), (i = o)
                              break
                            }
                            if (i && s.label < i[2]) {
                              ;(s.label = i[2]), s.ops.push(o)
                              break
                            }
                            i[2] && s.ops.pop(), s.trys.pop()
                            continue
                        }
                        o = t.call(e, s)
                      } catch (e) {
                        ;(o = [6, e]), (r = 0)
                      } finally {
                        n = i = 0
                      }
                    if (5 & o[0]) throw o[1]
                    return { value: o[0] ? o[1] : void 0, done: !0 }
                  })([o, a])
                }
              }
            }
        Object.defineProperty(t, '__esModule', { value: !0 })
        var o = n(0),
          s = (function () {
            function e(e, t) {
              ;(this._theme = e),
                (this._grammars = {}),
                (this._rawGrammars = {}),
                (this._injectionGrammars = {}),
                (this._onigLibPromise = t)
            }
            return (
              (e.prototype.dispose = function () {
                for (var e in this._grammars)
                  this._grammars.hasOwnProperty(e) && this._grammars[e].dispose()
              }),
              (e.prototype.setTheme = function (e) {
                var t = this
                ;(this._theme = e),
                  Object.keys(this._grammars).forEach(function (e) {
                    t._grammars[e].onDidChangeTheme()
                  })
              }),
              (e.prototype.getColorMap = function () {
                return this._theme.getColorMap()
              }),
              (e.prototype.addGrammar = function (e, t) {
                ;(this._rawGrammars[e.scopeName] = e),
                  t && (this._injectionGrammars[e.scopeName] = t)
              }),
              (e.prototype.lookup = function (e) {
                return this._rawGrammars[e]
              }),
              (e.prototype.injections = function (e) {
                return this._injectionGrammars[e]
              }),
              (e.prototype.getDefaults = function () {
                return this._theme.getDefaults()
              }),
              (e.prototype.themeMatch = function (e) {
                return this._theme.match(e)
              }),
              (e.prototype.grammarForScopeName = function (e, t, n, s) {
                return r(this, void 0, void 0, function () {
                  var r, a, c, u, l
                  return i(this, function (i) {
                    switch (i.label) {
                      case 0:
                        return this._grammars[e]
                          ? [3, 2]
                          : (r = this._rawGrammars[e])
                          ? ((a = this._grammars),
                            (c = e),
                            (u = o.createGrammar),
                            (l = [r, t, n, s, this]),
                            [4, this._onigLibPromise])
                          : [2, null]
                      case 1:
                        ;(a[c] = u.apply(void 0, l.concat([i.sent()]))), (i.label = 2)
                      case 2:
                        return [2, this._grammars[e]]
                    }
                  })
                })
              }),
              e
            )
          })()
        t.SyncRegistry = s
      },
      function (e, t, n) {
        var r,
          i =
            (this && this.__extends) ||
            ((r = function (e, t) {
              return (r =
                Object.setPrototypeOf ||
                ({ __proto__: [] } instanceof Array &&
                  function (e, t) {
                    e.__proto__ = t
                  }) ||
                function (e, t) {
                  for (var n in t) t.hasOwnProperty(n) && (e[n] = t[n])
                })(e, t)
            }),
            function (e, t) {
              function n() {
                this.constructor = e
              }
              r(e, t),
                (e.prototype =
                  null === t ? Object.create(t) : ((n.prototype = t.prototype), new n()))
            })
        Object.defineProperty(t, '__esModule', { value: !0 })
        var o = n(1),
          s = /\\(\d+)/,
          a = /\\(\d+)/g,
          c = (function () {
            function e(e, t, n) {
              ;(this.debugRegExps = t), (this.rules = n), (this.scanner = e.createOnigScanner(t))
            }
            return (
              (e.prototype.dispose = function () {
                'function' == typeof this.scanner.dispose && this.scanner.dispose()
              }),
              e
            )
          })()
        t.CompiledRule = c
        var u = (function () {
          function e(e, t, n, r) {
            ;(this.$location = e),
              (this.id = t),
              (this._name = n || null),
              (this._nameIsCapturing = o.RegexSource.hasCaptures(this._name)),
              (this._contentName = r || null),
              (this._contentNameIsCapturing = o.RegexSource.hasCaptures(this._contentName))
          }
          return (
            Object.defineProperty(e.prototype, 'debugName', {
              get: function () {
                var e = this.$location
                  ? o.basename(this.$location.filename) + ':' + this.$location.line
                  : 'unknown'
                return this.constructor.name + '#' + this.id + ' @ ' + e
              },
              enumerable: !0,
              configurable: !0
            }),
            (e.prototype.getName = function (e, t) {
              return this._nameIsCapturing && null !== this._name && null !== e && null !== t
                ? o.RegexSource.replaceCaptures(this._name, e, t)
                : this._name
            }),
            (e.prototype.getContentName = function (e, t) {
              return this._contentNameIsCapturing && null !== this._contentName
                ? o.RegexSource.replaceCaptures(this._contentName, e, t)
                : this._contentName
            }),
            e
          )
        })()
        t.Rule = u
        var l = (function (e) {
          function t(t, n, r, i, o) {
            var s = e.call(this, t, n, r, i) || this
            return (s.retokenizeCapturedWithRuleId = o), s
          }
          return (
            i(t, e),
            (t.prototype.dispose = function () {}),
            (t.prototype.collectPatternsRecursive = function (e, t, n) {
              throw new Error('Not supported!')
            }),
            (t.prototype.compile = function (e, t, n, r) {
              throw new Error('Not supported!')
            }),
            t
          )
        })(u)
        t.CaptureRule = l
        var h = (function () {
          function e(e, t, n) {
            if ((void 0 === n && (n = !0), n))
              if (e) {
                for (var r = e.length, i = 0, o = [], a = !1, c = 0; c < r; c++) {
                  if ('\\' === e.charAt(c) && c + 1 < r) {
                    var u = e.charAt(c + 1)
                    'z' === u
                      ? (o.push(e.substring(i, c)), o.push('$(?!\\n)(?<!\\n)'), (i = c + 2))
                      : ('A' !== u && 'G' !== u) || (a = !0),
                      c++
                  }
                }
                ;(this.hasAnchor = a),
                  0 === i
                    ? (this.source = e)
                    : (o.push(e.substring(i, r)), (this.source = o.join('')))
              } else (this.hasAnchor = !1), (this.source = e)
            else (this.hasAnchor = !1), (this.source = e)
            this.hasAnchor
              ? (this._anchorCache = this._buildAnchorCache())
              : (this._anchorCache = null),
              (this.ruleId = t),
              (this.hasBackReferences = s.test(this.source))
          }
          return (
            (e.prototype.clone = function () {
              return new e(this.source, this.ruleId, !0)
            }),
            (e.prototype.setSource = function (e) {
              this.source !== e &&
                ((this.source = e),
                this.hasAnchor && (this._anchorCache = this._buildAnchorCache()))
            }),
            (e.prototype.resolveBackReferences = function (e, t) {
              var n = t.map(function (t) {
                return e.substring(t.start, t.end)
              })
              return (
                (a.lastIndex = 0),
                this.source.replace(a, function (e, t) {
                  return (n[parseInt(t, 10)] || '').replace(
                    /[\-\\\{\}\*\+\?\|\^\$\.\,\[\]\(\)\#\s]/g,
                    '\\$&'
                  )
                })
              )
            }),
            (e.prototype._buildAnchorCache = function () {
              var e,
                t,
                n,
                r,
                i = [],
                o = [],
                s = [],
                a = []
              for (e = 0, t = this.source.length; e < t; e++)
                (n = this.source.charAt(e)),
                  (i[e] = n),
                  (o[e] = n),
                  (s[e] = n),
                  (a[e] = n),
                  '\\' === n &&
                    e + 1 < t &&
                    ('A' === (r = this.source.charAt(e + 1))
                      ? ((i[e + 1] = '￿'), (o[e + 1] = '￿'), (s[e + 1] = 'A'), (a[e + 1] = 'A'))
                      : 'G' === r
                      ? ((i[e + 1] = '￿'), (o[e + 1] = 'G'), (s[e + 1] = '￿'), (a[e + 1] = 'G'))
                      : ((i[e + 1] = r), (o[e + 1] = r), (s[e + 1] = r), (a[e + 1] = r)),
                    e++)
              return { A0_G0: i.join(''), A0_G1: o.join(''), A1_G0: s.join(''), A1_G1: a.join('') }
            }),
            (e.prototype.resolveAnchors = function (e, t) {
              return this.hasAnchor && this._anchorCache
                ? e
                  ? t
                    ? this._anchorCache.A1_G1
                    : this._anchorCache.A1_G0
                  : t
                  ? this._anchorCache.A0_G1
                  : this._anchorCache.A0_G0
                : this.source
            }),
            e
          )
        })()
        t.RegExpSource = h
        var p = (function () {
          function e() {
            ;(this._items = []),
              (this._hasAnchors = !1),
              (this._cached = null),
              (this._anchorCache = { A0_G0: null, A0_G1: null, A1_G0: null, A1_G1: null })
          }
          return (
            (e.prototype.dispose = function () {
              this._disposeCaches()
            }),
            (e.prototype._disposeCaches = function () {
              this._cached && (this._cached.dispose(), (this._cached = null)),
                this._anchorCache.A0_G0 &&
                  (this._anchorCache.A0_G0.dispose(), (this._anchorCache.A0_G0 = null)),
                this._anchorCache.A0_G1 &&
                  (this._anchorCache.A0_G1.dispose(), (this._anchorCache.A0_G1 = null)),
                this._anchorCache.A1_G0 &&
                  (this._anchorCache.A1_G0.dispose(), (this._anchorCache.A1_G0 = null)),
                this._anchorCache.A1_G1 &&
                  (this._anchorCache.A1_G1.dispose(), (this._anchorCache.A1_G1 = null))
            }),
            (e.prototype.push = function (e) {
              this._items.push(e), (this._hasAnchors = this._hasAnchors || e.hasAnchor)
            }),
            (e.prototype.unshift = function (e) {
              this._items.unshift(e), (this._hasAnchors = this._hasAnchors || e.hasAnchor)
            }),
            (e.prototype.length = function () {
              return this._items.length
            }),
            (e.prototype.setSource = function (e, t) {
              this._items[e].source !== t && (this._disposeCaches(), this._items[e].setSource(t))
            }),
            (e.prototype.compile = function (e, t, n) {
              if (this._hasAnchors)
                return t
                  ? n
                    ? (this._anchorCache.A1_G1 ||
                        (this._anchorCache.A1_G1 = this._resolveAnchors(e, t, n)),
                      this._anchorCache.A1_G1)
                    : (this._anchorCache.A1_G0 ||
                        (this._anchorCache.A1_G0 = this._resolveAnchors(e, t, n)),
                      this._anchorCache.A1_G0)
                  : n
                  ? (this._anchorCache.A0_G1 ||
                      (this._anchorCache.A0_G1 = this._resolveAnchors(e, t, n)),
                    this._anchorCache.A0_G1)
                  : (this._anchorCache.A0_G0 ||
                      (this._anchorCache.A0_G0 = this._resolveAnchors(e, t, n)),
                    this._anchorCache.A0_G0)
              if (!this._cached) {
                var r = this._items.map(function (e) {
                  return e.source
                })
                this._cached = new c(
                  e,
                  r,
                  this._items.map(function (e) {
                    return e.ruleId
                  })
                )
              }
              return this._cached
            }),
            (e.prototype._resolveAnchors = function (e, t, n) {
              var r = this._items.map(function (e) {
                return e.resolveAnchors(t, n)
              })
              return new c(
                e,
                r,
                this._items.map(function (e) {
                  return e.ruleId
                })
              )
            }),
            e
          )
        })()
        t.RegExpSourceList = p
        var f = (function (e) {
          function t(t, n, r, i, o) {
            var s = e.call(this, t, n, r, null) || this
            return (
              (s._match = new h(i, s.id)), (s.captures = o), (s._cachedCompiledPatterns = null), s
            )
          }
          return (
            i(t, e),
            (t.prototype.dispose = function () {
              this._cachedCompiledPatterns &&
                (this._cachedCompiledPatterns.dispose(), (this._cachedCompiledPatterns = null))
            }),
            Object.defineProperty(t.prototype, 'debugMatchRegExp', {
              get: function () {
                return '' + this._match.source
              },
              enumerable: !0,
              configurable: !0
            }),
            (t.prototype.collectPatternsRecursive = function (e, t, n) {
              t.push(this._match)
            }),
            (t.prototype.compile = function (e, t, n, r) {
              return (
                this._cachedCompiledPatterns ||
                  ((this._cachedCompiledPatterns = new p()),
                  this.collectPatternsRecursive(e, this._cachedCompiledPatterns, !0)),
                this._cachedCompiledPatterns.compile(e, n, r)
              )
            }),
            t
          )
        })(u)
        t.MatchRule = f
        var d = (function (e) {
          function t(t, n, r, i, o) {
            var s = e.call(this, t, n, r, i) || this
            return (
              (s.patterns = o.patterns),
              (s.hasMissingPatterns = o.hasMissingPatterns),
              (s._cachedCompiledPatterns = null),
              s
            )
          }
          return (
            i(t, e),
            (t.prototype.dispose = function () {
              this._cachedCompiledPatterns &&
                (this._cachedCompiledPatterns.dispose(), (this._cachedCompiledPatterns = null))
            }),
            (t.prototype.collectPatternsRecursive = function (e, t, n) {
              var r, i
              for (r = 0, i = this.patterns.length; r < i; r++)
                e.getRule(this.patterns[r]).collectPatternsRecursive(e, t, !1)
            }),
            (t.prototype.compile = function (e, t, n, r) {
              return (
                this._cachedCompiledPatterns ||
                  ((this._cachedCompiledPatterns = new p()),
                  this.collectPatternsRecursive(e, this._cachedCompiledPatterns, !0)),
                this._cachedCompiledPatterns.compile(e, n, r)
              )
            }),
            t
          )
        })(u)
        t.IncludeOnlyRule = d
        var g = (function (e) {
          function t(t, n, r, i, o, s, a, c, u, l) {
            var p = e.call(this, t, n, r, i) || this
            return (
              (p._begin = new h(o, p.id)),
              (p.beginCaptures = s),
              (p._end = new h(a || '￿', -1)),
              (p.endHasBackReferences = p._end.hasBackReferences),
              (p.endCaptures = c),
              (p.applyEndPatternLast = u || !1),
              (p.patterns = l.patterns),
              (p.hasMissingPatterns = l.hasMissingPatterns),
              (p._cachedCompiledPatterns = null),
              p
            )
          }
          return (
            i(t, e),
            (t.prototype.dispose = function () {
              this._cachedCompiledPatterns &&
                (this._cachedCompiledPatterns.dispose(), (this._cachedCompiledPatterns = null))
            }),
            Object.defineProperty(t.prototype, 'debugBeginRegExp', {
              get: function () {
                return '' + this._begin.source
              },
              enumerable: !0,
              configurable: !0
            }),
            Object.defineProperty(t.prototype, 'debugEndRegExp', {
              get: function () {
                return '' + this._end.source
              },
              enumerable: !0,
              configurable: !0
            }),
            (t.prototype.getEndWithResolvedBackReferences = function (e, t) {
              return this._end.resolveBackReferences(e, t)
            }),
            (t.prototype.collectPatternsRecursive = function (e, t, n) {
              if (n) {
                var r,
                  i = void 0
                for (i = 0, r = this.patterns.length; i < r; i++)
                  e.getRule(this.patterns[i]).collectPatternsRecursive(e, t, !1)
              } else t.push(this._begin)
            }),
            (t.prototype.compile = function (e, t, n, r) {
              return (
                this._cachedCompiledPatterns ||
                  ((this._cachedCompiledPatterns = new p()),
                  this.collectPatternsRecursive(e, this._cachedCompiledPatterns, !0),
                  this.applyEndPatternLast
                    ? this._cachedCompiledPatterns.push(
                        this._end.hasBackReferences ? this._end.clone() : this._end
                      )
                    : this._cachedCompiledPatterns.unshift(
                        this._end.hasBackReferences ? this._end.clone() : this._end
                      )),
                this._end.hasBackReferences &&
                  (this.applyEndPatternLast
                    ? this._cachedCompiledPatterns.setSource(
                        this._cachedCompiledPatterns.length() - 1,
                        t
                      )
                    : this._cachedCompiledPatterns.setSource(0, t)),
                this._cachedCompiledPatterns.compile(e, n, r)
              )
            }),
            t
          )
        })(u)
        t.BeginEndRule = g
        var m = (function (e) {
          function t(t, n, r, i, o, s, a, c, u) {
            var l = e.call(this, t, n, r, i) || this
            return (
              (l._begin = new h(o, l.id)),
              (l.beginCaptures = s),
              (l.whileCaptures = c),
              (l._while = new h(a, -2)),
              (l.whileHasBackReferences = l._while.hasBackReferences),
              (l.patterns = u.patterns),
              (l.hasMissingPatterns = u.hasMissingPatterns),
              (l._cachedCompiledPatterns = null),
              (l._cachedCompiledWhilePatterns = null),
              l
            )
          }
          return (
            i(t, e),
            (t.prototype.dispose = function () {
              this._cachedCompiledPatterns &&
                (this._cachedCompiledPatterns.dispose(), (this._cachedCompiledPatterns = null)),
                this._cachedCompiledWhilePatterns &&
                  (this._cachedCompiledWhilePatterns.dispose(),
                  (this._cachedCompiledWhilePatterns = null))
            }),
            Object.defineProperty(t.prototype, 'debugBeginRegExp', {
              get: function () {
                return '' + this._begin.source
              },
              enumerable: !0,
              configurable: !0
            }),
            Object.defineProperty(t.prototype, 'debugWhileRegExp', {
              get: function () {
                return '' + this._while.source
              },
              enumerable: !0,
              configurable: !0
            }),
            (t.prototype.getWhileWithResolvedBackReferences = function (e, t) {
              return this._while.resolveBackReferences(e, t)
            }),
            (t.prototype.collectPatternsRecursive = function (e, t, n) {
              if (n) {
                var r,
                  i = void 0
                for (i = 0, r = this.patterns.length; i < r; i++)
                  e.getRule(this.patterns[i]).collectPatternsRecursive(e, t, !1)
              } else t.push(this._begin)
            }),
            (t.prototype.compile = function (e, t, n, r) {
              return (
                this._cachedCompiledPatterns ||
                  ((this._cachedCompiledPatterns = new p()),
                  this.collectPatternsRecursive(e, this._cachedCompiledPatterns, !0)),
                this._cachedCompiledPatterns.compile(e, n, r)
              )
            }),
            (t.prototype.compileWhile = function (e, t, n, r) {
              return (
                this._cachedCompiledWhilePatterns ||
                  ((this._cachedCompiledWhilePatterns = new p()),
                  this._cachedCompiledWhilePatterns.push(
                    this._while.hasBackReferences ? this._while.clone() : this._while
                  )),
                this._while.hasBackReferences &&
                  this._cachedCompiledWhilePatterns.setSource(0, t || '￿'),
                this._cachedCompiledWhilePatterns.compile(e, n, r)
              )
            }),
            t
          )
        })(u)
        t.BeginWhileRule = m
        var _ = (function () {
          function e() {}
          return (
            (e.createCaptureRule = function (e, t, n, r, i) {
              return e.registerRule(function (e) {
                return new l(t, e, n, r, i)
              })
            }),
            (e.getCompiledRuleId = function (t, n, r) {
              return (
                t.id ||
                  n.registerRule(function (i) {
                    if (((t.id = i), t.match))
                      return new f(
                        t.$vscodeTextmateLocation,
                        t.id,
                        t.name,
                        t.match,
                        e._compileCaptures(t.captures, n, r)
                      )
                    if (void 0 === t.begin) {
                      t.repository && (r = o.mergeObjects({}, r, t.repository))
                      var s = t.patterns
                      return (
                        void 0 === s && t.include && (s = [{ include: t.include }]),
                        new d(
                          t.$vscodeTextmateLocation,
                          t.id,
                          t.name,
                          t.contentName,
                          e._compilePatterns(s, n, r)
                        )
                      )
                    }
                    return t.while
                      ? new m(
                          t.$vscodeTextmateLocation,
                          t.id,
                          t.name,
                          t.contentName,
                          t.begin,
                          e._compileCaptures(t.beginCaptures || t.captures, n, r),
                          t.while,
                          e._compileCaptures(t.whileCaptures || t.captures, n, r),
                          e._compilePatterns(t.patterns, n, r)
                        )
                      : new g(
                          t.$vscodeTextmateLocation,
                          t.id,
                          t.name,
                          t.contentName,
                          t.begin,
                          e._compileCaptures(t.beginCaptures || t.captures, n, r),
                          t.end,
                          e._compileCaptures(t.endCaptures || t.captures, n, r),
                          t.applyEndPatternLast,
                          e._compilePatterns(t.patterns, n, r)
                        )
                  }),
                t.id
              )
            }),
            (e._compileCaptures = function (t, n, r) {
              var i = []
              if (t) {
                var o = 0
                for (var s in t) {
                  if ('$vscodeTextmateLocation' !== s) (c = parseInt(s, 10)) > o && (o = c)
                }
                for (var a = 0; a <= o; a++) i[a] = null
                for (var s in t)
                  if ('$vscodeTextmateLocation' !== s) {
                    var c = parseInt(s, 10),
                      u = 0
                    t[s].patterns && (u = e.getCompiledRuleId(t[s], n, r)),
                      (i[c] = e.createCaptureRule(
                        n,
                        t[s].$vscodeTextmateLocation,
                        t[s].name,
                        t[s].contentName,
                        u
                      ))
                  }
              }
              return i
            }),
            (e._compilePatterns = function (t, n, r) {
              var i = []
              if (t)
                for (var o = 0, s = t.length; o < s; o++) {
                  var a = t[o],
                    c = -1
                  if (a.include)
                    if ('#' === a.include.charAt(0)) {
                      var u = r[a.include.substr(1)]
                      u && (c = e.getCompiledRuleId(u, n, r))
                    } else if ('$base' === a.include || '$self' === a.include)
                      c = e.getCompiledRuleId(r[a.include], n, r)
                    else {
                      var l = null,
                        h = null,
                        p = a.include.indexOf('#')
                      p >= 0
                        ? ((l = a.include.substring(0, p)), (h = a.include.substring(p + 1)))
                        : (l = a.include)
                      var f = n.getExternalGrammar(l, r)
                      if (f)
                        if (h) {
                          var _ = f.repository[h]
                          _ && (c = e.getCompiledRuleId(_, n, f.repository))
                        } else c = e.getCompiledRuleId(f.repository.$self, n, f.repository)
                    }
                  else c = e.getCompiledRuleId(a, n, r)
                  if (-1 !== c) {
                    var y = n.getRule(c),
                      v = !1
                    if (
                      ((y instanceof d || y instanceof g || y instanceof m) &&
                        y.hasMissingPatterns &&
                        0 === y.patterns.length &&
                        (v = !0),
                      v)
                    )
                      continue
                    i.push(c)
                  }
                }
              return { patterns: i, hasMissingPatterns: (t ? t.length : 0) !== i.length }
            }),
            e
          )
        })()
        t.RuleFactory = _
      },
      function (e, t, n) {
        function r(e) {
          return !!e && !!e.match(/[\w\.:]+/)
        }
        Object.defineProperty(t, '__esModule', { value: !0 }),
          (t.createMatchers = function (e, t) {
            for (
              var n,
                i,
                o,
                s = [],
                a =
                  ((o = (i = /([LR]:|[\w\.:][\w\.:\-]*|[\,\|\-\(\)])/g).exec((n = e))),
                  {
                    next: function () {
                      if (!o) return null
                      var e = o[0]
                      return (o = i.exec(n)), e
                    }
                  }),
                c = a.next();
              null !== c;

            ) {
              var u = 0
              if (2 === c.length && ':' === c.charAt(1)) {
                switch (c.charAt(0)) {
                  case 'R':
                    u = 1
                    break
                  case 'L':
                    u = -1
                    break
                  default:
                    console.log('Unknown priority ' + c + ' in scope selector')
                }
                c = a.next()
              }
              var l = p()
              if ((s.push({ matcher: l, priority: u }), ',' !== c)) break
              c = a.next()
            }
            return s
            function h() {
              if ('-' === c) {
                c = a.next()
                var e = h()
                return function (t) {
                  return !!e && !e(t)
                }
              }
              if ('(' === c) {
                c = a.next()
                var n = (function () {
                  var e = [],
                    t = p()
                  for (; t && (e.push(t), '|' === c || ',' === c); ) {
                    do {
                      c = a.next()
                    } while ('|' === c || ',' === c)
                    t = p()
                  }
                  return function (t) {
                    return e.some(function (e) {
                      return e(t)
                    })
                  }
                })()
                return ')' === c && (c = a.next()), n
              }
              if (r(c)) {
                var i = []
                do {
                  i.push(c), (c = a.next())
                } while (r(c))
                return function (e) {
                  return t(i, e)
                }
              }
              return null
            }
            function p() {
              for (var e = [], t = h(); t; ) e.push(t), (t = h())
              return function (t) {
                return e.every(function (e) {
                  return e(t)
                })
              }
            }
          })
      },
      function (e, t) {
        var n,
          r,
          i = (e.exports = {})
        function o() {
          throw new Error('setTimeout has not been defined')
        }
        function s() {
          throw new Error('clearTimeout has not been defined')
        }
        function a(e) {
          if (n === setTimeout) return setTimeout(e, 0)
          if ((n === o || !n) && setTimeout) return (n = setTimeout), setTimeout(e, 0)
          try {
            return n(e, 0)
          } catch (t) {
            try {
              return n.call(null, e, 0)
            } catch (t) {
              return n.call(this, e, 0)
            }
          }
        }
        !(function () {
          try {
            n = 'function' == typeof setTimeout ? setTimeout : o
          } catch (e) {
            n = o
          }
          try {
            r = 'function' == typeof clearTimeout ? clearTimeout : s
          } catch (e) {
            r = s
          }
        })()
        var c,
          u = [],
          l = !1,
          h = -1
        function p() {
          l && c && ((l = !1), c.length ? (u = c.concat(u)) : (h = -1), u.length && f())
        }
        function f() {
          if (!l) {
            var e = a(p)
            l = !0
            for (var t = u.length; t; ) {
              for (c = u, u = []; ++h < t; ) c && c[h].run()
              ;(h = -1), (t = u.length)
            }
            ;(c = null),
              (l = !1),
              (function (e) {
                if (r === clearTimeout) return clearTimeout(e)
                if ((r === s || !r) && clearTimeout) return (r = clearTimeout), clearTimeout(e)
                try {
                  r(e)
                } catch (t) {
                  try {
                    return r.call(null, e)
                  } catch (t) {
                    return r.call(this, e)
                  }
                }
              })(e)
          }
        }
        function d(e, t) {
          ;(this.fun = e), (this.array = t)
        }
        function g() {}
        ;(i.nextTick = function (e) {
          var t = new Array(arguments.length - 1)
          if (arguments.length > 1)
            for (var n = 1; n < arguments.length; n++) t[n - 1] = arguments[n]
          u.push(new d(e, t)), 1 !== u.length || l || a(f)
        }),
          (d.prototype.run = function () {
            this.fun.apply(null, this.array)
          }),
          (i.title = 'browser'),
          (i.browser = !0),
          (i.env = {}),
          (i.argv = []),
          (i.version = ''),
          (i.versions = {}),
          (i.on = g),
          (i.addListener = g),
          (i.once = g),
          (i.off = g),
          (i.removeListener = g),
          (i.removeAllListeners = g),
          (i.emit = g),
          (i.prependListener = g),
          (i.prependOnceListener = g),
          (i.listeners = function (e) {
            return []
          }),
          (i.binding = function (e) {
            throw new Error('process.binding is not supported')
          }),
          (i.cwd = function () {
            return '/'
          }),
          (i.chdir = function (e) {
            throw new Error('process.chdir is not supported')
          }),
          (i.umask = function () {
            return 0
          })
      },
      function (e, t, n) {
        Object.defineProperty(t, '__esModule', { value: !0 })
        var r = n(9),
          i = n(2),
          o = n(10)
        t.parseRawGrammar = function (e, t) {
          return (
            void 0 === t && (t = null),
            null !== t && /\.json$/.test(t)
              ? (function (e, t) {
                  if (i.DebugFlags.InDebugMode) return o.parse(e, t, !0)
                  return JSON.parse(e)
                })(e, t)
              : (function (e, t) {
                  if (i.DebugFlags.InDebugMode)
                    return r.parseWithLocation(e, t, '$vscodeTextmateLocation')
                  return r.parse(e)
                })(e, t)
          )
        }
      },
      function (e, t, n) {
        function r(e, t, n) {
          var r = e.length,
            i = 0,
            o = 1,
            s = 0
          function a(t) {
            if (null === n) i += t
            else
              for (; t > 0; ) {
                10 === e.charCodeAt(i) ? (i++, o++, (s = 0)) : (i++, s++), t--
              }
          }
          function c(e) {
            null === n ? (i = e) : a(e - i)
          }
          function u() {
            for (; i < r; ) {
              var t = e.charCodeAt(i)
              if (32 !== t && 9 !== t && 13 !== t && 10 !== t) break
              a(1)
            }
          }
          function l(t) {
            return e.substr(i, t.length) === t && (a(t.length), !0)
          }
          function h(t) {
            var n = e.indexOf(t, i)
            c(-1 !== n ? n + t.length : r)
          }
          function p(t) {
            var n = e.indexOf(t, i)
            if (-1 !== n) {
              var o = e.substring(i, n)
              return c(n + t.length), o
            }
            o = e.substr(i)
            return c(r), o
          }
          r > 0 && 65279 === e.charCodeAt(0) && (i = 1)
          var f = 0,
            d = null,
            g = [],
            m = [],
            _ = null
          function y(e, t) {
            g.push(f), m.push(d), (f = e), (d = t)
          }
          function v() {
            if (0 === g.length) return b('illegal state stack')
            ;(f = g.pop()), (d = m.pop())
          }
          function b(t) {
            throw new Error('Near offset ' + i + ': ' + t + ' ~~~' + e.substr(i, 50) + '~~~')
          }
          var C,
            w,
            k,
            R = function () {
              if (null === _) return b('missing <key>')
              var e = {}
              null !== n && (e[n] = { filename: t, line: o, char: s }),
                (d[_] = e),
                (_ = null),
                y(1, e)
            },
            S = function () {
              if (null === _) return b('missing <key>')
              var e = []
              ;(d[_] = e), (_ = null), y(2, e)
            },
            P = function () {
              var e = {}
              null !== n && (e[n] = { filename: t, line: o, char: s }), d.push(e), y(1, e)
            },
            x = function () {
              var e = []
              d.push(e), y(2, e)
            }
          function I() {
            if (1 !== f) return b('unexpected </dict>')
            v()
          }
          function A() {
            return 1 === f || 2 !== f ? b('unexpected </array>') : void v()
          }
          function T(e) {
            if (1 === f) {
              if (null === _) return b('missing <key>')
              ;(d[_] = e), (_ = null)
            } else 2 === f ? d.push(e) : (d = e)
          }
          function L(e) {
            if (isNaN(e)) return b('cannot parse float')
            if (1 === f) {
              if (null === _) return b('missing <key>')
              ;(d[_] = e), (_ = null)
            } else 2 === f ? d.push(e) : (d = e)
          }
          function M(e) {
            if (isNaN(e)) return b('cannot parse integer')
            if (1 === f) {
              if (null === _) return b('missing <key>')
              ;(d[_] = e), (_ = null)
            } else 2 === f ? d.push(e) : (d = e)
          }
          function G(e) {
            if (1 === f) {
              if (null === _) return b('missing <key>')
              ;(d[_] = e), (_ = null)
            } else 2 === f ? d.push(e) : (d = e)
          }
          function D(e) {
            if (1 === f) {
              if (null === _) return b('missing <key>')
              ;(d[_] = e), (_ = null)
            } else 2 === f ? d.push(e) : (d = e)
          }
          function N(e) {
            if (1 === f) {
              if (null === _) return b('missing <key>')
              ;(d[_] = e), (_ = null)
            } else 2 === f ? d.push(e) : (d = e)
          }
          function E(e) {
            if (e.isClosed) return ''
            var t = p('</')
            return (
              h('>'),
              t
                .replace(/&#([0-9]+);/g, function (e, t) {
                  return String.fromCodePoint(parseInt(t, 10))
                })
                .replace(/&#x([0-9a-f]+);/g, function (e, t) {
                  return String.fromCodePoint(parseInt(t, 16))
                })
                .replace(/&amp;|&lt;|&gt;|&quot;|&apos;/g, function (e) {
                  switch (e) {
                    case '&amp;':
                      return '&'
                    case '&lt;':
                      return '<'
                    case '&gt;':
                      return '>'
                    case '&quot;':
                      return '"'
                    case '&apos;':
                      return "'"
                  }
                  return e
                })
            )
          }
          for (; i < r && (u(), !(i >= r)); ) {
            var O = e.charCodeAt(i)
            if ((a(1), 60 !== O)) return b('expected <')
            if (i >= r) return b('unexpected end of input')
            var j = e.charCodeAt(i)
            if (63 !== j)
              if (33 !== j) {
                if (47 === j) {
                  if ((a(1), u(), l('plist'))) {
                    h('>')
                    continue
                  }
                  if (l('dict')) {
                    h('>'), I()
                    continue
                  }
                  if (l('array')) {
                    h('>'), A()
                    continue
                  }
                  return b('unexpected closed tag')
                }
                var F =
                  ((w = void 0),
                  (k = void 0),
                  (w = p('>')),
                  (k = !1),
                  47 === w.charCodeAt(w.length - 1) &&
                    ((k = !0), (w = w.substring(0, w.length - 1))),
                  { name: w.trim(), isClosed: k })
                switch (F.name) {
                  case 'dict':
                    1 === f
                      ? R()
                      : 2 === f
                      ? P()
                      : ((d = {}),
                        null !== n && (d[n] = { filename: t, line: o, char: s }),
                        y(1, d)),
                      F.isClosed && I()
                    continue
                  case 'array':
                    1 === f ? S() : 2 === f ? x() : y(2, (d = [])), F.isClosed && A()
                    continue
                  case 'key':
                    ;(C = E(F)),
                      1 !== f ? b('unexpected <key>') : null !== _ ? b('too many <key>') : (_ = C)
                    continue
                  case 'string':
                    T(E(F))
                    continue
                  case 'real':
                    L(parseFloat(E(F)))
                    continue
                  case 'integer':
                    M(parseInt(E(F), 10))
                    continue
                  case 'date':
                    G(new Date(E(F)))
                    continue
                  case 'data':
                    D(E(F))
                    continue
                  case 'true':
                    E(F), N(!0)
                    continue
                  case 'false':
                    E(F), N(!1)
                    continue
                }
                if (!/^plist/.test(F.name)) return b('unexpected opened tag ' + F.name)
              } else {
                if ((a(1), l('--'))) {
                  h('--\x3e')
                  continue
                }
                h('>')
              }
            else a(1), h('?>')
          }
          return d
        }
        Object.defineProperty(t, '__esModule', { value: !0 }),
          (t.parseWithLocation = function (e, t, n) {
            return r(e, t, n)
          }),
          (t.parse = function (e) {
            return r(e, null, null)
          })
      },
      function (e, t, n) {
        function r(e, t) {
          throw new Error(
            'Near offset ' + e.pos + ': ' + t + ' ~~~' + e.source.substr(e.pos, 50) + '~~~'
          )
        }
        Object.defineProperty(t, '__esModule', { value: !0 }),
          (t.parse = function (e, t, n) {
            var a = new i(e),
              c = new o(),
              u = 0,
              l = null,
              h = [],
              p = []
            function f() {
              h.push(u), p.push(l)
            }
            function d() {
              ;(u = h.pop()), (l = p.pop())
            }
            function g(e) {
              r(a, e)
            }
            for (; s(a, c); ) {
              if (0 === u) {
                if ((null !== l && g('too many constructs in root'), 3 === c.type)) {
                  ;(l = {}), n && (l.$vscodeTextmateLocation = c.toLocation(t)), f(), (u = 1)
                  continue
                }
                if (2 === c.type) {
                  ;(l = []), f(), (u = 4)
                  continue
                }
                g('unexpected token in root')
              }
              if (2 === u) {
                if (5 === c.type) {
                  d()
                  continue
                }
                if (7 === c.type) {
                  u = 3
                  continue
                }
                g('expected , or }')
              }
              if (1 === u || 3 === u) {
                if (1 === u && 5 === c.type) {
                  d()
                  continue
                }
                if (1 === c.type) {
                  var m = c.value
                  if (
                    ((s(a, c) && 6 === c.type) || g('expected colon'),
                    s(a, c) || g('expected value'),
                    (u = 2),
                    1 === c.type)
                  ) {
                    l[m] = c.value
                    continue
                  }
                  if (8 === c.type) {
                    l[m] = null
                    continue
                  }
                  if (9 === c.type) {
                    l[m] = !0
                    continue
                  }
                  if (10 === c.type) {
                    l[m] = !1
                    continue
                  }
                  if (11 === c.type) {
                    l[m] = parseFloat(c.value)
                    continue
                  }
                  if (2 === c.type) {
                    var _ = []
                    ;(l[m] = _), f(), (u = 4), (l = _)
                    continue
                  }
                  if (3 === c.type) {
                    var y = {}
                    n && (y.$vscodeTextmateLocation = c.toLocation(t)),
                      (l[m] = y),
                      f(),
                      (u = 1),
                      (l = y)
                    continue
                  }
                }
                g('unexpected token in dict')
              }
              if (5 === u) {
                if (4 === c.type) {
                  d()
                  continue
                }
                if (7 === c.type) {
                  u = 6
                  continue
                }
                g('expected , or ]')
              }
              if (4 === u || 6 === u) {
                if (4 === u && 4 === c.type) {
                  d()
                  continue
                }
                if (((u = 5), 1 === c.type)) {
                  l.push(c.value)
                  continue
                }
                if (8 === c.type) {
                  l.push(null)
                  continue
                }
                if (9 === c.type) {
                  l.push(!0)
                  continue
                }
                if (10 === c.type) {
                  l.push(!1)
                  continue
                }
                if (11 === c.type) {
                  l.push(parseFloat(c.value))
                  continue
                }
                if (2 === c.type) {
                  _ = []
                  l.push(_), f(), (u = 4), (l = _)
                  continue
                }
                if (3 === c.type) {
                  y = {}
                  n && (y.$vscodeTextmateLocation = c.toLocation(t)),
                    l.push(y),
                    f(),
                    (u = 1),
                    (l = y)
                  continue
                }
                g('unexpected token in array')
              }
              g('unknown state')
            }
            return 0 !== p.length && g('unclosed constructs'), l
          })
        var i = function (e) {
            ;(this.source = e),
              (this.pos = 0),
              (this.len = e.length),
              (this.line = 1),
              (this.char = 0)
          },
          o = (function () {
            function e() {
              ;(this.value = null),
                (this.type = 0),
                (this.offset = -1),
                (this.len = -1),
                (this.line = -1),
                (this.char = -1)
            }
            return (
              (e.prototype.toLocation = function (e) {
                return { filename: e, line: this.line, char: this.char }
              }),
              e
            )
          })()
        function s(e, t) {
          ;(t.value = null),
            (t.type = 0),
            (t.offset = -1),
            (t.len = -1),
            (t.line = -1),
            (t.char = -1)
          for (var n, i = e.source, o = e.pos, s = e.len, a = e.line, c = e.char; ; ) {
            if (o >= s) return !1
            if (32 !== (n = i.charCodeAt(o)) && 9 !== n && 13 !== n) {
              if (10 !== n) break
              o++, a++, (c = 0)
            } else o++, c++
          }
          if (((t.offset = o), (t.line = a), (t.char = c), 34 === n)) {
            for (t.type = 1, o++, c++; ; ) {
              if (o >= s) return !1
              if (((n = i.charCodeAt(o)), o++, c++, 92 !== n)) {
                if (34 === n) break
              } else o++, c++
            }
            t.value = i
              .substring(t.offset + 1, o - 1)
              .replace(/\\u([0-9A-Fa-f]{4})/g, function (e, t) {
                return String.fromCodePoint(parseInt(t, 16))
              })
              .replace(/\\(.)/g, function (t, n) {
                switch (n) {
                  case '"':
                    return '"'
                  case '\\':
                    return '\\'
                  case '/':
                    return '/'
                  case 'b':
                    return '\b'
                  case 'f':
                    return '\f'
                  case 'n':
                    return '\n'
                  case 'r':
                    return '\r'
                  case 't':
                    return '\t'
                  default:
                    r(e, 'invalid escape sequence')
                }
                throw new Error('unreachable')
              })
          } else if (91 === n) (t.type = 2), o++, c++
          else if (123 === n) (t.type = 3), o++, c++
          else if (93 === n) (t.type = 4), o++, c++
          else if (125 === n) (t.type = 5), o++, c++
          else if (58 === n) (t.type = 6), o++, c++
          else if (44 === n) (t.type = 7), o++, c++
          else if (110 === n) {
            if (((t.type = 8), o++, c++, 117 !== (n = i.charCodeAt(o)))) return !1
            if ((o++, c++, 108 !== (n = i.charCodeAt(o)))) return !1
            if ((o++, c++, 108 !== (n = i.charCodeAt(o)))) return !1
            o++, c++
          } else if (116 === n) {
            if (((t.type = 9), o++, c++, 114 !== (n = i.charCodeAt(o)))) return !1
            if ((o++, c++, 117 !== (n = i.charCodeAt(o)))) return !1
            if ((o++, c++, 101 !== (n = i.charCodeAt(o)))) return !1
            o++, c++
          } else if (102 === n) {
            if (((t.type = 10), o++, c++, 97 !== (n = i.charCodeAt(o)))) return !1
            if ((o++, c++, 108 !== (n = i.charCodeAt(o)))) return !1
            if ((o++, c++, 115 !== (n = i.charCodeAt(o)))) return !1
            if ((o++, c++, 101 !== (n = i.charCodeAt(o)))) return !1
            o++, c++
          } else
            for (t.type = 11; ; ) {
              if (o >= s) return !1
              if (
                !(
                  46 === (n = i.charCodeAt(o)) ||
                  (n >= 48 && n <= 57) ||
                  101 === n ||
                  69 === n ||
                  45 === n ||
                  43 === n
                )
              )
                break
              o++, c++
            }
          return (
            (t.len = o - t.offset),
            null === t.value && (t.value = i.substr(t.offset, t.len)),
            (e.pos = o),
            (e.line = a),
            (e.char = c),
            !0
          )
        }
      },
      function (e, t, n) {
        Object.defineProperty(t, '__esModule', { value: !0 })
        var r = function (e, t, n, r, i, o) {
          ;(this.scope = e),
            (this.parentScopes = t),
            (this.index = n),
            (this.fontStyle = r),
            (this.foreground = i),
            (this.background = o)
        }
        function i(e) {
          return (
            !!/^#[0-9a-f]{6}$/i.test(e) ||
            !!/^#[0-9a-f]{8}$/i.test(e) ||
            !!/^#[0-9a-f]{3}$/i.test(e) ||
            !!/^#[0-9a-f]{4}$/i.test(e)
          )
        }
        function o(e) {
          if (!e) return []
          if (!e.settings || !Array.isArray(e.settings)) return []
          for (var t = e.settings, n = [], o = 0, s = 0, a = t.length; s < a; s++) {
            var c = t[s]
            if (c.settings) {
              var u = void 0
              if ('string' == typeof c.scope)
                u = c.scope.replace(/^[,]+/, '').replace(/[,]+$/, '').split(',')
              else u = Array.isArray(c.scope) ? c.scope : ['']
              var l = -1
              if ('string' == typeof c.settings.fontStyle) {
                l = 0
                for (var h = 0, p = (g = c.settings.fontStyle.split(' ')).length; h < p; h++) {
                  switch (g[h]) {
                    case 'italic':
                      l |= 1
                      break
                    case 'bold':
                      l |= 2
                      break
                    case 'underline':
                      l |= 4
                  }
                }
              }
              var f = null
              'string' == typeof c.settings.foreground &&
                i(c.settings.foreground) &&
                (f = c.settings.foreground)
              var d = null
              'string' == typeof c.settings.background &&
                i(c.settings.background) &&
                (d = c.settings.background)
              for (h = 0, p = u.length; h < p; h++) {
                var g,
                  m = (g = u[h].trim().split(' '))[g.length - 1],
                  _ = null
                g.length > 1 && (_ = g.slice(0, g.length - 1)).reverse(),
                  (n[o++] = new r(m, _, s, l, f, d))
              }
            }
          }
          return n
        }
        function s(e, t) {
          e.sort(function (e, t) {
            var n = u(e.scope, t.scope)
            return 0 !== n || 0 !== (n = l(e.parentScopes, t.parentScopes)) ? n : e.index - t.index
          })
          for (var n = 0, r = '#000000', i = '#ffffff'; e.length >= 1 && '' === e[0].scope; ) {
            var o = e.shift()
            ;-1 !== o.fontStyle && (n = o.fontStyle),
              null !== o.foreground && (r = o.foreground),
              null !== o.background && (i = o.background)
          }
          for (
            var s = new a(t),
              f = new h(0, null, n, s.getId(r), s.getId(i)),
              d = new p(new h(0, null, -1, 0, 0), []),
              g = 0,
              m = e.length;
            g < m;
            g++
          ) {
            var _ = e[g]
            d.insert(
              0,
              _.scope,
              _.parentScopes,
              _.fontStyle,
              s.getId(_.foreground),
              s.getId(_.background)
            )
          }
          return new c(s, f, d)
        }
        ;(t.ParsedThemeRule = r), (t.parseTheme = o)
        var a = (function () {
          function e(e) {
            if (
              ((this._lastColorId = 0),
              (this._id2color = []),
              (this._color2id = Object.create(null)),
              Array.isArray(e))
            ) {
              this._isFrozen = !0
              for (var t = 0, n = e.length; t < n; t++)
                (this._color2id[e[t]] = t), (this._id2color[t] = e[t])
            } else this._isFrozen = !1
          }
          return (
            (e.prototype.getId = function (e) {
              if (null === e) return 0
              e = e.toUpperCase()
              var t = this._color2id[e]
              if (t) return t
              if (this._isFrozen) throw new Error('Missing color in color map - ' + e)
              return (t = ++this._lastColorId), (this._color2id[e] = t), (this._id2color[t] = e), t
            }),
            (e.prototype.getColorMap = function () {
              return this._id2color.slice(0)
            }),
            e
          )
        })()
        t.ColorMap = a
        var c = (function () {
          function e(e, t, n) {
            ;(this._colorMap = e), (this._root = n), (this._defaults = t), (this._cache = {})
          }
          return (
            (e.createFromRawTheme = function (e, t) {
              return this.createFromParsedTheme(o(e), t)
            }),
            (e.createFromParsedTheme = function (e, t) {
              return s(e, t)
            }),
            (e.prototype.getColorMap = function () {
              return this._colorMap.getColorMap()
            }),
            (e.prototype.getDefaults = function () {
              return this._defaults
            }),
            (e.prototype.match = function (e) {
              return (
                this._cache.hasOwnProperty(e) || (this._cache[e] = this._root.match(e)),
                this._cache[e]
              )
            }),
            e
          )
        })()
        function u(e, t) {
          return e < t ? -1 : e > t ? 1 : 0
        }
        function l(e, t) {
          if (null === e && null === t) return 0
          if (!e) return -1
          if (!t) return 1
          var n = e.length,
            r = t.length
          if (n === r) {
            for (var i = 0; i < n; i++) {
              var o = u(e[i], t[i])
              if (0 !== o) return o
            }
            return 0
          }
          return n - r
        }
        ;(t.Theme = c), (t.strcmp = u), (t.strArrCmp = l)
        var h = (function () {
          function e(e, t, n, r, i) {
            ;(this.scopeDepth = e),
              (this.parentScopes = t),
              (this.fontStyle = n),
              (this.foreground = r),
              (this.background = i)
          }
          return (
            (e.prototype.clone = function () {
              return new e(
                this.scopeDepth,
                this.parentScopes,
                this.fontStyle,
                this.foreground,
                this.background
              )
            }),
            (e.cloneArr = function (e) {
              for (var t = [], n = 0, r = e.length; n < r; n++) t[n] = e[n].clone()
              return t
            }),
            (e.prototype.acceptOverwrite = function (e, t, n, r) {
              this.scopeDepth > e ? console.log('how did this happen?') : (this.scopeDepth = e),
                -1 !== t && (this.fontStyle = t),
                0 !== n && (this.foreground = n),
                0 !== r && (this.background = r)
            }),
            e
          )
        })()
        t.ThemeTrieElementRule = h
        var p = (function () {
          function e(e, t, n) {
            void 0 === t && (t = []),
              void 0 === n && (n = {}),
              (this._mainRule = e),
              (this._rulesWithParentScopes = t),
              (this._children = n)
          }
          return (
            (e._sortBySpecificity = function (e) {
              return 1 === e.length || e.sort(this._cmpBySpecificity), e
            }),
            (e._cmpBySpecificity = function (e, t) {
              if (e.scopeDepth === t.scopeDepth) {
                var n = e.parentScopes,
                  r = t.parentScopes,
                  i = null === n ? 0 : n.length,
                  o = null === r ? 0 : r.length
                if (i === o)
                  for (var s = 0; s < i; s++) {
                    var a = n[s].length,
                      c = r[s].length
                    if (a !== c) return c - a
                  }
                return o - i
              }
              return t.scopeDepth - e.scopeDepth
            }),
            (e.prototype.match = function (t) {
              if ('' === t)
                return e._sortBySpecificity(
                  [].concat(this._mainRule).concat(this._rulesWithParentScopes)
                )
              var n,
                r,
                i = t.indexOf('.')
              return (
                -1 === i
                  ? ((n = t), (r = ''))
                  : ((n = t.substring(0, i)), (r = t.substring(i + 1))),
                this._children.hasOwnProperty(n)
                  ? this._children[n].match(r)
                  : e._sortBySpecificity(
                      [].concat(this._mainRule).concat(this._rulesWithParentScopes)
                    )
              )
            }),
            (e.prototype.insert = function (t, n, r, i, o, s) {
              if ('' !== n) {
                var a,
                  c,
                  u,
                  l = n.indexOf('.')
                ;-1 === l
                  ? ((a = n), (c = ''))
                  : ((a = n.substring(0, l)), (c = n.substring(l + 1))),
                  this._children.hasOwnProperty(a)
                    ? (u = this._children[a])
                    : ((u = new e(this._mainRule.clone(), h.cloneArr(this._rulesWithParentScopes))),
                      (this._children[a] = u)),
                  u.insert(t + 1, c, r, i, o, s)
              } else this._doInsertHere(t, r, i, o, s)
            }),
            (e.prototype._doInsertHere = function (e, t, n, r, i) {
              if (null !== t) {
                for (var o = 0, s = this._rulesWithParentScopes.length; o < s; o++) {
                  var a = this._rulesWithParentScopes[o]
                  if (0 === l(a.parentScopes, t)) return void a.acceptOverwrite(e, n, r, i)
                }
                ;-1 === n && (n = this._mainRule.fontStyle),
                  0 === r && (r = this._mainRule.foreground),
                  0 === i && (i = this._mainRule.background),
                  this._rulesWithParentScopes.push(new h(e, t, n, r, i))
              } else this._mainRule.acceptOverwrite(e, n, r, i)
            }),
            e
          )
        })()
        t.ThemeTrieElement = p
      }
    ])
  })
})(main$1)

/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
function tokenizeWithTheme(theme, colorMap, fileContents, grammar, options) {
  let lines = fileContents.split(/\r\n|\r|\n/)
  let ruleStack = main$1.exports.INITIAL
  let actual = []
  let final = []
  for (let i = 0, len = lines.length; i < len; i++) {
    let line = lines[i]
    if (line === '') {
      actual = []
      final.push([])
      continue
    }
    let resultWithScopes
    let tokensWithScopes
    let tokensWithScopesIndex
    if (options.includeExplanation) {
      resultWithScopes = grammar.tokenizeLine(line, ruleStack)
      tokensWithScopes = resultWithScopes.tokens
      tokensWithScopesIndex = 0
    }
    let result = grammar.tokenizeLine2(line, ruleStack)
    let tokensLength = result.tokens.length / 2
    for (let j = 0; j < tokensLength; j++) {
      let startIndex = result.tokens[2 * j]
      let nextStartIndex = j + 1 < tokensLength ? result.tokens[2 * j + 2] : line.length
      if (startIndex === nextStartIndex) {
        continue
      }
      let metadata = result.tokens[2 * j + 1]
      let foreground = StackElementMetadata.getForeground(metadata)
      let foregroundColor = colorMap[foreground]
      let fontStyle = StackElementMetadata.getFontStyle(metadata)
      let explanation = []
      if (options.includeExplanation) {
        let offset = 0
        while (startIndex + offset < nextStartIndex) {
          let tokenWithScopes = tokensWithScopes[tokensWithScopesIndex]
          let tokenWithScopesText = line.substring(
            tokenWithScopes.startIndex,
            tokenWithScopes.endIndex
          )
          offset += tokenWithScopesText.length
          explanation.push({
            content: tokenWithScopesText,
            scopes: explainThemeScopes(theme, tokenWithScopes.scopes)
          })
          tokensWithScopesIndex++
        }
      }
      actual.push({
        content: line.substring(startIndex, nextStartIndex),
        color: foregroundColor,
        fontStyle,
        explanation: explanation
      })
    }
    final.push(actual)
    actual = []
    ruleStack = result.ruleStack
  }
  return final
}
function explainThemeScopes(theme, scopes) {
  let result = []
  for (let i = 0, len = scopes.length; i < len; i++) {
    let parentScopes = scopes.slice(0, i)
    let scope = scopes[i]
    result[i] = {
      scopeName: scope,
      themeMatches: explainThemeScope(theme, scope, parentScopes)
    }
  }
  return result
}
function matchesOne(selector, scope) {
  let selectorPrefix = selector + '.'
  if (selector === scope || scope.substring(0, selectorPrefix.length) === selectorPrefix) {
    return true
  }
  return false
}
function matches(selector, selectorParentScopes, scope, parentScopes) {
  if (!matchesOne(selector, scope)) {
    return false
  }
  let selectorParentIndex = selectorParentScopes.length - 1
  let parentIndex = parentScopes.length - 1
  while (selectorParentIndex >= 0 && parentIndex >= 0) {
    if (matchesOne(selectorParentScopes[selectorParentIndex], parentScopes[parentIndex])) {
      selectorParentIndex--
    }
    parentIndex--
  }
  if (selectorParentIndex === -1) {
    return true
  }
  return false
}
const themeScopeCache = new Map()
function explainThemeScope(theme, scope, parentScopes) {
  const cacheKey = `${theme.name} ${scope} ${parentScopes.sort().join(' ')}`
  const cachedResult = themeScopeCache.get(cacheKey)
  if (theme.name && cachedResult) {
    return cachedResult
  }
  let result = [],
    resultLen = 0
  for (let i = 0, len = theme.settings.length; i < len; i++) {
    let setting = theme.settings[i]
    let selectors
    if (typeof setting.scope === 'string') {
      selectors = setting.scope.split(/,/).map(scope => scope.trim())
    } else if (Array.isArray(setting.scope)) {
      selectors = setting.scope
    } else {
      continue
    }
    for (let j = 0, lenJ = selectors.length; j < lenJ; j++) {
      let rawSelector = selectors[j]
      let rawSelectorPieces = rawSelector.split(/ /)
      let selector = rawSelectorPieces[rawSelectorPieces.length - 1]
      let selectorParentScopes = rawSelectorPieces.slice(0, rawSelectorPieces.length - 1)
      if (matches(selector, selectorParentScopes, scope, parentScopes)) {
        // match!
        result[resultLen++] = setting
        // break the loop
        j = lenJ
      }
    }
  }
  themeScopeCache.set(cacheKey, result)
  return result
}

function trimEndSlash(str) {
  if (str.endsWith('/') || str.endsWith('\\')) return str.slice(0, -1)
  return str
}
function trimStartDot(str) {
  if (str.startsWith('./')) return str.slice(2)
  return str
}
function dirpathparts(str) {
  const parts = str.split(/[\/\\]/g)
  return parts.slice(0, parts.length - 1)
}
function join(...parts) {
  const newParts = parts.map(trimEndSlash).map(trimStartDot).join('/').split('/')
  for (let i = 0; i < newParts.length; i++) {
    if (newParts[i] === '..') {
      newParts.splice(i - 1, 2)
      i -= 2
    }
  }
  return newParts.join('/')
}
function groupBy(elements, keyGetter) {
  const map = new Map()
  for (const element of elements) {
    const key = keyGetter(element)
    if (map.has(key)) {
      const group = map.get(key)
      group.push(element)
    } else {
      map.set(key, [element])
    }
  }
  return map
}

function renderToHtml(lines, options = {}) {
  var _a
  const bg = options.bg || '#fff'
  const optionsByLineNumber = groupBy(
    (_a = options.lineOptions) !== null && _a !== void 0 ? _a : [],
    option => option.line
  )
  let html = ''
  html += `<pre class="shiki" style="background-color: ${bg}">`
  if (options.langId) {
    html += `<div class="language-id">${options.langId}</div>`
  }
  html += `<code>`
  lines.forEach((l, lineIndex) => {
    var _a
    const lineNumber = lineIndex + 1
    const lineOptions =
      (_a = optionsByLineNumber.get(lineNumber)) !== null && _a !== void 0 ? _a : []
    const lineClasses = getLineClasses(lineOptions).join(' ')
    html += `<span class="${lineClasses}">`
    l.forEach(token => {
      const cssDeclarations = [`color: ${token.color || options.fg}`]
      if (token.fontStyle & FontStyle.Italic) {
        cssDeclarations.push('font-style: italic')
      }
      if (token.fontStyle & FontStyle.Bold) {
        cssDeclarations.push('font-weight: bold')
      }
      if (token.fontStyle & FontStyle.Underline) {
        cssDeclarations.push('text-decoration: underline')
      }
      html += `<span style="${cssDeclarations.join('; ')}">${escapeHtml(token.content)}</span>`
    })
    html += `</span>\n`
  })
  html = html.replace(/\n*$/, '') // Get rid of final new lines
  html += `</code></pre>`
  return html
}
const htmlEscapes = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}
function escapeHtml(html) {
  return html.replace(/[&<>"']/g, chr => htmlEscapes[chr])
}
function getLineClasses(lineOptions) {
  var _a
  const lineClasses = new Set(['line'])
  for (const lineOption of lineOptions) {
    for (const lineClass of (_a = lineOption.classes) !== null && _a !== void 0 ? _a : []) {
      lineClasses.add(lineClass)
    }
  }
  return Array.from(lineClasses)
}

var main = { exports: {} }

;(function (module, exports) {
  !(function (t, n) {
    module.exports = n()
  })(commonjsGlobal, function () {
    return (
      (t = {
        770: function (t, n, e) {
          var r =
            (this && this.__importDefault) ||
            function (t) {
              return t && t.__esModule ? t : { default: t }
            }
          Object.defineProperty(n, '__esModule', { value: !0 }),
            (n.setDefaultDebugCall =
              n.createOnigScanner =
              n.createOnigString =
              n.loadWASM =
              n.OnigScanner =
              n.OnigString =
                void 0)
          const i = r(e(418))
          let o = null,
            a = !1
          class f {
            constructor(t) {
              const n = t.length,
                e = f._utf8ByteLength(t),
                r = e !== n,
                i = r ? new Uint32Array(n + 1) : null
              r && (i[n] = e)
              const o = r ? new Uint32Array(e + 1) : null
              r && (o[e] = n)
              const a = new Uint8Array(e)
              let s = 0
              for (let e = 0; e < n; e++) {
                const f = t.charCodeAt(e)
                let u = f,
                  c = !1
                if (f >= 55296 && f <= 56319 && e + 1 < n) {
                  const n = t.charCodeAt(e + 1)
                  n >= 56320 &&
                    n <= 57343 &&
                    ((u = (65536 + ((f - 55296) << 10)) | (n - 56320)), (c = !0))
                }
                r &&
                  ((i[e] = s),
                  c && (i[e + 1] = s),
                  u <= 127
                    ? (o[s + 0] = e)
                    : u <= 2047
                    ? ((o[s + 0] = e), (o[s + 1] = e))
                    : u <= 65535
                    ? ((o[s + 0] = e), (o[s + 1] = e), (o[s + 2] = e))
                    : ((o[s + 0] = e), (o[s + 1] = e), (o[s + 2] = e), (o[s + 3] = e))),
                  u <= 127
                    ? (a[s++] = u)
                    : u <= 2047
                    ? ((a[s++] = 192 | ((1984 & u) >>> 6)), (a[s++] = 128 | ((63 & u) >>> 0)))
                    : u <= 65535
                    ? ((a[s++] = 224 | ((61440 & u) >>> 12)),
                      (a[s++] = 128 | ((4032 & u) >>> 6)),
                      (a[s++] = 128 | ((63 & u) >>> 0)))
                    : ((a[s++] = 240 | ((1835008 & u) >>> 18)),
                      (a[s++] = 128 | ((258048 & u) >>> 12)),
                      (a[s++] = 128 | ((4032 & u) >>> 6)),
                      (a[s++] = 128 | ((63 & u) >>> 0))),
                  c && e++
              }
              ;(this.utf16Length = n),
                (this.utf8Length = e),
                (this.utf16Value = t),
                (this.utf8Value = a),
                (this.utf16OffsetToUtf8 = i),
                (this.utf8OffsetToUtf16 = o)
            }
            static _utf8ByteLength(t) {
              let n = 0
              for (let e = 0, r = t.length; e < r; e++) {
                const i = t.charCodeAt(e)
                let o = i,
                  a = !1
                if (i >= 55296 && i <= 56319 && e + 1 < r) {
                  const n = t.charCodeAt(e + 1)
                  n >= 56320 &&
                    n <= 57343 &&
                    ((o = (65536 + ((i - 55296) << 10)) | (n - 56320)), (a = !0))
                }
                ;(n += o <= 127 ? 1 : o <= 2047 ? 2 : o <= 65535 ? 3 : 4), a && e++
              }
              return n
            }
            createString(t) {
              const n = t._omalloc(this.utf8Length)
              return t.HEAPU8.set(this.utf8Value, n), n
            }
          }
          class s {
            constructor(t) {
              if (((this.id = ++s.LAST_ID), !o)) throw new Error('Must invoke loadWASM first.')
              ;(this._onigBinding = o), (this.content = t)
              const n = new f(t)
              ;(this.utf16Length = n.utf16Length),
                (this.utf8Length = n.utf8Length),
                (this.utf16OffsetToUtf8 = n.utf16OffsetToUtf8),
                (this.utf8OffsetToUtf16 = n.utf8OffsetToUtf16),
                this.utf8Length < 1e4 && !s._sharedPtrInUse
                  ? (s._sharedPtr || (s._sharedPtr = o._omalloc(1e4)),
                    (s._sharedPtrInUse = !0),
                    o.HEAPU8.set(n.utf8Value, s._sharedPtr),
                    (this.ptr = s._sharedPtr))
                  : (this.ptr = n.createString(o))
            }
            convertUtf8OffsetToUtf16(t) {
              return this.utf8OffsetToUtf16
                ? t < 0
                  ? 0
                  : t > this.utf8Length
                  ? this.utf16Length
                  : this.utf8OffsetToUtf16[t]
                : t
            }
            convertUtf16OffsetToUtf8(t) {
              return this.utf16OffsetToUtf8
                ? t < 0
                  ? 0
                  : t > this.utf16Length
                  ? this.utf8Length
                  : this.utf16OffsetToUtf8[t]
                : t
            }
            dispose() {
              this.ptr === s._sharedPtr
                ? (s._sharedPtrInUse = !1)
                : this._onigBinding._ofree(this.ptr)
            }
          }
          ;(n.OnigString = s), (s.LAST_ID = 0), (s._sharedPtr = 0), (s._sharedPtrInUse = !1)
          class u {
            constructor(t) {
              if (!o) throw new Error('Must invoke loadWASM first.')
              const n = [],
                e = []
              for (let r = 0, i = t.length; r < i; r++) {
                const i = new f(t[r])
                ;(n[r] = i.createString(o)), (e[r] = i.utf8Length)
              }
              const r = o._omalloc(4 * t.length)
              o.HEAPU32.set(n, r / 4)
              const i = o._omalloc(4 * t.length)
              o.HEAPU32.set(e, i / 4)
              const a = o._createOnigScanner(r, i, t.length)
              for (let e = 0, r = t.length; e < r; e++) o._ofree(n[e])
              o._ofree(i),
                o._ofree(r),
                0 === a &&
                  (function (t) {
                    throw new Error(t.UTF8ToString(t._getLastOnigError()))
                  })(o),
                (this._onigBinding = o),
                (this._ptr = a)
            }
            dispose() {
              this._onigBinding._freeOnigScanner(this._ptr)
            }
            findNextMatchSync(t, n, e) {
              let r = a,
                i = 0
              if (
                ('number' == typeof e
                  ? (8 & e && (r = !0), (i = e))
                  : 'boolean' == typeof e && (r = e),
                'string' == typeof t)
              ) {
                t = new s(t)
                const e = this._findNextMatchSync(t, n, r, i)
                return t.dispose(), e
              }
              return this._findNextMatchSync(t, n, r, i)
            }
            _findNextMatchSync(t, n, e, r) {
              const i = this._onigBinding
              let o
              if (
                ((o = e
                  ? i._findNextOnigScannerMatchDbg(
                      this._ptr,
                      t.id,
                      t.ptr,
                      t.utf8Length,
                      t.convertUtf16OffsetToUtf8(n),
                      r
                    )
                  : i._findNextOnigScannerMatch(
                      this._ptr,
                      t.id,
                      t.ptr,
                      t.utf8Length,
                      t.convertUtf16OffsetToUtf8(n),
                      r
                    )),
                0 === o)
              )
                return null
              const a = i.HEAPU32
              let f = o / 4
              const s = a[f++],
                u = a[f++]
              let c = []
              for (let n = 0; n < u; n++) {
                const e = t.convertUtf8OffsetToUtf16(a[f++]),
                  r = t.convertUtf8OffsetToUtf16(a[f++])
                c[n] = { start: e, end: r, length: r - e }
              }
              return { index: s, captureIndices: c }
            }
          }
          n.OnigScanner = u
          let c = !1,
            l = null
          ;(n.loadWASM = function (t) {
            if (c) return l
            let n, e, r, a
            if (
              ((c = !0),
              (function (t) {
                return 'function' == typeof t.instantiator
              })(t))
            )
              (n = t.instantiator), (e = t.print)
            else {
              let r
              t instanceof ArrayBuffer || t instanceof Response
                ? (r = t)
                : ((r = t.data), (e = t.print)),
                (n =
                  r instanceof ArrayBuffer
                    ? (function (t) {
                        return n => WebAssembly.instantiate(t, n)
                      })(r)
                    : r instanceof Response && 'function' == typeof WebAssembly.instantiateStreaming
                    ? (function (t) {
                        return n => WebAssembly.instantiateStreaming(t, n)
                      })(r)
                    : (function (t) {
                        return async n => {
                          const e = await t.arrayBuffer()
                          return WebAssembly.instantiate(e, n)
                        }
                      })(r))
            }
            return (
              (l = new Promise((t, n) => {
                ;(r = t), (a = n)
              })),
              (function (t, n, e, r) {
                i.default({
                  print: n,
                  instantiateWasm: (n, e) => {
                    if ('undefined' == typeof performance) {
                      const t = () => Date.now()
                      ;(n.env.emscripten_get_now = t),
                        (n.wasi_snapshot_preview1.emscripten_get_now = t)
                    }
                    return t(n).then(t => e(t.instance), r), {}
                  }
                }).then(t => {
                  ;(o = t), e()
                })
              })(n, e, r, a),
              l
            )
          }),
            (n.createOnigString = function (t) {
              return new s(t)
            }),
            (n.createOnigScanner = function (t) {
              return new u(t)
            }),
            (n.setDefaultDebugCall = function (t) {
              a = t
            })
        },
        418: t => {
          var n =
            ('undefined' != typeof document && document.currentScript && document.currentScript.src,
            function (t) {
              var n,
                e,
                r = void 0 !== (t = t || {}) ? t : {}
              r.ready = new Promise(function (t, r) {
                ;(n = t), (e = r)
              })
              var i,
                o = {}
              for (i in r) r.hasOwnProperty(i) && (o[i] = r[i])
              var a,
                u = !1,
                l = ''
              function p(t) {
                return r.locateFile ? r.locateFile(t, l) : l + t
              }
              ;(a = function (t) {
                var n
                return 'function' == typeof readbuffer
                  ? new Uint8Array(readbuffer(t))
                  : (v('object' == typeof (n = read(t, 'binary'))), n)
              }),
                'undefined' != typeof scriptArgs ? scriptArgs : void 0 !== arguments && arguments,
                'undefined' != typeof onig_print &&
                  ('undefined' == typeof console && (console = {}),
                  (console.log = onig_print),
                  (console.warn = console.error =
                    'undefined' != typeof printErr ? printErr : onig_print))
              var h = r.print || console.log.bind(console),
                g = r.printErr || console.warn.bind(console)
              for (i in o) o.hasOwnProperty(i) && (r[i] = o[i])
              ;(o = null),
                r.arguments && r.arguments,
                r.thisProgram && r.thisProgram,
                r.quit && r.quit
              var d, _
              r.wasmBinary && (d = r.wasmBinary),
                r.noExitRuntime,
                'object' != typeof WebAssembly && z('no native wasm support detected')
              var y = !1
              function v(t, n) {
                t || z('Assertion failed: ' + n)
              }
              var w,
                S,
                A,
                b = 'undefined' != typeof TextDecoder ? new TextDecoder('utf8') : void 0
              function O(t, n, e) {
                for (var r = n + e, i = n; t[i] && !(i >= r); ) ++i
                if (i - n > 16 && t.subarray && b) return b.decode(t.subarray(n, i))
                for (var o = ''; n < i; ) {
                  var a = t[n++]
                  if (128 & a) {
                    var f = 63 & t[n++]
                    if (192 != (224 & a)) {
                      var s = 63 & t[n++]
                      if (
                        (a =
                          224 == (240 & a)
                            ? ((15 & a) << 12) | (f << 6) | s
                            : ((7 & a) << 18) | (f << 12) | (s << 6) | (63 & t[n++])) < 65536
                      )
                        o += String.fromCharCode(a)
                      else {
                        var u = a - 65536
                        o += String.fromCharCode(55296 | (u >> 10), 56320 | (1023 & u))
                      }
                    } else o += String.fromCharCode(((31 & a) << 6) | f)
                  } else o += String.fromCharCode(a)
                }
                return o
              }
              function U(t, n) {
                return t ? O(S, t, n) : ''
              }
              function x(t, n) {
                return t % n > 0 && (t += n - (t % n)), t
              }
              function P(t) {
                ;(w = t),
                  (r.HEAP8 = new Int8Array(t)),
                  (r.HEAP16 = new Int16Array(t)),
                  (r.HEAP32 = A = new Int32Array(t)),
                  (r.HEAPU8 = S = new Uint8Array(t)),
                  (r.HEAPU16 = new Uint16Array(t)),
                  (r.HEAPU32 = new Uint32Array(t)),
                  (r.HEAPF32 = new Float32Array(t)),
                  (r.HEAPF64 = new Float64Array(t))
              }
              'undefined' != typeof TextDecoder && new TextDecoder('utf-16le'), r.INITIAL_MEMORY
              var T,
                R = [],
                E = [],
                M = [],
                L = []
              function I() {
                if (r.preRun)
                  for ('function' == typeof r.preRun && (r.preRun = [r.preRun]); r.preRun.length; )
                    N(r.preRun.shift())
                $(R)
              }
              function D() {
                $(E)
              }
              function W() {
                $(M)
              }
              function C() {
                if (r.postRun)
                  for (
                    'function' == typeof r.postRun && (r.postRun = [r.postRun]);
                    r.postRun.length;

                  )
                    B(r.postRun.shift())
                $(L)
              }
              function N(t) {
                R.unshift(t)
              }
              function B(t) {
                L.unshift(t)
              }
              E.push({
                func: function () {
                  ut()
                }
              })
              var k = 0,
                j = null
              function F(t) {
                k++, r.monitorRunDependencies && r.monitorRunDependencies(k)
              }
              function V(t) {
                if ((k--, r.monitorRunDependencies && r.monitorRunDependencies(k), 0 == k && j)) {
                  var n = j
                  ;(j = null), n()
                }
              }
              function z(t) {
                r.onAbort && r.onAbort(t),
                  g((t += '')),
                  (y = !0),
                  (t = 'abort(' + t + '). Build with -s ASSERTIONS=1 for more info.')
                var n = new WebAssembly.RuntimeError(t)
                throw (e(n), n)
              }
              function q(t, n) {
                return String.prototype.startsWith ? t.startsWith(n) : 0 === t.indexOf(n)
              }
              ;(r.preloadedImages = {}), (r.preloadedAudios = {})
              var Y = 'data:application/octet-stream;base64,'
              function G(t) {
                return q(t, Y)
              }
              var J,
                K = 'onig.wasm'
              function Q(t) {
                try {
                  if (t == K && d) return new Uint8Array(d)
                  if (a) return a(t)
                  throw 'both async and sync fetching of the wasm failed'
                } catch (t) {
                  z(t)
                }
              }
              function X() {
                return d || !u || 'function' != typeof fetch
                  ? Promise.resolve().then(function () {
                      return Q(K)
                    })
                  : fetch(K, { credentials: 'same-origin' })
                      .then(function (t) {
                        if (!t.ok) throw "failed to load wasm binary file at '" + K + "'"
                        return t.arrayBuffer()
                      })
                      .catch(function () {
                        return Q(K)
                      })
              }
              function Z() {
                var t = { env: st, wasi_snapshot_preview1: st }
                function n(t, n) {
                  var e = t.exports
                  ;(r.asm = e),
                    P((_ = r.asm.memory).buffer),
                    (T = r.asm.__indirect_function_table),
                    V()
                }
                function i(t) {
                  n(t.instance)
                }
                function o(n) {
                  return X()
                    .then(function (n) {
                      return WebAssembly.instantiate(n, t)
                    })
                    .then(n, function (t) {
                      g('failed to asynchronously prepare wasm: ' + t), z(t)
                    })
                }
                if ((F(), r.instantiateWasm))
                  try {
                    return r.instantiateWasm(t, n)
                  } catch (t) {
                    return g('Module.instantiateWasm callback failed with error: ' + t), !1
                  }
                return (
                  (d ||
                  'function' != typeof WebAssembly.instantiateStreaming ||
                  G(K) ||
                  'function' != typeof fetch
                    ? o(i)
                    : fetch(K, { credentials: 'same-origin' }).then(function (n) {
                        return WebAssembly.instantiateStreaming(n, t).then(i, function (t) {
                          return (
                            g('wasm streaming compile failed: ' + t),
                            g('falling back to ArrayBuffer instantiation'),
                            o(i)
                          )
                        })
                      })
                  ).catch(e),
                  {}
                )
              }
              function $(t) {
                for (; t.length > 0; ) {
                  var n = t.shift()
                  if ('function' != typeof n) {
                    var e = n.func
                    'number' == typeof e
                      ? void 0 === n.arg
                        ? T.get(e)()
                        : T.get(e)(n.arg)
                      : e(void 0 === n.arg ? null : n.arg)
                  } else n(r)
                }
              }
              function tt(t, n, e) {
                S.copyWithin(t, n, n + e)
              }
              function nt() {
                return S.length
              }
              function et(t) {
                try {
                  return _.grow((t - w.byteLength + 65535) >>> 16), P(_.buffer), 1
                } catch (t) {}
              }
              function rt(t) {
                var n = nt(),
                  e = 2147483648
                if (t > e) return !1
                for (var r = 1; r <= 4; r *= 2) {
                  var i = n * (1 + 0.2 / r)
                  if (((i = Math.min(i, t + 100663296)), et(Math.min(e, x(Math.max(t, i), 65536)))))
                    return !0
                }
                return !1
              }
              G(K) || (K = p(K)),
                (J =
                  'undefined' != typeof dateNow
                    ? dateNow
                    : function () {
                        return performance.now()
                      })
              var it = {
                mappings: {},
                buffers: [null, [], []],
                printChar: function (t, n) {
                  var e = it.buffers[t]
                  0 === n || 10 === n ? ((1 === t ? h : g)(O(e, 0)), (e.length = 0)) : e.push(n)
                },
                varargs: void 0,
                get: function () {
                  return (it.varargs += 4), A[(it.varargs - 4) >> 2]
                },
                getStr: function (t) {
                  return U(t)
                },
                get64: function (t, n) {
                  return t
                }
              }
              function ot(t, n, e, r) {
                for (var i = 0, o = 0; o < e; o++) {
                  for (
                    var a = A[(n + 8 * o) >> 2], f = A[(n + (8 * o + 4)) >> 2], s = 0;
                    s < f;
                    s++
                  )
                    it.printChar(t, S[a + s])
                  i += f
                }
                return (A[r >> 2] = i), 0
              }
              function at(t) {}
              var ft,
                st = {
                  emscripten_get_now: J,
                  emscripten_memcpy_big: tt,
                  emscripten_resize_heap: rt,
                  fd_write: ot,
                  setTempRet0: at
                },
                ut =
                  (Z(),
                  (r.___wasm_call_ctors = function () {
                    return (ut = r.___wasm_call_ctors = r.asm.__wasm_call_ctors).apply(
                      null,
                      arguments
                    )
                  }))
              function ct(t) {
                function e() {
                  ft ||
                    ((ft = !0),
                    (r.calledRun = !0),
                    y || (D(), W(), n(r), r.onRuntimeInitialized && r.onRuntimeInitialized(), C()))
                }
                k > 0 ||
                  (I(),
                  k > 0 ||
                    (r.setStatus
                      ? (r.setStatus('Running...'),
                        setTimeout(function () {
                          setTimeout(function () {
                            r.setStatus('')
                          }, 1),
                            e()
                        }, 1))
                      : e()))
              }
              if (
                ((r.___errno_location = function () {
                  return (r.___errno_location = r.asm.__errno_location).apply(null, arguments)
                }),
                (r._omalloc = function () {
                  return (r._omalloc = r.asm.omalloc).apply(null, arguments)
                }),
                (r._ofree = function () {
                  return (r._ofree = r.asm.ofree).apply(null, arguments)
                }),
                (r._getLastOnigError = function () {
                  return (r._getLastOnigError = r.asm.getLastOnigError).apply(null, arguments)
                }),
                (r._createOnigScanner = function () {
                  return (r._createOnigScanner = r.asm.createOnigScanner).apply(null, arguments)
                }),
                (r._freeOnigScanner = function () {
                  return (r._freeOnigScanner = r.asm.freeOnigScanner).apply(null, arguments)
                }),
                (r._findNextOnigScannerMatch = function () {
                  return (r._findNextOnigScannerMatch = r.asm.findNextOnigScannerMatch).apply(
                    null,
                    arguments
                  )
                }),
                (r._findNextOnigScannerMatchDbg = function () {
                  return (r._findNextOnigScannerMatchDbg = r.asm.findNextOnigScannerMatchDbg).apply(
                    null,
                    arguments
                  )
                }),
                (r.stackSave = function () {
                  return (r.stackSave = r.asm.stackSave).apply(null, arguments)
                }),
                (r.stackRestore = function () {
                  return (r.stackRestore = r.asm.stackRestore).apply(null, arguments)
                }),
                (r.stackAlloc = function () {
                  return (r.stackAlloc = r.asm.stackAlloc).apply(null, arguments)
                }),
                (r.dynCall_jiji = function () {
                  return (r.dynCall_jiji = r.asm.dynCall_jiji).apply(null, arguments)
                }),
                (r.UTF8ToString = U),
                (j = function t() {
                  ft || ct(), ft || (j = t)
                }),
                (r.run = ct),
                r.preInit)
              )
                for (
                  'function' == typeof r.preInit && (r.preInit = [r.preInit]);
                  r.preInit.length > 0;

                )
                  r.preInit.pop()()
              return ct(), t.ready
            })
          t.exports = n
        }
      }),
      (n = {}),
      (function e(r) {
        var i = n[r]
        if (void 0 !== i) return i.exports
        var o = (n[r] = { exports: {} })
        return t[r].call(o.exports, o, o.exports, e), o.exports
      })(770)
    )
    var t, n
  })
})(main)

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Creates a JSON scanner on the given text.
 * If ignoreTrivia is set, whitespaces or comments are ignored.
 */
function createScanner(text, ignoreTrivia) {
  if (ignoreTrivia === void 0) {
    ignoreTrivia = false
  }
  var len = text.length
  var pos = 0,
    value = '',
    tokenOffset = 0,
    token = 16 /* Unknown */,
    lineNumber = 0,
    lineStartOffset = 0,
    tokenLineStartOffset = 0,
    prevTokenLineStartOffset = 0,
    scanError = 0 /* None */
  function scanHexDigits(count, exact) {
    var digits = 0
    var value = 0
    while (digits < count || !exact) {
      var ch = text.charCodeAt(pos)
      if (ch >= 48 /* _0 */ && ch <= 57 /* _9 */) {
        value = value * 16 + ch - 48 /* _0 */
      } else if (ch >= 65 /* A */ && ch <= 70 /* F */) {
        value = value * 16 + ch - 65 /* A */ + 10
      } else if (ch >= 97 /* a */ && ch <= 102 /* f */) {
        value = value * 16 + ch - 97 /* a */ + 10
      } else {
        break
      }
      pos++
      digits++
    }
    if (digits < count) {
      value = -1
    }
    return value
  }
  function setPosition(newPosition) {
    pos = newPosition
    value = ''
    tokenOffset = 0
    token = 16 /* Unknown */
    scanError = 0 /* None */
  }
  function scanNumber() {
    var start = pos
    if (text.charCodeAt(pos) === 48 /* _0 */) {
      pos++
    } else {
      pos++
      while (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++
      }
    }
    if (pos < text.length && text.charCodeAt(pos) === 46 /* dot */) {
      pos++
      if (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++
        while (pos < text.length && isDigit(text.charCodeAt(pos))) {
          pos++
        }
      } else {
        scanError = 3 /* UnexpectedEndOfNumber */
        return text.substring(start, pos)
      }
    }
    var end = pos
    if (
      pos < text.length &&
      (text.charCodeAt(pos) === 69 /* E */ || text.charCodeAt(pos) === 101) /* e */
    ) {
      pos++
      if (
        (pos < text.length && text.charCodeAt(pos) === 43) /* plus */ ||
        text.charCodeAt(pos) === 45 /* minus */
      ) {
        pos++
      }
      if (pos < text.length && isDigit(text.charCodeAt(pos))) {
        pos++
        while (pos < text.length && isDigit(text.charCodeAt(pos))) {
          pos++
        }
        end = pos
      } else {
        scanError = 3 /* UnexpectedEndOfNumber */
      }
    }
    return text.substring(start, end)
  }
  function scanString() {
    var result = '',
      start = pos
    while (true) {
      if (pos >= len) {
        result += text.substring(start, pos)
        scanError = 2 /* UnexpectedEndOfString */
        break
      }
      var ch = text.charCodeAt(pos)
      if (ch === 34 /* doubleQuote */) {
        result += text.substring(start, pos)
        pos++
        break
      }
      if (ch === 92 /* backslash */) {
        result += text.substring(start, pos)
        pos++
        if (pos >= len) {
          scanError = 2 /* UnexpectedEndOfString */
          break
        }
        var ch2 = text.charCodeAt(pos++)
        switch (ch2) {
          case 34 /* doubleQuote */:
            result += '"'
            break
          case 92 /* backslash */:
            result += '\\'
            break
          case 47 /* slash */:
            result += '/'
            break
          case 98 /* b */:
            result += '\b'
            break
          case 102 /* f */:
            result += '\f'
            break
          case 110 /* n */:
            result += '\n'
            break
          case 114 /* r */:
            result += '\r'
            break
          case 116 /* t */:
            result += '\t'
            break
          case 117 /* u */:
            var ch3 = scanHexDigits(4, true)
            if (ch3 >= 0) {
              result += String.fromCharCode(ch3)
            } else {
              scanError = 4 /* InvalidUnicode */
            }
            break
          default:
            scanError = 5 /* InvalidEscapeCharacter */
        }
        start = pos
        continue
      }
      if (ch >= 0 && ch <= 0x1f) {
        if (isLineBreak(ch)) {
          result += text.substring(start, pos)
          scanError = 2 /* UnexpectedEndOfString */
          break
        } else {
          scanError = 6 /* InvalidCharacter */
          // mark as error but continue with string
        }
      }
      pos++
    }
    return result
  }
  function scanNext() {
    value = ''
    scanError = 0 /* None */
    tokenOffset = pos
    lineStartOffset = lineNumber
    prevTokenLineStartOffset = tokenLineStartOffset
    if (pos >= len) {
      // at the end
      tokenOffset = len
      return (token = 17) /* EOF */
    }
    var code = text.charCodeAt(pos)
    // trivia: whitespace
    if (isWhiteSpace(code)) {
      do {
        pos++
        value += String.fromCharCode(code)
        code = text.charCodeAt(pos)
      } while (isWhiteSpace(code))
      return (token = 15) /* Trivia */
    }
    // trivia: newlines
    if (isLineBreak(code)) {
      pos++
      value += String.fromCharCode(code)
      if (code === 13 /* carriageReturn */ && text.charCodeAt(pos) === 10 /* lineFeed */) {
        pos++
        value += '\n'
      }
      lineNumber++
      tokenLineStartOffset = pos
      return (token = 14) /* LineBreakTrivia */
    }
    switch (code) {
      // tokens: []{}:,
      case 123 /* openBrace */:
        pos++
        return (token = 1) /* OpenBraceToken */
      case 125 /* closeBrace */:
        pos++
        return (token = 2) /* CloseBraceToken */
      case 91 /* openBracket */:
        pos++
        return (token = 3) /* OpenBracketToken */
      case 93 /* closeBracket */:
        pos++
        return (token = 4) /* CloseBracketToken */
      case 58 /* colon */:
        pos++
        return (token = 6) /* ColonToken */
      case 44 /* comma */:
        pos++
        return (token = 5) /* CommaToken */
      // strings
      case 34 /* doubleQuote */:
        pos++
        value = scanString()
        return (token = 10) /* StringLiteral */
      // comments
      case 47 /* slash */:
        var start = pos - 1
        // Single-line comment
        if (text.charCodeAt(pos + 1) === 47 /* slash */) {
          pos += 2
          while (pos < len) {
            if (isLineBreak(text.charCodeAt(pos))) {
              break
            }
            pos++
          }
          value = text.substring(start, pos)
          return (token = 12) /* LineCommentTrivia */
        }
        // Multi-line comment
        if (text.charCodeAt(pos + 1) === 42 /* asterisk */) {
          pos += 2
          var safeLength = len - 1 // For lookahead.
          var commentClosed = false
          while (pos < safeLength) {
            var ch = text.charCodeAt(pos)
            if (ch === 42 /* asterisk */ && text.charCodeAt(pos + 1) === 47 /* slash */) {
              pos += 2
              commentClosed = true
              break
            }
            pos++
            if (isLineBreak(ch)) {
              if (ch === 13 /* carriageReturn */ && text.charCodeAt(pos) === 10 /* lineFeed */) {
                pos++
              }
              lineNumber++
              tokenLineStartOffset = pos
            }
          }
          if (!commentClosed) {
            pos++
            scanError = 1 /* UnexpectedEndOfComment */
          }
          value = text.substring(start, pos)
          return (token = 13) /* BlockCommentTrivia */
        }
        // just a single slash
        value += String.fromCharCode(code)
        pos++
        return (token = 16) /* Unknown */
      // numbers
      case 45 /* minus */:
        value += String.fromCharCode(code)
        pos++
        if (pos === len || !isDigit(text.charCodeAt(pos))) {
          return (token = 16) /* Unknown */
        }
      // found a minus, followed by a number so
      // we fall through to proceed with scanning
      // numbers
      case 48 /* _0 */:
      case 49 /* _1 */:
      case 50 /* _2 */:
      case 51 /* _3 */:
      case 52 /* _4 */:
      case 53 /* _5 */:
      case 54 /* _6 */:
      case 55 /* _7 */:
      case 56 /* _8 */:
      case 57 /* _9 */:
        value += scanNumber()
        return (token = 11) /* NumericLiteral */
      // literals and unknown symbols
      default:
        // is a literal? Read the full word.
        while (pos < len && isUnknownContentCharacter(code)) {
          pos++
          code = text.charCodeAt(pos)
        }
        if (tokenOffset !== pos) {
          value = text.substring(tokenOffset, pos)
          // keywords: true, false, null
          switch (value) {
            case 'true':
              return (token = 8) /* TrueKeyword */
            case 'false':
              return (token = 9) /* FalseKeyword */
            case 'null':
              return (token = 7) /* NullKeyword */
          }
          return (token = 16) /* Unknown */
        }
        // some
        value += String.fromCharCode(code)
        pos++
        return (token = 16) /* Unknown */
    }
  }
  function isUnknownContentCharacter(code) {
    if (isWhiteSpace(code) || isLineBreak(code)) {
      return false
    }
    switch (code) {
      case 125 /* closeBrace */:
      case 93 /* closeBracket */:
      case 123 /* openBrace */:
      case 91 /* openBracket */:
      case 34 /* doubleQuote */:
      case 58 /* colon */:
      case 44 /* comma */:
      case 47 /* slash */:
        return false
    }
    return true
  }
  function scanNextNonTrivia() {
    var result
    do {
      result = scanNext()
    } while (result >= 12 /* LineCommentTrivia */ && result <= 15 /* Trivia */)
    return result
  }
  return {
    setPosition: setPosition,
    getPosition: function () {
      return pos
    },
    scan: ignoreTrivia ? scanNextNonTrivia : scanNext,
    getToken: function () {
      return token
    },
    getTokenValue: function () {
      return value
    },
    getTokenOffset: function () {
      return tokenOffset
    },
    getTokenLength: function () {
      return pos - tokenOffset
    },
    getTokenStartLine: function () {
      return lineStartOffset
    },
    getTokenStartCharacter: function () {
      return tokenOffset - prevTokenLineStartOffset
    },
    getTokenError: function () {
      return scanError
    }
  }
}
function isWhiteSpace(ch) {
  return (
    ch === 32 /* space */ ||
    ch === 9 /* tab */ ||
    ch === 11 /* verticalTab */ ||
    ch === 12 /* formFeed */ ||
    ch === 160 /* nonBreakingSpace */ ||
    ch === 5760 /* ogham */ ||
    (ch >= 8192 /* enQuad */ && ch <= 8203) /* zeroWidthSpace */ ||
    ch === 8239 /* narrowNoBreakSpace */ ||
    ch === 8287 /* mathematicalSpace */ ||
    ch === 12288 /* ideographicSpace */ ||
    ch === 65279 /* byteOrderMark */
  )
}
function isLineBreak(ch) {
  return (
    ch === 10 /* lineFeed */ ||
    ch === 13 /* carriageReturn */ ||
    ch === 8232 /* lineSeparator */ ||
    ch === 8233 /* paragraphSeparator */
  )
}
function isDigit(ch) {
  return ch >= 48 /* _0 */ && ch <= 57 /* _9 */
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var ParseOptions
;(function (ParseOptions) {
  ParseOptions.DEFAULT = {
    allowTrailingComma: false
  }
})(ParseOptions || (ParseOptions = {}))
/**
 * Parses the given text and returns the object the JSON content represents. On invalid input, the parser tries to be as fault tolerant as possible, but still return a result.
 * Therefore always check the errors list to find out if the input was valid.
 */
function parse$1(text, errors, options) {
  if (errors === void 0) {
    errors = []
  }
  if (options === void 0) {
    options = ParseOptions.DEFAULT
  }
  var currentProperty = null
  var currentParent = []
  var previousParents = []
  function onValue(value) {
    if (Array.isArray(currentParent)) {
      currentParent.push(value)
    } else if (currentProperty !== null) {
      currentParent[currentProperty] = value
    }
  }
  var visitor = {
    onObjectBegin: function () {
      var object = {}
      onValue(object)
      previousParents.push(currentParent)
      currentParent = object
      currentProperty = null
    },
    onObjectProperty: function (name) {
      currentProperty = name
    },
    onObjectEnd: function () {
      currentParent = previousParents.pop()
    },
    onArrayBegin: function () {
      var array = []
      onValue(array)
      previousParents.push(currentParent)
      currentParent = array
      currentProperty = null
    },
    onArrayEnd: function () {
      currentParent = previousParents.pop()
    },
    onLiteralValue: onValue,
    onError: function (error, offset, length) {
      errors.push({ error: error, offset: offset, length: length })
    }
  }
  visit(text, visitor, options)
  return currentParent[0]
}
/**
 * Parses the given text and invokes the visitor functions for each object, array and literal reached.
 */
function visit(text, visitor, options) {
  if (options === void 0) {
    options = ParseOptions.DEFAULT
  }
  var _scanner = createScanner(text, false)
  function toNoArgVisit(visitFunction) {
    return visitFunction
      ? function () {
          return visitFunction(
            _scanner.getTokenOffset(),
            _scanner.getTokenLength(),
            _scanner.getTokenStartLine(),
            _scanner.getTokenStartCharacter()
          )
        }
      : function () {
          return true
        }
  }
  function toOneArgVisit(visitFunction) {
    return visitFunction
      ? function (arg) {
          return visitFunction(
            arg,
            _scanner.getTokenOffset(),
            _scanner.getTokenLength(),
            _scanner.getTokenStartLine(),
            _scanner.getTokenStartCharacter()
          )
        }
      : function () {
          return true
        }
  }
  var onObjectBegin = toNoArgVisit(visitor.onObjectBegin),
    onObjectProperty = toOneArgVisit(visitor.onObjectProperty),
    onObjectEnd = toNoArgVisit(visitor.onObjectEnd),
    onArrayBegin = toNoArgVisit(visitor.onArrayBegin),
    onArrayEnd = toNoArgVisit(visitor.onArrayEnd),
    onLiteralValue = toOneArgVisit(visitor.onLiteralValue),
    onSeparator = toOneArgVisit(visitor.onSeparator),
    onComment = toNoArgVisit(visitor.onComment),
    onError = toOneArgVisit(visitor.onError)
  var disallowComments = options && options.disallowComments
  var allowTrailingComma = options && options.allowTrailingComma
  function scanNext() {
    while (true) {
      var token = _scanner.scan()
      switch (_scanner.getTokenError()) {
        case 4 /* InvalidUnicode */:
          handleError(14 /* InvalidUnicode */)
          break
        case 5 /* InvalidEscapeCharacter */:
          handleError(15 /* InvalidEscapeCharacter */)
          break
        case 3 /* UnexpectedEndOfNumber */:
          handleError(13 /* UnexpectedEndOfNumber */)
          break
        case 1 /* UnexpectedEndOfComment */:
          if (!disallowComments) {
            handleError(11 /* UnexpectedEndOfComment */)
          }
          break
        case 2 /* UnexpectedEndOfString */:
          handleError(12 /* UnexpectedEndOfString */)
          break
        case 6 /* InvalidCharacter */:
          handleError(16 /* InvalidCharacter */)
          break
      }
      switch (token) {
        case 12 /* LineCommentTrivia */:
        case 13 /* BlockCommentTrivia */:
          if (disallowComments) {
            handleError(10 /* InvalidCommentToken */)
          } else {
            onComment()
          }
          break
        case 16 /* Unknown */:
          handleError(1 /* InvalidSymbol */)
          break
        case 15 /* Trivia */:
        case 14 /* LineBreakTrivia */:
          break
        default:
          return token
      }
    }
  }
  function handleError(error, skipUntilAfter, skipUntil) {
    if (skipUntilAfter === void 0) {
      skipUntilAfter = []
    }
    if (skipUntil === void 0) {
      skipUntil = []
    }
    onError(error)
    if (skipUntilAfter.length + skipUntil.length > 0) {
      var token = _scanner.getToken()
      while (token !== 17 /* EOF */) {
        if (skipUntilAfter.indexOf(token) !== -1) {
          scanNext()
          break
        } else if (skipUntil.indexOf(token) !== -1) {
          break
        }
        token = scanNext()
      }
    }
  }
  function parseString(isValue) {
    var value = _scanner.getTokenValue()
    if (isValue) {
      onLiteralValue(value)
    } else {
      onObjectProperty(value)
    }
    scanNext()
    return true
  }
  function parseLiteral() {
    switch (_scanner.getToken()) {
      case 11 /* NumericLiteral */:
        var tokenValue = _scanner.getTokenValue()
        var value = Number(tokenValue)
        if (isNaN(value)) {
          handleError(2 /* InvalidNumberFormat */)
          value = 0
        }
        onLiteralValue(value)
        break
      case 7 /* NullKeyword */:
        onLiteralValue(null)
        break
      case 8 /* TrueKeyword */:
        onLiteralValue(true)
        break
      case 9 /* FalseKeyword */:
        onLiteralValue(false)
        break
      default:
        return false
    }
    scanNext()
    return true
  }
  function parseProperty() {
    if (_scanner.getToken() !== 10 /* StringLiteral */) {
      handleError(3 /* PropertyNameExpected */, [], [2 /* CloseBraceToken */, 5 /* CommaToken */])
      return false
    }
    parseString(false)
    if (_scanner.getToken() === 6 /* ColonToken */) {
      onSeparator(':')
      scanNext() // consume colon
      if (!parseValue()) {
        handleError(4 /* ValueExpected */, [], [2 /* CloseBraceToken */, 5 /* CommaToken */])
      }
    } else {
      handleError(5 /* ColonExpected */, [], [2 /* CloseBraceToken */, 5 /* CommaToken */])
    }
    return true
  }
  function parseObject() {
    onObjectBegin()
    scanNext() // consume open brace
    var needsComma = false
    while (
      _scanner.getToken() !== 2 /* CloseBraceToken */ &&
      _scanner.getToken() !== 17 /* EOF */
    ) {
      if (_scanner.getToken() === 5 /* CommaToken */) {
        if (!needsComma) {
          handleError(4 /* ValueExpected */, [], [])
        }
        onSeparator(',')
        scanNext() // consume comma
        if (_scanner.getToken() === 2 /* CloseBraceToken */ && allowTrailingComma) {
          break
        }
      } else if (needsComma) {
        handleError(6 /* CommaExpected */, [], [])
      }
      if (!parseProperty()) {
        handleError(4 /* ValueExpected */, [], [2 /* CloseBraceToken */, 5 /* CommaToken */])
      }
      needsComma = true
    }
    onObjectEnd()
    if (_scanner.getToken() !== 2 /* CloseBraceToken */) {
      handleError(7 /* CloseBraceExpected */, [2 /* CloseBraceToken */], [])
    } else {
      scanNext() // consume close brace
    }
    return true
  }
  function parseArray() {
    onArrayBegin()
    scanNext() // consume open bracket
    var needsComma = false
    while (
      _scanner.getToken() !== 4 /* CloseBracketToken */ &&
      _scanner.getToken() !== 17 /* EOF */
    ) {
      if (_scanner.getToken() === 5 /* CommaToken */) {
        if (!needsComma) {
          handleError(4 /* ValueExpected */, [], [])
        }
        onSeparator(',')
        scanNext() // consume comma
        if (_scanner.getToken() === 4 /* CloseBracketToken */ && allowTrailingComma) {
          break
        }
      } else if (needsComma) {
        handleError(6 /* CommaExpected */, [], [])
      }
      if (!parseValue()) {
        handleError(4 /* ValueExpected */, [], [4 /* CloseBracketToken */, 5 /* CommaToken */])
      }
      needsComma = true
    }
    onArrayEnd()
    if (_scanner.getToken() !== 4 /* CloseBracketToken */) {
      handleError(8 /* CloseBracketExpected */, [4 /* CloseBracketToken */], [])
    } else {
      scanNext() // consume close bracket
    }
    return true
  }
  function parseValue() {
    switch (_scanner.getToken()) {
      case 3 /* OpenBracketToken */:
        return parseArray()
      case 1 /* OpenBraceToken */:
        return parseObject()
      case 10 /* StringLiteral */:
        return parseString(true)
      default:
        return parseLiteral()
    }
  }
  scanNext()
  if (_scanner.getToken() === 17 /* EOF */) {
    if (options.allowEmptyContent) {
      return true
    }
    handleError(4 /* ValueExpected */, [], [])
    return false
  }
  if (!parseValue()) {
    handleError(4 /* ValueExpected */, [], [])
    return false
  }
  if (_scanner.getToken() !== 17 /* EOF */) {
    handleError(9 /* EndOfFileExpected */, [], [])
  }
  return true
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Parses the given text and returns the object the JSON content represents. On invalid input, the parser tries to be as fault tolerant as possible, but still return a result.
 * Therefore, always check the errors list to find out if the input was valid.
 */
var parse = parse$1

// to be replaced by rollup
let CDN_ROOT = ''
let WASM = ''
function isURL(string) {
  try {
    new URL(string)
    return true
  } catch (_a) {
    return false
  }
}
function joinURL(urlStr, path) {
  const url = new URL(urlStr)
  url.pathname = join(dirpathparts(url.pathname).join('/'), path)
  return url.toString()
}
/**
 * Set the route for loading the assets
 * URL should end with `/`
 *
 * For example:
 * ```ts
 * setCDN('https://unpkg.com/shiki/') // use unpkg
 * setCDN('/assets/shiki/') // serve by yourself
 * ```
 */
function setCDN(root) {
  CDN_ROOT = root
}
/**
 * Explicitly set the source for loading the oniguruma web assembly module.
 *
 * Accepts Url or ArrayBuffer
 */
function setWasm(path) {
  WASM = path
}
let _onigurumaPromise = null
async function getOniguruma() {
  if (!_onigurumaPromise) {
    let loader
    if (typeof WASM === 'string') {
      loader = main.exports.loadWASM({
        data: await fetch(WASM).then(r => r.arrayBuffer())
      })
    } else {
      loader = main.exports.loadWASM(WASM)
    }
    _onigurumaPromise = loader.then(() => {
      return {
        createOnigScanner(patterns) {
          return main.exports.createOnigScanner(patterns)
        },
        createOnigString(s) {
          return main.exports.createOnigString(s)
        }
      }
    })
  }
  return _onigurumaPromise
}
function _resolvePath(filepath) {
  if (!CDN_ROOT) {
    console.warn(
      '[Shiki] no CDN provider found, use `setCDN()` to specify the CDN for loading the resources before calling `getHighlighter()`'
    )
  }
  return `${CDN_ROOT}${filepath}`
}
/**
 * @param filepath assert path related to ./packages/shiki
 */
async function _fetchAssets(filepath) {
  if (isURL(filepath)) {
    return await fetch(filepath).then(r => r.text())
  }
  const path = _resolvePath(filepath)
  return await fetch(path).then(r => r.text())
}
async function _fetchJSONAssets(filepath) {
  const errors = []
  const rawTheme = parse(await _fetchAssets(filepath), errors, {
    allowTrailingComma: true
  })
  if (errors.length) {
    throw errors[0]
  }
  return rawTheme
}
/**
 * @param themePath related path to theme.json
 */
async function fetchTheme(themePath) {
  let theme = await _fetchJSONAssets(themePath)
  const shikiTheme = toShikiTheme(theme)
  if (shikiTheme.include) {
    const includedThemePath = isURL(themePath)
      ? joinURL(themePath, shikiTheme.include)
      : join(dirpathparts(themePath).join('/'), shikiTheme.include)
    const includedTheme = await fetchTheme(includedThemePath)
    if (includedTheme.settings) {
      shikiTheme.settings = includedTheme.settings.concat(shikiTheme.settings)
    }
    if (includedTheme.bg && !shikiTheme.bg) {
      shikiTheme.bg = includedTheme.bg
    }
    if (includedTheme.colors) {
      shikiTheme.colors = Object.assign(Object.assign({}, includedTheme.colors), shikiTheme.colors)
    }
    delete shikiTheme.include
  }
  return shikiTheme
}
function repairTheme(theme) {
  // Has the default no-scope setting with fallback colors
  if (!theme.settings) theme.settings = []
  if (theme.settings[0] && theme.settings[0].settings && !theme.settings[0].scope) {
    return
  }
  // Push a no-scope setting with fallback colors
  theme.settings.unshift({
    settings: {
      foreground: theme.fg,
      background: theme.bg
    }
  })
}
function toShikiTheme(rawTheme) {
  const type = rawTheme.type || 'dark'
  const shikiTheme = Object.assign(
    Object.assign({ name: rawTheme.name, type }, rawTheme),
    getThemeDefaultColors(rawTheme)
  )
  if (rawTheme.include) {
    shikiTheme.include = rawTheme.include
  }
  if (rawTheme.tokenColors) {
    shikiTheme.settings = rawTheme.tokenColors
    delete shikiTheme.tokenColors
  }
  repairTheme(shikiTheme)
  return shikiTheme
}
/**
 * https://github.com/microsoft/vscode/blob/f7f05dee53fb33fe023db2e06e30a89d3094488f/src/vs/platform/theme/common/colorRegistry.ts#L258-L268
 */
const VSCODE_FALLBACK_EDITOR_FG = { light: '#333333', dark: '#bbbbbb' }
const VSCODE_FALLBACK_EDITOR_BG = { light: '#fffffe', dark: '#1e1e1e' }
function getThemeDefaultColors(theme) {
  var _a, _b, _c, _d
  let fg, bg
  /**
   * First try:
   * Theme might contain a global `tokenColor` without `name` or `scope`
   * Used as default value for foreground/background
   */
  let settings = theme.settings ? theme.settings : theme.tokenColors
  const globalSetting = settings
    ? settings.find(s => {
        return !s.name && !s.scope
      })
    : undefined
  if (
    (_a = globalSetting === null || globalSetting === void 0 ? void 0 : globalSetting.settings) ===
      null || _a === void 0
      ? void 0
      : _a.foreground
  ) {
    fg = globalSetting.settings.foreground
  }
  if (
    (_b = globalSetting === null || globalSetting === void 0 ? void 0 : globalSetting.settings) ===
      null || _b === void 0
      ? void 0
      : _b.background
  ) {
    bg = globalSetting.settings.background
  }
  /**
   * Second try:
   * If there's no global `tokenColor` without `name` or `scope`
   * Use `editor.foreground` and `editor.background`
   */
  if (
    !fg &&
    ((_c = theme === null || theme === void 0 ? void 0 : theme.colors) === null || _c === void 0
      ? void 0
      : _c['editor.foreground'])
  ) {
    fg = theme.colors['editor.foreground']
  }
  if (
    !bg &&
    ((_d = theme === null || theme === void 0 ? void 0 : theme.colors) === null || _d === void 0
      ? void 0
      : _d['editor.background'])
  ) {
    bg = theme.colors['editor.background']
  }
  /**
   * Last try:
   * If there's no fg/bg color specified in theme, use default
   */
  if (!fg) {
    fg = theme.type === 'light' ? VSCODE_FALLBACK_EDITOR_FG.light : VSCODE_FALLBACK_EDITOR_FG.dark
  }
  if (!bg) {
    bg = theme.type === 'light' ? VSCODE_FALLBACK_EDITOR_BG.light : VSCODE_FALLBACK_EDITOR_BG.dark
  }
  return {
    fg,
    bg
  }
}

class Registry extends main$1.exports.Registry {
  constructor(_resolver) {
    super(_resolver)
    this._resolver = _resolver
    this.themesPath = 'themes/'
    this._resolvedThemes = {}
    this._resolvedGrammars = {}
  }
  getTheme(theme) {
    if (typeof theme === 'string') {
      return this._resolvedThemes[theme]
    } else {
      return theme
    }
  }
  async loadTheme(theme) {
    if (typeof theme === 'string') {
      if (!this._resolvedThemes[theme]) {
        this._resolvedThemes[theme] = await fetchTheme(
          isURL(theme) ? theme : `${this.themesPath}${theme}.json`
        )
      }
      return this._resolvedThemes[theme]
    } else {
      theme = toShikiTheme(theme)
      if (theme.name) {
        this._resolvedThemes[theme.name] = theme
      }
      return theme
    }
  }
  async loadThemes(themes) {
    return await Promise.all(themes.map(theme => this.loadTheme(theme)))
  }
  getLoadedThemes() {
    return Object.keys(this._resolvedThemes)
  }
  getGrammar(name) {
    return this._resolvedGrammars[name]
  }
  async loadLanguage(lang) {
    const g = await this.loadGrammar(lang.scopeName)
    this._resolvedGrammars[lang.id] = g
    if (lang.aliases) {
      lang.aliases.forEach(la => {
        this._resolvedGrammars[la] = g
      })
    }
  }
  async loadLanguages(langs) {
    for (const lang of langs) {
      this._resolver.addLanguage(lang)
    }
    for (const lang of langs) {
      await this.loadLanguage(lang)
    }
  }
  getLoadedLanguages() {
    return Object.keys(this._resolvedGrammars)
  }
}

function resolveOptions(options) {
  var _a
  let _languages = []
  let _themes = options.themes || []
  if ((_a = options.langs) === null || _a === void 0 ? void 0 : _a.length) {
    _languages = options.langs
  }
  if (options.theme) {
    _themes.unshift(options.theme)
  }
  return { _languages, _themes }
}
async function getHighlighter(options) {
  var _a, _b
  const { _languages, _themes } = resolveOptions(options)
  const _resolver = new Resolver(getOniguruma(), 'vscode-oniguruma')
  const _registry = new Registry(_resolver)
  if ((_a = options.paths) === null || _a === void 0 ? void 0 : _a.themes) {
    _registry.themesPath = options.paths.themes
  }
  if ((_b = options.paths) === null || _b === void 0 ? void 0 : _b.languages) {
    _resolver.languagesPath = options.paths.languages
  }
  const themes = await _registry.loadThemes(_themes)
  const _defaultTheme = themes[0]
  let _currentTheme
  await _registry.loadLanguages(_languages)
  /**
   * Shiki was designed for VS Code, so CSS variables are not currently supported.
   * See: https://github.com/shikijs/shiki/pull/212#issuecomment-906924986
   *
   * Instead, we work around this by using valid hex color codes as lookups in a
   * final "repair" step which translates those codes to the correct CSS variables.
   */
  const COLOR_REPLACEMENTS = {
    '#000001': 'var(--shiki-color-text)',
    '#000002': 'var(--shiki-color-background)',
    '#000004': 'var(--shiki-token-constant)',
    '#000005': 'var(--shiki-token-string)',
    '#000006': 'var(--shiki-token-comment)',
    '#000007': 'var(--shiki-token-keyword)',
    '#000008': 'var(--shiki-token-parameter)',
    '#000009': 'var(--shiki-token-function)',
    '#000010': 'var(--shiki-token-string-expression)',
    '#000011': 'var(--shiki-token-punctuation)',
    '#000012': 'var(--shiki-token-link)'
  }
  function fixCssVariablesTheme(theme, colorMap) {
    theme.bg = COLOR_REPLACEMENTS[theme.bg] || theme.bg
    theme.fg = COLOR_REPLACEMENTS[theme.fg] || theme.fg
    colorMap.forEach((val, i) => {
      colorMap[i] = COLOR_REPLACEMENTS[val] || val
    })
  }
  function getTheme(theme) {
    const _theme = theme ? _registry.getTheme(theme) : _defaultTheme
    if (!_theme) {
      throw Error(`No theme registration for ${theme}`)
    }
    if (!_currentTheme || _currentTheme.name !== _theme.name) {
      _registry.setTheme(_theme)
      _currentTheme = _theme
    }
    const _colorMap = _registry.getColorMap()
    if (_theme.name === 'css-variables') {
      fixCssVariablesTheme(_theme, _colorMap)
    }
    return { _theme, _colorMap }
  }
  function getGrammar(lang) {
    const _grammar = _registry.getGrammar(lang)
    if (!_grammar) {
      throw Error(`No language registration for ${lang}`)
    }
    return { _grammar }
  }
  function codeToThemedTokens(code, lang = 'text', theme, options = { includeExplanation: true }) {
    if (isPlaintext(lang)) {
      const lines = code.split(/\r\n|\r|\n/)
      return [...lines.map(line => [{ content: line }])]
    }
    const { _grammar } = getGrammar(lang)
    const { _theme, _colorMap } = getTheme(theme)
    return tokenizeWithTheme(_theme, _colorMap, code, _grammar, options)
  }
  function codeToHtml(code, arg1 = 'text', arg2) {
    let options
    // codeToHtml(code, options?) overload
    if (typeof arg1 === 'object') {
      options = arg1
    }
    // codeToHtml(code, lang?, theme?) overload
    else {
      options = {
        lang: arg1,
        theme: arg2
      }
    }
    const tokens = codeToThemedTokens(code, options.lang, options.theme, {
      includeExplanation: false
    })
    const { _theme } = getTheme(options.theme)
    return renderToHtml(tokens, {
      fg: _theme.fg,
      bg: _theme.bg,
      lineOptions: options === null || options === void 0 ? void 0 : options.lineOptions
    })
  }
  async function loadTheme(theme) {
    await _registry.loadTheme(theme)
  }
  async function loadLanguage(lang) {
    _resolver.addLanguage(lang)
    await _registry.loadLanguage(lang)
  }
  function getLoadedThemes() {
    return _registry.getLoadedThemes()
  }
  function getLoadedLanguages() {
    return _registry.getLoadedLanguages()
  }
  function getBackgroundColor(theme) {
    const { _theme } = getTheme(theme)
    return _theme.bg
  }
  function getForegroundColor(theme) {
    const { _theme } = getTheme(theme)
    return _theme.fg
  }
  return {
    codeToThemedTokens,
    codeToHtml,
    getTheme: theme => {
      return getTheme(theme)._theme
    },
    loadTheme,
    loadLanguage,
    getBackgroundColor,
    getForegroundColor,
    getLoadedThemes,
    getLoadedLanguages
  }
}
function isPlaintext(lang) {
  return !lang || ['plaintext', 'txt', 'text'].includes(lang)
}

/** @deprecated use setWasm instead, will be removed in a future version */
function setOnigasmWASM(path) {
  setWasm(path)
}

export {
  FontStyle,
  getHighlighter,
  fetchTheme as loadTheme,
  renderToHtml,
  setCDN,
  setOnigasmWASM,
  setWasm,
  toShikiTheme
}
