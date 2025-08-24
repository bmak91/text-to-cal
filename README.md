# Text to Calendar Extension

Convert event text into downloadable `.ics` calendar files using Google's Gemini AI. Works with flight itineraries, meeting details, hotel bookings, and any event description.

## Features

- **Context Menu**: Right-click selected text to create calendar events
- **Popup Interface**: Click extension icon to manually input event text
- **AI-Powered**: Uses Gemini 2.5 Flash to intelligently parse event details
- **Cross-Browser**: Works in Chrome and Firefox
- **Smart Parsing**: Handles flights, hotels, meetings, concerts, and more
- **Timezone Aware**: Automatically detects and applies correct timezones
- **Rich Events**: Includes location, description, attendees, and reminders

## Installation

### Chrome/Chromium

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this folder

### Firefox

1. Open `about:debugging`
2. Click "This Firefox" tab
3. Click "Load Temporary Add-on"
4. Select `manifest.json` from this folder

## Setup

1. **Get Gemini API Key**:

   - Visit [Google AI Studio](https://aistudio.google.com)
   - Create a new API key
   - Copy the key (starts with `AIza...`)

2. **Configure Extension**:
   - Click the extension icon → "Options"
   - Paste your Gemini API key
   - Optionally change the model (default: `gemini-2.5-flash`)
   - Click "Save"
   - Test the connection with "Test Call"

## Usage

### Method 1: Context Menu

1. Select event text on any webpage
2. Right-click → "Create calendar event"
3. `.ics` file downloads automatically

### Method 2: Popup Interface

1. Click the extension icon
2. Paste or type event description
3. Press `Cmd/Ctrl + Enter` or click "Generate .ics"
4. File downloads to your default folder

## Supported Event Types

The AI can parse various event formats:

- **Flights**: "JetBlue 1908 — Paris (CDG) → New York (JFK) on Dec 15 at 2:30 PM"
- **Hotels**: "Check-in at Park Hyatt Tokyo on March 20-23, 2024"
- **Meetings**: "Team sync every Monday 9-10 AM for 6 weeks"
- **Concerts**: "Taylor Swift concert at SoFi Stadium on Aug 15 at 8 PM"
- **Appointments**: "Dentist appointment on Friday at 2 PM"

## Event Details Generated

Each `.ics` file includes:

- **Summary**: Event title with key details
- **Location**: Venue/address information
- **Description**: Additional details, booking refs, notes
- **Timezone**: Automatically detected from location
- **Attendees**: Email addresses when mentioned
- **Reminders**: Alarms based on event type
- **Recurrence**: For repeating events

## Browser Compatibility

| Feature            | Chrome | Firefox |
| ------------------ | ------ | ------- |
| Context Menu       | ✅     | ✅      |
| Popup Interface    | ✅     | ✅      |
| Notifications      | ✅     | ✅      |
| Downloads          | ✅     | ✅      |
| MV3 Service Worker | ✅     | ✅      |

**Minimum Versions**:

- Chrome: 88+
- Firefox: 109+

## Troubleshooting

### "Missing Gemini API key"

- Open extension options and add your API key
- Ensure the key is valid and has quota remaining

### "Failed to create .ics"

- Check your internet connection
- Verify the API key is correct
- Try simpler event text

### Notifications not showing

- Check browser notification permissions
- Ensure system notifications are enabled
- Try the "Test Notification" button in options

### Downloads not working

- Check browser download settings
- Ensure popup blockers are disabled
- Verify file permissions in download folder

## Privacy & Security

- API keys are stored locally in browser sync storage
- No data is sent to servers except Gemini API calls
- Event text is processed by Google's Gemini service
- No personal data is logged or stored

## Development

### Project Structure

```
├── manifest.json          # Extension configuration
├── background.js          # Service worker & core logic
├── popup.html/js          # Extension popup interface
├── options.html/js        # Settings page
└── icons/                 # Extension icons
```

### Key Files

- `background.js`: Handles context menu, downloads, Gemini API calls
- `popup.js`: Manages popup UI and messaging
- `options.js`: Settings page with API key management

### Building

No build process required. Load directly as unpacked extension.

## License

MIT License - see LICENSE file for details.

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Verify browser compatibility
3. Test with the "Test Call" button in options
4. Ensure your Gemini API key has sufficient quota

---
