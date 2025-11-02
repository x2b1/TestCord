# Token Display Plugin

This plugin adds a slash command `/mytoken` that allows you to display the token of the currently logged-in Discord account.

## Features

- **Slash command `/mytoken`**: Displays the connected account's token
- **Private response**: The token is displayed only for you (ephemeral)
- **Configurable settings**:
  - Enable/disable the command
  - Allow usage in private messages (DMs)

## Installation

1. Place the `@token` folder in your Vencord plugins directory
2. Restart Vencord or reload the plugins
3. Enable the plugin in the settings

## Usage

1. Type `/mytoken` in any Discord channel
2. Your account's token will be displayed in a private response
3. ⚠️ **Important**: Never share your token with other people!

## Settings

- **Enable /mytoken command**: Enables or disables the command
- **Allow usage in DMs**: Permits the command to be used in private messages

## Security

- The token is displayed only for you (ephemeral response)
- A security warning is included in the response
- The command can be disabled at any time

## Troubleshooting

If the command doesn't work:
1. Check that the plugin is enabled
2. Make sure you're connected to Discord
3. Check the plugin settings
4. Restart Vencord if necessary

## Warning

This plugin displays sensitive information (authentication token). Use it with caution and never share your token with other people.
