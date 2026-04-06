# API Sniper Plugin

**Author:** TestcordDevs.x2b  
**Description:** Detects and logs API keys, tokens, and credentials from chat messages

## Features

- 🔍 **Real-time Detection** - Automatically scans incoming messages for sensitive credentials
- 📝 **Comprehensive Logging** - Saves detected credentials to timestamped text files
- 🔔 **Instant Notifications** - Get notified immediately when credentials are detected
- 📁 **Custom Save Location** - Choose where to save your sniper logs via settings
- 🎯 **Comprehensive Pattern Support** - Detects 80+ credential types:

### Detected Credential Types

#### 🔑 Discord
- Discord tokens (all formats: classic, bot, standard)
- Discord webhook URLs

#### 💻 Development Platforms
- GitHub tokens (PAT, OAuth, App, Refresh, Install, Dependabot)
- GitLab tokens
- Bitbucket tokens
- NPM tokens
- PyPI/Twine tokens

#### ☁️ Cloud Providers
- AWS (Access keys, Secret keys, Account IDs)
- Google Cloud (API keys, OAuth secrets/clients)
- Heroku API keys
- DigitalOcean tokens
- Cloudflare API keys

#### 💳 Payment Services
- Stripe (Secret, Public, Restricted keys)
- PayPal tokens
- Shopify (App, Custom, Private keys)
- Squarespace keys

#### 🤖 AI/ML Services
- OpenAI keys
- Anthropic keys
- Deepseek keys
- Cohere keys
- Mistral keys
- Groq keys
- z.ai keys and similar formats

#### 📧 Email & Messaging
- SendGrid keys
- Mailgun keys/domains
- Slack tokens & webhooks
- Telegram bot tokens
- Twilio keys/accounts

#### 🗄️ Databases
- MongoDB connection strings
- PostgreSQL connection strings
- MySQL connection strings
- Redis connection strings

#### 🔐 Authentication & Security
- JWT tokens
- OAuth tokens
- SSH keys
- Private keys (RSA, EC, DSA, OPENSSH)
- Base64-encoded keys
- Email:password combinations

#### 📊 Analytics & Monitoring
- Firebase keys
- Algolia keys
- Datadog keys
- Figma tokens

#### 🔧 Generic Patterns
- API keys with labels (api_key=, token:, etc.)
- Long alphanumeric strings (40+ chars)
- Keys with common prefixes (sk_, pk_, rk_, tk_, etc.)
- Hex-based keys with dot separators
- Keys embedded in URLs
- Generic secret/token/key declarations
- Base64-encoded strings
- Service-specific key formats

## File Format

Each detected credential is saved to a randomly named `.txt` file with the following format:

```
=== API SNIPER REPORT ===

Username: [sender's username]
User ID: [sender's Discord ID]
Channel ID: [channel where it was sent]
Message ID: [message ID]

Credential Type: [type of credential detected]
Credential Value: [the detected credential]

Timestamp: [local time when detected]

Original Message Content:
---
[full message content]
---

Reported by: TestcordDevs.x2b
```

## Settings

- **Sniper Directory** - Choose where to save credential logs (folder picker in settings)
- **Snipe Own Messages** - Toggle detection in your own messages (default: false)
- **Notification Toggles** - Enable/disable notifications for specific credential types:
  - Discord tokens
  - API keys
  - Email:password combinations
  - Private keys
- **Clear Sniper Logs** - Button to clear all saved credentials
- **Open Sniper Folder** - Quick access button to open the logs directory

## Usage

1. Enable the plugin in Testcord settings
2. Configure your sniper logs directory in the plugin settings
3. The plugin will automatically monitor all incoming messages
4. When credentials are detected, you'll receive a notification
5. Check your sniper logs folder to view all saved credentials

## Security Note

This plugin is designed to help you identify when credentials are accidentally shared in chat. Always handle detected credentials responsibly and never share them with others.

## File Structure

```
apisniper/
├── components/
│   └── FolderSelectInput.tsx  # Folder picker UI component
├── native/
│   └── index.ts               # Native Electron module for file I/O
├── utils/
│   └── constants.ts           # Plugin constants
├── index.tsx                  # Main plugin file with detection logic
├── settings.tsx               # Plugin settings definition
└── styles.css                 # Plugin styles
```
