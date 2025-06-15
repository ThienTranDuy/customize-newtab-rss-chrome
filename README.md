# Medium RSS New Tab Chrome Extension

A Chrome extension that displays Medium RSS feeds in your new tab page.

## Features

- Display Medium RSS feeds in a beautiful grid layout
- Customizable RSS feed URL
- Responsive design
- Image preview for articles
- Save your preferred RSS feed URL

## Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory

## Usage

1. After installation, open a new tab
2. Enter your Medium RSS feed URL in the input field
   - You can get your Medium RSS feed URL by adding `/feed` to any Medium publication URL
   - Example: `https://medium.com/feed/your-publication`
3. Click "Save" to store your RSS feed URL
4. The articles will be displayed in a grid layout
5. Click on any article to read it on Medium

## Note

This extension uses a CORS proxy (allorigins.win) to fetch RSS feeds. If you experience any issues, please make sure your RSS feed URL is correct and accessible.

## License

MIT License 