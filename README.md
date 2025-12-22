# [`<img src="./browser/icon.png" width="40" align="left" alt="Testcord">`](https://github.com/x2b1/Testcord) Testcord

[![Equibop](https://img.shields.io/badge/Equibop-grey?style=flat)](https://github.com/Equicord/Equibop)
[![Tests](https://github.com/Equicord/Equicord/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/Equicord/Equicord/actions/workflows/test.yml)
[![Discord](https://img.shields.io/discord/1173279886065029291.svg?color=768AD4&label=Discord&logo=discord&logoColor=white)](https://equicord.org/discord)

Testcord is a fork of [Equicord](https://github.com/Equicord/Equicord) which is a fork of [Vencord](https://github.com/Vendicated/Vencord), with over 480 plugins.

You can join our [Discord server](https://discord.gg/6gXfZjcFxH) for commits, changes, chatting, or even support.

### Included Plugins

Equicord's included plugins can be found [here](https://equicord.org/plugins), We currently don't have a website.

## Installing / Uninstalling

Windows - currently unsupported (this downloads Equicord)

- [GUI](https://github.com/Equicord/Equilotl/releases/latest/download/Equilotl.exe)
- [CLI](https://github.com/Equicord/Equilotl/releases/latest/download/EquilotlCli.exe)

MacOS - currently unsupported (this downloads Equicord)

- [GUI](https://github.com/Equicord/Equilotl/releases/latest/download/Equilotl.MacOS.zip)

Linux - currently unsupported (this downloads Equicord)

- [GUI](https://github.com/Equicord/Equilotl/releases/latest/download/Equilotl-x11)
- [CLI](https://github.com/Equicord/Equilotl/releases/latest/download/EquilotlCli-Linux)
- [AUR](https://aur.archlinux.org/packages?O=0&K=equicord)

```shell - currently unsupported (this downloads Equicord)
sh -c "$(curl -sS https://raw.githubusercontent.com/Equicord/Equicord/refs/heads/main/misc/install.sh)"
```

## Installing Testcord Devbuild - only working option for now

### Dependencies

[Git](https://git-scm.com/download) and [Node.JS LTS](https://nodejs.dev/en/) are required.

Install `pnpm`:

> ❗️ This next command may need to be run as admin/root depending on your system, and you may need to close and reopen your terminal for pnpm to be in your PATH.

```shell
npm i -g pnpm
```

> ❗️ **IMPORTANT** Make sure you aren't using an admin/root terminal from here onwards. It **will** mess up your Discord/Equicord instance and you **will** most likely have to reinstall.

Clone Equicord:

```shell
git clone https://github.com/x2b1/Testcord
cd Testcord
```

Install dependencies:

```shell
pnpm install --frozen-lockfile
```

Build Equicord:

```shell
pnpm build
```

You can also build dev (additional plugins) (not required):
```shell
pnpm dev
```

Inject Testcord into your desktop client:

```shell
pnpm inject
```

Build Testcord for web:

```shell
pnpm buildWeb
```

After building Testcord's web extension, locate the appropriate ZIP file in the `dist` directory and follow your browser’s guide for installing custom extensions, if supported.

Note: Firefox extension zip requires Firefox for developers

## Credits

Thank you to [Thororen](https://github.com/thororen1234) for creating [Equicord](https://github.com/Equicord/Equicord) & [Vendicated](https://github.com/Vendicated) for creating [Vencord](https://github.com/Vendicated/Vencord) & [Suncord](https://github.com/verticalsync/Suncord) by [verticalsync](https://github.com/verticalsync).

## Star History

<a href="https://www.star-history.com/#x2b1/Testcord&type=date&legend=bottom-right">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=x2b1/Testcord&type=date&theme=dark&legend=bottom-right" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=x2b1/Testcord&type=date&legend=bottom-right" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=x2b1/Testcord&type=date&legend=bottom-right" />
 </picture>
</a>

## Disclaimer

Discord is trademark of Discord Inc., and solely mentioned for the sake of descriptivity.
Mentioning it does not imply any affiliation with or endorsement by Discord Inc.
Testcord isnt affiliated with Equicord or Vencord!

<details>
<summary>Using Testcord, Equicord or Vencord violates Discord's terms of service</summary>

Client modifications are against Discord’s Terms of Service.

However, Discord is pretty indifferent about them and there are little to no known cases of users getting banned for using client mods! So you should generally be fine if you don’t use plugins that implement abusive behaviour (e.g. Selfbots, message deleter, dynamic status...). But no worries, most inbuilt plugins are safe to use, unless stated otherwise in the plugin description!

Regardless, if your account is essential to you and getting disabled would be a disaster for you, you should probably not use any client mods (not exclusive to Testcord), just to be safe.

Additionally, make sure not to post screenshots with Testcord in a server where you might get banned for it.
Server owners often don't like people using client mods since it might give you some advantages or it might make trolling easier, so in most cases the owner won't risk it and just ban you.

</details>
