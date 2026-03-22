# OpSec - Grammar & Autocorrect Plugin

A Vencord plugin that fixes your grammar, spelling, and punctuation before you send messages. Protect your digital footprint with proper English.

## Features

- **Automatic Grammar Fixes** - Fixes common misspellings and typos
- **Contraction Correction** - Converts `dont` → `don't`, `cant` → `can't`, etc.
- **Punctuation Fixes** - Adds missing periods, fixes quotes, removes extra spaces
- **ALL CAPS Handling** - Converts `HELLO WORLD` → `Hello world.`
- **Sentence Capitalization** - Capitalizes first letter of sentences
- **Possessive Names** - Fixes possessive names like `Aurick` → `Aurick's`
- **Internet Slang** - Converts `idk` → `I don't know`, `wanna` → `want to`
- **Merged Words** - Splits merged words like `gonnakill` → `gonna kill`
- **Context-Aware Correction** - Uses Levenshtein distance to find corrections based on message context (replies, nearby messages)
- **Custom Replacements** - Add your own word replacements

## What It Fixes

### Contractions
| Input | Output |
|-------|--------|
| `dont` | `don't` |
| `cant` | `can't` |
| `wont` | `won't` |
| `im` | `I'm` |
| `youve` | `you've` |
| `theyre` | `they're` |
| `doesnt` | `doesn't` |

### Common Misspellings
| Input | Output |
|-------|--------|
| `teh` | `the` |
| `recieve` | `receive` |
| `seperate` | `separate` |
| `occured` | `occurred` |
| `definately` | `definitely` |
| `trynig` | `trying` |
| `liek` | `like` |

### Internet Slang
| Input | Output |
|-------|--------|
| `idk` | `I don't know` |
| `wanna` | `want to` |
| `gonna` | `going to` |
| `tbh` | `to be honest` |
| `imo` | `in my opinion` |
| `ngl` | `not gonna lie` |

### Merged Words
| Input | Output |
|-------|--------|
| `gonnado` | `gonna do` |
| `gonnakill` | `gonna kill` |
| `wannaplay` | `wanna play` |
| `gottabe` | `gotta be` |
| `trynatalk` | `trying to talk` |

### Punctuation
| Input | Output |
|-------|--------|
| `hello` | `Hello.` |
| `hello world` | `Hello world.` |
| `"text"` | `"text"` (curly quotes) |
| `  hello  ` | `Hello` |
| `!!` | `!` |
| `???` | `?` |

### ALL CAPS
| Input | Output |
|-------|--------|
| `HELLO WORLD` | `Hello world.` |
| `I LOVE THIS` | `I love this.` |

### Custom Replacements
Add your own in settings:
```
zman1064=dumbass
badword=goodword
```

## Installation

1. `git clone https://github.com/Vendicated/Vencord/`
2. `cd Vencord`
3. `cd src`
4. `mkdir userplugins`
5. `git clone https://github.com/your-repo/OpSec`
6. `cd ../` (back to vencord)
7. `pnpm install`
8. `pnpm build`
9. `pnpm inject into stable`

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `enable` | Enable autocorrect | `true` |
| `fixContractions` | Fix contractions (dont → don't) | `true` |
| `fixCapitalization` | Capitalize first letter of sentences | `true` |
| `fixSpaces` | Fix double spaces | `true` |
| `fixQuotes` | Convert straight quotes to curly quotes | `true` |
| `addPeriod` | Add period if sentence has no ending | `true` |
| `customReplacements` | Add custom word replacements | `zman1064=dumbass` |
| `contextualCorrection` | Use context to find corrections | `true` |
| `contextualWindow` | How many messages to scan for context | `5` |

## How It Works

The plugin intercepts messages before they're sent and applies these fixes in order:

1. **Context Collection** - Gets vocabulary from current message and replied-to message
2. **Context Correction** - Uses Levenshtein distance to find similar words in context
3. **Detect ALL CAPS** - If message is all caps, convert to sentence case
4. **Fix Punctuation** - Remove extra punctuation marks
5. **Fix Contractions** - Apply all contraction and misspelling fixes
6. **Custom Replacements** - Apply your custom word replacements
7. **Fix Spaces** - Remove double spaces, trim whitespace
8. **Fix Quotes** - Convert straight quotes to curly quotes
9. **Capitalize** - Capitalize first letter of sentences
10. **Add Period** - Add period if no ending punctuation

## Requirements

- Vencord plugin loader
- Discord desktop app

## Known Issues

The grammar correction is not perfect. Sometimes it may:
- Change words that shouldn't be changed
- Not recognize certain phrases
- Make weird corrections based on context

**If you find any weird grammar issues like:**
- `hello` → `hello'` (posessive when it shouldn't be)
- `im` → `i'm` (lowercase instead of `I'm`)
- Any other weird autocorrection

**Please don't make issues about it.** Just disable the specific setting or the plugin. This is a best-effort grammar correction and will never be perfect.

## Disclaimer

This plugin corrects grammar and spelling. Use responsibly. Some people type weird on purpose and that's okay.

## License

GPL-3.0-or-later

## Credits
This vencord plugin got it's original idea from [Aurick's](https://github.com/aurickk) [Opsec Mod.](https://github.com/aurickk/OpSec) 
And Illegalcord btw for the modded version, bye

Based on [Vencord](https://github.com/Vendicated/Vencord) plugin system.
