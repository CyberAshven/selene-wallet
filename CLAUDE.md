# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

Selene Wallet is a self-custodial Bitcoin Cash (BCH) wallet built with React 19, Vite 5, and Capacitor 8 for cross-platform mobile deployment. Uses SQLite (sql.js) for storage with native encryption, Electrum protocol over WebSocket for blockchain communication.

- **Repository:** https://git.xulu.tech/selene.cash/selene-wallet
- **Website:** https://selene.cash
- **Docs:** https://docs.selene.cash

## Commands

```bash
# Development
pnpm install          # Install deps (pnpm enforced)
pnpm dev              # Dev server at localhost:5173
pnpm lint             # Prettier + ESLint
pnpm pretty           # Auto-format
pnpm test             # Lint + Vitest
pnpm vitest           # Tests in watch mode
pnpm build            # Production build

# Capacitor Plugin (standalone repo: git.xulu.tech/selene.cash/capacitor-plugin-simple-encryption)
# Plugin is consumed as a git dependency. To update after upstream changes:
pnpm update capacitor-plugin-simple-encryption
# To pin a specific version tag:
#   "capacitor-plugin-simple-encryption": "https://git.xulu.tech/selene.cash/capacitor-plugin-simple-encryption.git#v0.1.0"

# Mobile
pnpm build && npx cap sync && npx cap run ios
pnpm build && npx cap sync && npx cap run android
npx cap open ios      # Open Xcode
npx cap open android  # Open Android Studio

# GitLab
glab issue view <n> --repo selene.cash/selene-wallet
glab mr view <n> --repo selene.cash/selene-wallet
./scripts/gitlab-sync.sh       # Refresh .claude/gitlab-state.md
glab issue close <n> --repo selene.cash/selene-wallet  # Close issue
```

## Build Targets

| Platform | Target |
|----------|--------|
| Vite/esbuild | es2020, chrome87, safari14, firefox78, edge88 |
| TypeScript | esnext (lib: dom, dom.iterable, esnext) |
| Android | minSdk 26, compileSdk 36, targetSdk 36 |
| iOS | deployment target 15.0, iPhone + iPad |

**Important:** Do NOT use ES2022+ features that require runtime support (e.g., `Error.cause` constructor option, `Array.at()`, `Object.hasOwn()`). The Vite build target is es2020/chrome87/safari14 — features beyond this are silently broken on older WebViews. TypeScript lib is esnext for type checking only; it does not polyfill runtime behavior.

## Architecture

### Initialization Flow (AppProvider)

Boot lifecycle is managed by `AppProvider.tsx` as a React context with phase-based state machine:

```
Phases: PREFLIGHT → LOCKED or MIGRATING → RUNNING ↔ PAUSED → STARTUP_ERROR

coldStart() [mount effect]:
  JanitorService.fsck() → redux_pre_init()
  → SecurityService().initEncryption()
  → shouldLock? → LOCKED (show AppLockScreen)
  → else → MIGRATING → boot()

boot() [called from coldStart or after unlock]:
  DatabaseService().openAppDatabase()
  → JanitorService().migrateLegacyDatabases()
  → JanitorService().recoverWalletFiles()
  → JanitorService().handleAuthMigration()
  → redux_init() → redux_resume() → RUNNING

Pause/Resume:
  handlePause(): RUNNING → PAUSED (if auth required) + redux_pause() + securePause()
  handleResume(): PAUSED → LOCKED (re-auth), RUNNING → redux_resume()
```

**AppProvider gates the UI:** Renders `AppLockScreen` (PIN/biometric) when LOCKED/PAUSED, `ErrorBoundary` on STARTUP_ERROR, splash during PREFLIGHT/MIGRATING, or the full app when RUNNING. Pre-auth screens use `LockScreenWrapper` (no router context); full app uses `RouterProvider`.

### State Management (Redux Toolkit)

Slices in `src/redux/`:
- **wallet.ts** - Active wallet, balances, addresses, UTXOs
- **sync.ts** - Electrum connection, blockchain sync status
- **preferences.ts** - User settings (theme, currency, language, network, encryption)
- **device.ts** - Platform info, scanner state, network status
- **txHistory.ts** - Transaction history with filtering
- **exchangeRates.ts** - BCH/fiat rates
- **walletConnect.ts** - WalletConnect v2 sessions
- **stats.js** - User stats, check-ins

### Services (src/kernel/)

Singleton pattern via function calls (always available, no initialization order dependency). Organized into subdirectories:

**`kernel/app/`** - Core application services:

