import { IRawThemeSetting, IRawGrammar, IRawTheme } from 'vscode-textmate';

declare enum FontStyle {
    NotSet = -1,
    None = 0,
    Italic = 1,
    Bold = 2,
    Underline = 4
}

interface IThemedTokenScopeExplanation {
    scopeName: string;
    themeMatches: IRawThemeSetting[];
}
interface IThemedTokenExplanation {
    content: string;
    scopes: IThemedTokenScopeExplanation[];
}
/**
 * A single token with color, and optionally with explanation.
 *
 * For example:
 *
 * {
 *   "content": "shiki",
 *   "color": "#D8DEE9",
 *   "explanation": [
 *     {
 *       "content": "shiki",
 *       "scopes": [
 *         {
 *           "scopeName": "source.js",
 *           "themeMatches": []
 *         },
 *         {
 *           "scopeName": "meta.objectliteral.js",
 *           "themeMatches": []
 *         },
 *         {
 *           "scopeName": "meta.object.member.js",
 *           "themeMatches": []
 *         },
 *         {
 *           "scopeName": "meta.array.literal.js",
 *           "themeMatches": []
 *         },
 *         {
 *           "scopeName": "variable.other.object.js",
 *           "themeMatches": [
 *             {
 *               "name": "Variable",
 *               "scope": "variable.other",
 *               "settings": {
 *                 "foreground": "#D8DEE9"
 *               }
 *             },
 *             {
 *               "name": "[JavaScript] Variable Other Object",
 *               "scope": "source.js variable.other.object",
 *               "settings": {
 *                 "foreground": "#D8DEE9"
 *               }
 *             }
 *           ]
 *         }
 *       ]
 *     }
 *   ]
 * }
 *
 */
interface IThemedToken {
    /**
     * The content of the token
     */
    content: string;
    /**
     * 6 or 8 digit hex code representation of the token's color
     */
    color?: string;
    /**
     * Font style of token. Can be None/Italic/Bold/Underline
     */
    fontStyle?: FontStyle;
    /**
     * Explanation of
     *
     * - token text's matching scopes
     * - reason that token text is given a color (one matching scope matches a rule (scope -> color) in the theme)
     */
    explanation?: IThemedTokenExplanation[];
}

interface HighlighterOptions {
    /**
     * The theme to load upfront.
     */
    theme?: IThemeRegistration;
    /**
     * A list of themes to load upfront.
     *
     * Default to: `['dark-plus', 'light-plus']`
     */
    themes?: IThemeRegistration[];
    /**
     * A list of languages to load upfront.
     *
     * Default to `['html', 'css', 'javascript']`
     */
    langs?: ILanguageRegistration[];
    /**
     * Paths for loading themes and langs. Relative to the package's root.
     */
    paths?: IHighlighterPaths;
}
interface Highlighter {
    /**
     * Convert code to HTML tokens.
     * `lang` and `theme` must have been loaded.
     * @deprecated Please use the `codeToHtml(code, options?)` overload instead.
     */
    codeToHtml(code: string, lang?: string, theme?: string, options?: HtmlOptions): string;
    /**
     * Convert code to HTML tokens.
     * `lang` and `theme` must have been loaded.
     */
    codeToHtml(code: string, options?: HtmlOptions): string;
    /**
     * Convert code to themed tokens for custom processing.
     * `lang` and `theme` must have been loaded.
     * You may customize the bundled HTML / SVG renderer or write your own
     * renderer for another render target.
     */
    codeToThemedTokens(code: string, lang?: string, theme?: string, options?: ThemedTokenizerOptions): IThemedToken[][];
    /**
     * Get the loaded theme
     */
    getTheme(theme?: IThemeRegistration): IShikiTheme;
    /**
     * Load a theme
     */
    loadTheme(theme: IThemeRegistration): Promise<void>;
    /**
     * Load a language
     */
    loadLanguage(lang: ILanguageRegistration | string): Promise<void>;
    /**
     * Get all loaded themes
     */
    getLoadedThemes(): string[];
    /**
     * Get all loaded languages
     */
    getLoadedLanguages(): string[];
    /**
     * Get the foreground color for theme. Can be used for CSS `color`.
     */
    getForegroundColor(theme?: string): string;
    /**
     * Get the background color for theme. Can be used for CSS `background-color`.
     */
    getBackgroundColor(theme?: string): string;
}
interface IHighlighterPaths {
    /**
     * @default 'themes/'
     */
    themes?: string;
    /**
     * @default 'languages/'
     */
    languages?: string;
}
type ILanguageRegistration = {
    id: string;
    scopeName: string;
    aliases?: string[];
    samplePath?: string;
    /**
     * A list of languages the current language embeds.
     * If manually specifying languages to load, make sure to load the embedded
     * languages for each parent language.
     */
    embeddedLangs?: string[];
} & ({
    path: string;
    grammar?: IRawGrammar;
} | {
    path?: string;
    grammar: IRawGrammar;
});
type IThemeRegistration = IShikiTheme | string;
interface IShikiTheme extends IRawTheme {
    /**
     * @description theme name
     */
    name: string;
    /**
     * @description light/dark theme
     */
    type: 'light' | 'dark';
    /**
     * @description tokenColors of the theme file
     */
    settings: IRawThemeSetting[];
    /**
     * @description text default foreground color
     */
    fg: string;
    /**
     * @description text default background color
     */
    bg: string;
    /**
     * @description relative path of included theme
     */
    include?: string;
    /**
     *
     * @description color map of the theme file
     */
    colors?: Record<string, string>;
}
interface HtmlOptions {
    lang?: string;
    theme?: string;
    lineOptions?: LineOption[];
}
interface LineOption {
    /**
     * 1-based line number.
     */
    line: number;
    classes?: string[];
}
interface ThemedTokenizerOptions {
    /**
     * Whether to include explanation of each token's matching scopes and
     * why it's given its color. Default to false to reduce output verbosity.
     */
    includeExplanation?: boolean;
}

declare function getHighlighter(options: HighlighterOptions): Promise<Highlighter>;

interface HtmlRendererOptions {
    langId?: string;
    fg?: string;
    bg?: string;
    lineOptions?: LineOption[];
}
declare function renderToHtml(lines: IThemedToken[][], options?: HtmlRendererOptions): string;

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
declare function setCDN(root: string): void;
/**
 * Explicitly set the source for loading the oniguruma web assembly module.
 *
 * Accepts Url or ArrayBuffer
 */
declare function setWasm(path: string | ArrayBuffer): void;
/**
 * @param themePath related path to theme.json
 */
declare function fetchTheme(themePath: string): Promise<IShikiTheme>;
declare function toShikiTheme(rawTheme: IRawTheme): IShikiTheme;

/** @deprecated use setWasm instead, will be removed in a future version */
declare function setOnigasmWASM(path: ArrayBuffer): void;

export { FontStyle, Highlighter, HighlighterOptions, HtmlRendererOptions, ILanguageRegistration, IShikiTheme, IThemeRegistration, IThemedToken, getHighlighter, fetchTheme as loadTheme, renderToHtml, setCDN, setOnigasmWASM, setWasm, toShikiTheme };
