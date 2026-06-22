# Selene Wallet: Join the Cash Economy!

[![Latest Release](https://git.xulu.tech/selene.cash/selene-wallet/-/badges/release.svg)](https://git.xulu.tech/selene.cash/selene-wallet/-/releases)

Website: https://selene.cash

Documentation: https://docs.selene.cash

We are fulfilling the mission of making Bitcoin Cash (BCH) the [global reserve currency](https://bitcoincashpodcast.com/faqs/Global-Reserve-Currency/what-do-you-mean-global-reserve-currency) by building a sleek, robust, user-friendly wallet that makes joining the BCH economy as easy and compelling as possible.

## Tech Stack

- **React 19** + **TypeScript** — UI framework
- **Vite 5** — Build tooling
- **Capacitor 8** — Cross-platform native bridge (iOS, Android, Web)
- **Redux Toolkit** — State management
- **Tailwind CSS** — Styling
- **sql.js** — SQLite WASM for encrypted local storage
- **libauth** — BCH cryptography and transaction building
- **Electrum protocol** — Blockchain communication over WebSocket

## Developer Quick Start

1. `git clone https://git.xulu.tech/selene.cash/selene-wallet`
2. `cd selene-wallet`
3. `pnpm install`
4. `pnpm dev`
5. http://localhost:5173

### Selene Server

You may also wish to run the [Selene Server](https://git.xulu.tech/selene.cash/selene-server) locally for statistics and other features, but the production server is fine for most purposes.

If you are running Selene Server locally, make sure to update the server URL in `src/apolloClient.tsx`.

## Building for Android

1. Install [Android Studio](https://developer.android.com/studio)
2. `pnpm build && npx cap sync`
3. `npx cap run android`
4. (optional) `npx cap open android` to open the app in Android Studio

## Building for iOS

1. Install [Xcode](https://developer.apple.com/xcode/)
2. `pnpm build && npx cap sync`
3. `npx cap run ios`
4. (optional) `npx cap open ios` to open the app in Xcode

## Desktop (Windows, macOS, Linux)

Pre-built installers are available on the [GitHub Releases](https://github.com/CyberAshven/selene-wallet/releases) page.

| Platform | File |
|----------|------|
| Windows | `.exe` (NSIS installer) |
| macOS | `.dmg` |
| Linux | `.deb` (Ubuntu 22.10+ / Debian 12+) · `.AppImage` (portable) |

### Linux — WebKit dependency

Selene Desktop uses **WebKitGTK** as its rendering engine on Linux. If the app fails to launch, install the required library for your distro:

**Debian / Ubuntu 22.10+** (`.deb` installer handles this automatically via apt):
```bash
sudo apt install libwebkit2gtk-4.1-0
```

**AppImage on Ubuntu 22.04+** (needs fuse2 in addition to WebKit):
```bash
sudo apt install libfuse2 libwebkit2gtk-4.1-0
```

**Arch Linux:**
```bash
sudo pacman -S webkit2gtk-4.1
```

**Other distros (Fedora, openSUSE, etc.):** install `webkit2gtk 4.1` from your package manager. The exact package name varies — search for `webkit2gtk` in your distro's package index.

> **Note:** Ubuntu 22.04 LTS ships `libwebkit2gtk-4.0` (not 4.1) and is not supported. Ubuntu 22.10 or later is required.

### Building desktop locally

```bash
pnpm install
pnpm tauri dev        # development (hot-reload)
pnpm tauri build      # production installer
```

Requires [Rust](https://rustup.rs) and the [Tauri v2 prerequisites](https://tauri.app/start/prerequisites/) for your platform.

## Contribution and Contact

Questions: [Telegram group](https://t.me/SeleneWallet)

Contributors: [Contributing](./CONTRIBUTING.md)

## Dev Notes

### For merging from PRs to mirror

```
$ git remote add gitlabMirror https://gitlab.com/selene.cash/selene-wallet.git
# Replace the merge request number & choose a branch name
$ git fetch gitlabMirror merge-requests/1111111/head:MY_NEW_BRANCH
# Now that branch is local and can be merged as usual
$ git merge MY_NEW_BRANCH
```

### Auto-translations

Manually managing translations got super tiresome and unwieldy with so many languages, so it has been automated.

```
# Use a valid API key
$ GOOGLE_TRANSLATE_API_KEY="XXXXXXXXX" node ./automation/addLanguages.js
# Please read below about the cost of API credits!!
```

Translation files are colocated with the file needing the translation strings. The script scans the entire `src` folder for `.js`/`.jsx` files containing `const translations = {`. For every found file, it finds leaf-level objects containing an `en` key (e.g. `{ en: "Hello" }`), translates into every supported language (skipping any already present), and overwrites the original file with values sorted alphabetically by language key.

Brand names (Bitcoin Cash, Selene, BCH, PIN, CashTokens, etc.) are automatically protected from translation via placeholder substitution. Common HTML entities (`&#39;`, `&quot;`, etc.) are auto-decoded in translated output.

NOTE: Translation string values should not include `:` as it can confuse the parser. Prefer `-` instead.

Translations use the Google Cloud Translation API. It isn't super expensive, but it does cost money per translation. The script skips existing translations and only fills in missing ones, but if you're adding new text please don't run up the bill by running it unnecessarily. Decide on the English versions as part of concluding your feature merge request, prepare the translation files, then run the script once to fill everything out.

There is also an export script so you can give a .txt file to somebody willing to review and update translations in a specific language `node automation/exportTranslations.js es`, which can be reimported using the import script (provide pathname to the updated file).