| Service | Purpose |
|---------|---------|
| AppProvider.tsx | React boot context — manages boot lifecycle, encryption readiness, app state |
| ConsoleService.ts | Debug console |
| DatabaseService.ts | SQLite management (sql.js), encryption, re-encryption |
| JanitorService.ts | Filesystem recovery, migrations, fsck, nuclear wipe |
| LogService.ts | Console logging |
| ModalService.tsx | In-app modal system (replaced Capacitor Dialog) |
| NotificationService.tsx | In-app toast notifications |
| SecurityService.ts | PIN/biometric auth, encryption state authority |

**`kernel/bch/`** - Blockchain services:

| Service | Purpose |
|---------|---------|
| BcmrService.tsx | Token metadata (BCMR) |
| BlockchainService.ts | Block management |
| CauldronService.ts | Cauldron DEX |
| CurrencyService.tsx | Exchange rate management |
| ElectrumService.ts | Electrum WebSocket client |
| TransactionBuilderService.ts | Build BCH transactions (UTXO selection, fees) |
| TransactionManagerService.ts | Broadcast, resolution, optimistic UTXO updates, parameterized SQL |
| WalletConnectService.tsx | WalletConnect v2 |

**`kernel/wallet/`** - Wallet services:

| Service | Purpose |
|---------|---------|
| AddressManagerService.ts | Address derivation |
| AddressScannerService.ts | Gap-limit address scanning |
| KeyManagerService.ts | BIP39/BIP44 key derivation |
| TokenManagerService.ts | CashToken management |
| TransactionExportService.ts | Export to CSV/PDF |
| TransactionHistoryService.ts | Tx history queries |
| UtxoManagerService.ts | UTXO tracking, balance calculations |
| WalletManagerService.ts | Wallet CRUD, hashing, activation |

### Encryption Architecture

**Plugin:** `plugins/capacitor-plugin-simple-encryption/` (Capacitor plugin, iOS + Android + web stub)

```
SecurityService (authority)          ← UI, AppProvider, Main.jsx
  └→ DatabaseService (state holder)  ← getEncryptionState(), setEncryptionPinConfigured()
       └→ SimpleEncryption plugin    ← native iOS/Android AES-256-GCM
```

**SecurityService** is the authoritative API for encryption/auth state. All consumers use SecurityService — never call `getEncryptionState()` or `setEncryptionPinConfigured()` directly outside SecurityService.

**SecurityService public API:**
- `isEncryptionReady()` — Is the encryption key loaded and ready?
- `isPinConfigured()` — Is a PIN set in the encryption plugin?
- `setPinConfigured(value)` — Update PIN configuration state
- `authorize(action)` — Authorize user per their preference (bio/pin/none)
- `authorizeBio(action)` — Biometric authorization specifically

**SimpleEncryption plugin capabilities:**
- PIN-derived key via PBKDF2 (100k iterations for unlock, 600k for backup export)
- Biometric unlock via platform keychain/keystore
- `loadKeyIntoMemory` for biometric unlock without exposing key to JS
- Key export/import for encrypted backup and recovery
- Brute-force lockout with exponential backoff (persistent across restarts)
- Secure key zeroing in memory after use
- Nuclear reset (wipe all keys and data)
- Web stub provides no-op encryption (development only)

**Database encryption:**
- On native: all `.db` files encrypted via plugin before writing to filesystem
- Auto-detect: encrypted files have base64-encoded SQLite header, legacy files have CSV header
- Atomic flush: write-to-temp-then-rename prevents corruption
- Re-encryption: full data migration when importing a new encryption key
- `DecryptionFailedError` propagated (not silently creating empty DB)

### Transaction Flow

```
User initiates send
  → TransactionBuilderService.buildTransaction() (UTXO selection, fees)
  → KeyManagerService.signInputs() (key derivation, signing)
  → ElectrumService.broadcastTransaction()
  → TransactionManagerService.resolveTransaction() (poll confirmation)
```

### Storage

```
/selene/db/app.db              # Shared: wallets, blocks, bcmr_registries (encrypted on native)
/selene/db/{walletHash}.db     # Per-wallet: addresses, utxos, tokens, transactions (encrypted)
/selene/blocks/{blockhash}.raw # Raw block hex
/selene/wallets/{walletHash}.json  # Wallet backup files
```

Android backup exclusion rules prevent cloud sync of encryption keys (`android/app/src/main/res/xml/backup_rules.xml`).

### Component Organization

```
src/components/
├── layout/     # MainLayout, BottomNavigation, ViewHeader, ErrorBoundary.tsx,
│               # BottomButtons, FullColumn, NavTab
├── atoms/      # Button, Card, Address, TokenIcon, Satoshi, ~30 components
├── composite/  # TokenCard
└── views/      # Page-level (lazy-loaded)
    ├── wallet/   # home, send, pay, sweep, history
    ├── vendor/   # VendorModeView, VendorNumpad (landscape POS mode)
    ├── assets/   # tokens, NFTs, coins, addresses, token detail
    ├── explore/  # search, transactions, contacts, map
    ├── security/ # AppLockScreen.tsx, ForgotPinScreen.tsx (pre-auth, no router)
    ├── settings/ # SecuritySettings, currency, network, intl, qrcode, privacy,
    │             # payment, UI, wallet settings
    ├── apps/     # afog, blaze, bliss, cauldron, intro, price,
    │             # qrgen, stats, walletconnect
    ├── debug/    # console, settings
    └── credits/  # CreditsView
```

