# Message Scheduler

A Vencord plugin that allows you to schedule Discord messages to be sent at a specific time or after a delay.

## Features

- Schedule messages to be sent later using relative time (e.g., "1h30m", "2d", "45s") or exact time (e.g., "3:30pm", "15:45")
- List all scheduled messages for the current channel
- Cancel scheduled messages
- Optional notifications when messages are scheduled and sent

## Commands

### `/schedule`
Schedule a message to be sent later.

**Options:**
- `message`: The message content to send
- `time`: When to send the message (e.g., "1h30m", "3:30pm")

### `/scheduled`
List all scheduled messages for the current channel.

### `/cancel-scheduled`
Cancel a scheduled message.

**Options:**
- `index`: The index of the message to cancel (use `/scheduled` to see indices)

## Settings

- **Show Notifications**: Toggle notifications when messages are scheduled and sent

## Notes

- Scheduled messages are cleared when the plugin is disabled
- Times specified as exact times (like "3:30pm") that are in the past will be scheduled for the next day
- Relative time format supports days (d), hours (h), minutes (m), and seconds (s)

## Examples

- `/schedule message: Hello world! time: 30m` - Send "Hello world!" in 30 minutes
- `/schedule message: Good morning! time: 8:00am` - Send "Good morning!" at 8:00 AM
- `/schedule message: Meeting reminder time: 1h15m` - Send "Meeting reminder" in 1 hour and 15 minutes
