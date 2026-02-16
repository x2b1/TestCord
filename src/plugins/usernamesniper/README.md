# Usernamesniper

Find available Discord usernames by checking combinations of characters.

## ⚠️ WARNING: This plugin is bannable. Use at your own risk.

## Description

Usernamesniper is a plugin that helps you find available Discord usernames by checking various character combinations. It supports:
- Username lengths from 1 to 32 characters (Discord's maximum)
- Random shuffling to avoid detection patterns
- Adaptive rate limiting for faster checking
- Webhook notifications for found usernames
- Progress tracking during scanning

## Command

```
/snipe-user <length> <notify> <webhook_url>
```

### Parameters

- **length** (required): Number of characters for the username (1-32)
- **notify** (optional, default: true): Show available names in ephemeral messages (only you can see)
- **webhook_url** (optional): Webhook URL to send found usernames to

### Examples

```
/snipe-user 3 true https://discord.com/api/webhooks/...
/snipe-user 5 false
/snipe-user 10 https://discord.com/api/webhooks/...
```

## Features

### Username Generation

- **Character Set**: `a-z`, `0-9`, `.`, `_`
- **Constraints**: Cannot end with `.` or `_`
- **Random Shuffling**: Avoids sequential patterns like "aaa", "aab", "aac"

### Rate Limiting

The plugin uses adaptive rate limiting:
- **Fast Mode**: 10-20ms between requests
- **Normal Mode**: 50-100ms between requests
- **Slow Mode**: 200-500ms between requests
- **Exponential Backoff**: On 429 errors

### Detection Avoidance

- Random shuffling of combinations
- Batch processing with variable delays
- No predictable checking patterns

## Configuration

### Plugin Settings

You can configure the following settings in the plugin settings:

- **Proxy URL**: Optional proxy for username checks
- **Max Parallel Checks**: Maximum concurrent requests (1-50)
- **Batch Size**: Number of names to check in each batch (1-100)
- **Batch Delay**: Delay between batches in milliseconds (10-1000)
- **Check Interval**: Delay between individual checks (1-500ms)
- **Webhook URL**: Webhook URL for notifications
- **Notify in User Messages**: Show ephemeral notifications

## Notes

- The plugin uses your current Discord session to check username availability
- Longer usernames (16+) will take significantly longer to check
- Discord has rate limits, so the plugin will automatically adjust
- The webhook notification feature sends found usernames to your specified webhook

## Limitations

- 4-character usernames have ~1.6 million combinations
- 5-character usernames have ~58 million combinations
- Checking all combinations for longer usernames is impractical
- Focus on shorter lengths (1-8) for best results

## Safety Warning

⚠️ **This plugin is bannable.** Discord may detect and ban users who abuse it. Use responsibly and at your own risk.
