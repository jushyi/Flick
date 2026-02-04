# Environment Setup

This guide walks you through setting up your development environment for React Native development.

## Required Software

### 1. Node.js (v18 or later)

**macOS:**

```bash
# Using Homebrew
brew install node

# Verify installation
node --version  # Should show v18.x.x or higher
npm --version
```

**Windows:**
Download from [nodejs.org](https://nodejs.org/) and run the installer.

### 2. Git

**macOS:**

```bash
# Usually pre-installed, or:
brew install git

# Configure your identity
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

**Windows:**
Download from [git-scm.com](https://git-scm.com/) and run the installer.

### 3. Code Editor

We recommend [VS Code](https://code.visualstudio.com/) with these extensions:

- ES7+ React/Redux/React-Native snippets
- Prettier - Code formatter
- ESLint

### 4. Expo Go App (on your device)

You'll run the app on your physical device, not a simulator.

**iOS:**

1. Download "Expo Go" from the App Store
2. Sign in with your Expo account (or create one)

**Android:**

1. Download "Expo Go" from the Google Play Store
2. Sign in with your Expo account (or create one)

> **Note:** Your device must be registered with the project's Expo build. Contact the project owner to add your device if you haven't already.

## Project Setup

### Clone the Repository

```bash
cd ~/Projects  # or your preferred location
git clone [repository-url]
cd "Lapse Clone"
```

### Install Dependencies

```bash
npm install
```

This may take a few minutes. You should see no errors at the end.

### Start the Development Server

```bash
npx expo start
```

You'll see a QR code in the terminal.

**To run on your device:**

1. Make sure your phone is on the same WiFi network as your computer
2. Open the Expo Go app on your device
3. Scan the QR code:
   - **iOS:** Use the Camera app, then tap the Expo notification
   - **Android:** Use the scanner built into Expo Go

### Verify It Works

You should see the Rewind app load with:

- A camera interface or feed screen
- Bottom tab navigation
- Dark theme throughout

**Troubleshooting:**

| Issue                         | Solution                                                   |
| ----------------------------- | ---------------------------------------------------------- |
| "command not found: npx"      | Reinstall Node.js                                          |
| QR code won't scan            | Ensure phone and computer are on the same WiFi network     |
| "Unable to connect" on device | Try running `npx expo start --tunnel`                      |
| App crashes on open           | Your device may need to be added to the Expo build profile |
| Metro bundler crashes         | Delete `node_modules` and run `npm install` again          |

## Development Workflow

### Hot Reload

When you save a file, the app automatically reloads. This is called "hot reload" and makes development fast.

### Viewing Logs

In the terminal where Expo is running, you'll see:

- Console.log output from your code
- Error messages with stack traces
- Network requests (in verbose mode)

### Stopping the Server

Press `Ctrl+C` in the terminal to stop Expo.

---

**Next:** [01-CODEBASE-TOUR.md](./01-CODEBASE-TOUR.md) - Understanding the project structure
