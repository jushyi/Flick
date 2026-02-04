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

### 4. iOS Simulator (macOS only)

1. Install Xcode from the App Store
2. Open Xcode, accept the license agreement
3. Go to Xcode → Preferences → Locations → Command Line Tools (select the latest)
4. Run in terminal:
   ```bash
   xcode-select --install
   ```

### 5. Android Emulator (Windows/macOS/Linux)

1. Download [Android Studio](https://developer.android.com/studio)
2. During installation, ensure "Android Virtual Device" is checked
3. After installation:
   - Open Android Studio
   - Go to Tools → Device Manager
   - Create a new virtual device (Pixel 6, API 33 recommended)

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

You'll see a QR code and menu options:

- Press `i` to open iOS Simulator
- Press `a` to open Android Emulator

### Verify It Works

You should see the Rewind app load with:

- A camera interface or feed screen
- Bottom tab navigation
- Dark theme throughout

**Troubleshooting:**

| Issue                        | Solution                                          |
| ---------------------------- | ------------------------------------------------- |
| "command not found: npx"     | Reinstall Node.js                                 |
| iOS Simulator won't open     | Ensure Xcode Command Line Tools are installed     |
| Android emulator won't start | Check Android Studio → Device Manager             |
| Metro bundler crashes        | Delete `node_modules` and run `npm install` again |

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
