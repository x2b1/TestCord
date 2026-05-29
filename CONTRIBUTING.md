# Introduction

> [!NOTE]
> **AI Usage Notice**
>
> Your contribution UNLIKE equicord, can be vibecoded as long as the code isn't shit.
> Also please don't AI generate pull request names.

> [!IMPORTANT]
> All contributions must follow our [Code of Conduct](./CODE_OF_CONDUCT.md).

## How to contribute

Contributions are submitted through pull requests. If you are new to Git or GitHub, we recommend reading [this guide](https://opensource.com/article/19/7/create-pull-request-github).

Pull requests are made either to the main or dev branch, personally unlike equicord, we prefer you to pull request to dev as I (x2b) only use the dev branch, the other owners use main, meaning if something breaks accidentally I'll be the only one affected.

## Writing a Plugin

Developing a plugin is the primary way to contribute.

Before starting your plugin:

- Consider if this plugin would be useful to a large portion of the userbase. We do not accept niche plugins
- Check existing pull requests to see if someone is already working on a similar plugin
- Familarise yourself with our plugin rules below to ensure your plugin is not banned

- Join our Discord server.
- Check existing pull requests to avoid duplicate work.
- If no request exists, open one and clearly state that you want to work on it yourself.
- Wait for feedback before starting development, as some ideas may not be accepted or may need adjustments.
- Familiarize yourself with the plugin rules below.

> [!WARNING]
> Skipping these steps may result in your plugin being rejected, even if it is technically correct.

## Plugin Rules

To keep TestCord stable, secure and maintainable, all plugins must follow these rules:

1. No simple slash-command plugins (e.g. `/cat`). If applicable, create a [user-installable Discord app](https://discord.com/developers/docs/change-log#userinstallable-apps-preview) instead. (negotiable)
2. No raw DOM manipulation — always use proper patches and React. (negotiable)
3. No plugins that only hide or redesign UI elements (use CSS for that). This rule may be negotiable.

**Plugins that violate any of these rules will not be accepted.**

## Improving Testcord Itself

If you want to improve Testcord beyond plugins, such as internal features or performance improvements, you are welcome to open a feature request so it can be discussed.

Bug fixes, refactors, and documentation improvements are also highly appreciated!