**Pre-auth views** (`views/security/`): `AppLockScreen` and `ForgotPinScreen` render outside the router using `LockScreenWrapper` (shared layout component with optional back button). They cannot use `ViewHeader` or any hook requiring router context.

### Import Aliases (vite.config.js)

- `@/` → `src/`
- `@/layout` → `src/components/layout`
- `@/views` → `src/components/views`
- `@/atoms` → `src/components/atoms`
- `@/icons` → `src/components/atoms/icons`
- `@/apps` → `src/components/views/apps`
- `@/composite` → `src/components/composite`

## Code Conventions

### Naming

- **Files:** PascalCase for components/services, camelCase for utils/redux
- **Functions:** camelCase (`satsToBch`, `validateBip21Uri`)
- **Variables:** camelCase; UPPER_CASE for constants
- **Booleans:** Must prefix with `is`, `should`, `has`, `can`, `did`, `will`
- **Types:** StrictPascalCase (`WalletEntity`, `ButtonProps`)
- **Private members:** Leading underscore (`_database`)
- **Boundary conversions:** `normalize*` prefix (`normalizeAddress`, `normalizeTransaction`, `normalizeUtxo`) for converting wire/DB formats to canonical internal types

### Formatting

- Prettier enforced (80 char width, 2 spaces, double quotes, semicolons)
- ESLint: Airbnb + TypeScript + Prettier
- Strict equality only (`===`/`!==`), never loose (`==`/`!=`)
- No `for...of` loops (linter disallows; use `.forEach()`, `.map()`, `Promise.all()`)

### Section Dividers

Dash lengths are multiples of 8 and denote context shift magnitude:

- `// --------` (8) — minor grouping: preference categories, adjacent state/hook declarations
- `// ----------------` (16) — mid-level sections: sub-functions within a method, component sections (state, handlers, render)
- `// --------------------------------` (32) — major sections: method groups in services, top-level module sections, redux slice vs thunk boundary

### Import Ordering

Imports are sorted into groups with a blank line between each group:

```
// 1. Externals: react → react-* → @capacitor/@capawesome → decimal.js
//    → @bitauth/libauth → other 3rd-party → @ant-design/icons → @/icons/*
// 2. @/redux/*
// 3. @/kernel/*
// 4. Components (one group): @/views/* → @/layout/* → @/atoms/* → @/composite/*
// 5. @/hooks/*
// 6. @/util/* and other @/* (apolloClient, etc.)
// 7. @/routes/*
// 8. Translations (one group): @/translations/*, @/util/translations, ./translations
// 9. Relative: ./* and ../* (excluding translations)
```

Enforced by `node scripts/sort-imports.js`.

### Patterns

```typescript
// Named functions in useEffect (ESLint requirement)
useEffect(function handleWalletSync() {
  // ...
}, [dependency]);

// Service singleton pattern (always available, just call)
export default function MyService() {
  const Database = DatabaseService();
  return {
    doSomething() { /* ... */ },
  };
}

// Redux pattern
const wallet = useSelector(selectWallet);
const dispatch = useDispatch();
dispatch(someAction(payload));

// Translation pattern
import { translate } from "@/util/translations";
import translations from "./translations";
{translate(translations.keyName)}
```

### Route Pattern (Lazy Loading)

```typescript
{
  path: "/apps/myapp",
  async lazy() {
    const { default: MyAppView } = await import("@/views/apps/myapp/MyAppView");
    return { Component: MyAppView };
  },
}
```

## Translation System

Translations colocated in component directories as `translations.js` files.

- Add only English (`en`) key initially: `myKey: { en: "Hello" }`
- Run `GOOGLE_TRANSLATE_API_KEY="xxx" node ./automation/addLanguages.js` for other languages
- The script finds all leaf-level `{ en: "..." }` objects and expands them in-place with Google Translate
- Files with imported refs, comments, and destructured exports are handled correctly
- Language list is in `automation/languages.js` — keep in sync with `src/util/translations.js`

## Testing

**Framework:** Vitest 4.0 (colocated test files: `*.test.ts`, `*.test.js`)

