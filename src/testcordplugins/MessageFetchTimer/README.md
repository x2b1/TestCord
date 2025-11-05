# MessageFetchTimer

A Vencord plugin that displays how long it took to fetch messages for the current channel.

## Features

- Displays the message fetch duration in the chat bar.
- Optionally shows time in milliseconds or seconds.
- Customizable icon color.
- Shows how long ago the measurement was taken.

## Settings

| Setting      | Type    | Description                                      | Default     |
|--------------|---------|--------------------------------------------------|-------------|
| Show Icon    | Boolean | Whether to show the fetch time icon              | `true`      |
| Show ms      | Boolean | Whether to show time in milliseconds or seconds  | `true`      |
| Icon Color   | String  | CSS color value for the icon and text            | `#00d166`   |

## Installation

For a guide visit [vencord docs](https://docs.vencord.dev/installing/custom-plugins/).

## Infos

- Measurement begins when switching channels.
- Time is recorded once messages load or are received.
- The timer is shown only if the fetch time has been recorded for the currently open channel.

## Author

GroupXyz

## License

[GPL-3.0-or-later](https://www.gnu.org/licenses/gpl-3.0.html)