**Test files (16 files, 368 tests):**
- `src/util/sats.test.ts` - satoshi conversion, bchToSats input validation
- `src/util/uri.test.ts` - BIP21 URI parsing, isIntStr, BigInt guards
- `src/util/cashaddr.test.ts` - CashAddr encoding/decoding
- `src/util/currency.test.ts` - decimal formatting, locale handling
- `src/util/color.test.js` - HSL/hex conversion, gradient generation
- `src/util/hex.test.ts` - hex encoding/decoding
- `src/util/string.test.ts` - string utilities
- `src/util/clsx.test.js` - class name utility
- `src/util/mime.test.js` - MIME type utilities
- `src/util/sql.test.js` - SQL utilities
- `src/util/token.test.ts` - CashToken utilities
- `src/util/electrum_servers.test.ts` - Electrum server config
- `src/redux/preferences.test.ts` - preference validation
- `src/kernel/bch/CurrencyService.test.ts` - exchange rate logic
- `src/kernel/wallet/UtxoManagerService.test.ts` - UTXO selection (property-based fuzz tests)
- `src/kernel/wallet/WalletManagerService.test.ts` - wallet management

**What's testable:** Pure utilities in `src/util/`, validation/formatting functions, preference validation, UTXO selection logic

**What's hard to test:** Most service layer (IO-coupled), components (no test infra), encryption (native plugin)

## Security

### Content Security Policy

CSP enforced via meta tag in `index.html`:
- `script-src 'self'` — no inline scripts, no eval
- `connect-src 'self' wss: https:` — Electrum WebSocket + HTTPS APIs
- `style-src 'self' 'unsafe-inline'` — required for Tailwind
- `object-src 'none'` — no plugins/embeds

### Known Issues

1. **Unsalted PIN hash** - `SecurityService.ts` legacy fallback only (new PINs use plugin with PBKDF2 + lockout)
2. **Seed in memory** - `KeyManagerService.ts` - JS provides no reliable memory zeroing; native platforms DO zero key material

### Tech Debt

- Merkle proof validation not implemented (trusts Electrum server)
- No transaction fee calculation in history
- Exchange rates not cached per-block
- Large components: WalletViewSend (1078 lines), TransactionBuilderService (909 lines), SecuritySettings (512 lines)

### Fragile Areas

- Address scanning sequential (should be parallel)
- BCMR loading blocks sync
- Full history fetch on wallet activation (no pagination)
- Database not indexed

## Contributing

1. Base branches off `staging` (NOT main)
2. Branch naming: `###-short-description` (e.g., `446-persist-memos`)
3. Minimize changes to only what's required
4. Self-review diff before submitting
5. Package installation = separate commit
6. Use pnpm (enforced)

**MR Target: Always `staging`, never `main`**

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | 19.2.3 | UI framework |
| vite | 5.4.21 | Build tool |
| @capacitor/core | 8.0.0 | Native bridge |
| @bitauth/libauth | 3.0.0 | BCH cryptography |
| @electrum-cash/network | 4.1.4 | Electrum protocol |
| sql.js | 1.13.0 | SQLite WASM |
| @walletconnect/core | 2.23.1 | WalletConnect v2 |
| @cashlab/cauldron | 1.0.2 | Cauldron DEX |
| typescript | 5.9.3 | Type checking |
| vitest | 4.0.17 | Testing |

## External Integrations

- **Electrum:** WebSocket to multiple servers per network (mainnet, chipnet, testnet3/4)
- **Exchange Rates:** CoinGecko (primary), Yadio (ARS/VES fallback)
- **BCMR:** Paytaca registry (`https://bcmr.paytaca.com/api/registries/{authbase}/latest`)
- **Stats API:** GraphQL at `https://stats.selene.cash/`
- **WalletConnect:** Project ID `953f3fbfdc425848d3d9693a6c927cda`

## Network Prefixes

- **Mainnet:** `bitcoincash:` prefix
- **Chipnet/Testnet:** `bchtest:` prefix

## GitLab Automation

Session start hook runs `./scripts/gitlab-sync.sh` to refresh `.claude/gitlab-state.md`.

**Commands:**
- "sync gitlab" → Run `./scripts/gitlab-sync.sh`
- "what should I work on?" → Read `.claude/priorities.md`
- "close #X" → Run `glab issue close X --repo selene.cash/selene-wallet`

## Lessons Learned

### Capacitor Plugin Naming

Not all plugins are official. Verify before installing:
- Official: `@capacitor/screen-orientation`
- Community: `@capacitor-community/keep-awake` (NOT `@capacitor/keep-awake`)

Always run `npm view @capacitor/plugin-name` first.

### Where Claude Excels

- UI tweaks, CSS fixes
- Config changes, search/filter logic
- CRUD operations, form validation
- Test generation, date formatting

### Where Claude Helps (with oversight)

- Transaction building, balance calculations
- API integrations, caching logic
- Navigation/routing, protocol parsing

### Where Human Must Lead

- Security architecture, key management
- Database migrations, app lifecycle
- Major features, protocol implementations
