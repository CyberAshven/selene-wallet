import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { bip39WordListEnglish, decodeBip39Mnemonic } from "@bitauth/libauth";
import { ImportOutlined } from "@ant-design/icons";

import DatabaseService from "@/kernel/app/DatabaseService";
import LogService from "@/kernel/app/LogService";
import AddressScannerService from "@/kernel/wallet/AddressScannerService";
import WalletManagerService from "@/kernel/wallet/WalletManagerService";

import Accordion from "@/components/atoms/Accordion";
import Button from "@/components/atoms/Button";
import Select from "@/components/atoms/Select";

import { DEFAULT_DERIVATION_PATH, DERIVATION_PATHS } from "@/util/derivation";
import { Haptic } from "@/util/haptic";

import { translate } from "@/util/translations";
import translations from "./translations";

const wordlist = bip39WordListEnglish;

const Log = LogService("WizardImport");

interface AutoSuggestionsProps {
  mnemonicInput: string;
  inputSuggestions: string[];
  onClickWord: (word: string) => void;
}

function AutoSuggestions({
  mnemonicInput,
  inputSuggestions,
  onClickWord,
}: AutoSuggestionsProps) {
  const wrapperClassname =
    "min-h-8 text-center flex items-center justify-center gap-2 text-neutral-400 dark:text-neutral-300";
  if (mnemonicInput === "" || mnemonicInput.endsWith(" ")) {
    return (
      <div className={wrapperClassname}>
        {translate(translations.wordSuggestions)}
      </div>
    );
  }
  if (inputSuggestions.length === 0) {
    const splitMnemonic = mnemonicInput.split(" ");
    return (
      <div className={wrapperClassname}>
        {translate(translations.wordSuggestionsNoMatch, {
          word: splitMnemonic[splitMnemonic.length - 1],
        })}
      </div>
    );
  }
  return (
    <div className={wrapperClassname}>
      {inputSuggestions.map((w) => (
        <div
          className="px-2 py-1 bg-primary rounded-2xl text-white text-sm cursor-pointer"
          onClick={() => onClickWord(w)}
          key={`suggestion-${w}`}
        >
          {w}
        </div>
      ))}
    </div>
  );
}

export default function SettingsWalletWizardImport() {
  const navigate = useNavigate();

  const [mnemonicInput, setMnemonicInput] = useState("");
  const [passphraseInput, setPassphraseInput] = useState("");
  const [walletNameInput, setWalletNameInput] = useState(
    translate(translations.importedWalletName)
  );
  const [message, setMessage] = useState("");
  const [derivationPath, setDerivationPath] = useState("auto");

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleMnemonicInput = (event) => {
    const sanitizedInput = event.target.value
      .toLowerCase()
      .replace(/[^a-z ]/g, "") // strip all non a-z
      .replace(/ {2,}/g, " "); // strip consecutive spaces

    setMnemonicInput(sanitizedInput);
    setMessage("");
  };

  const handleWalletNameInput = (event) => {
    setWalletNameInput(event.target.value);
  };

  const handlePassphraseInput = (event) => {
    setPassphraseInput(event.target.value);
  };

  const handleDerivationSelect = (event) => {
    setDerivationPath(event.target.value);
  };

  const handleImportWallet = async () => {
    const trimmedInput = mnemonicInput.trim();
    const wordCount = trimmedInput.split(" ").length;
    if (wordCount !== 12 && wordCount !== 24) {
      setMessage(translate(translations.exactWordCount));
      return;
    }

    const isValidMnemonic =
      typeof decodeBip39Mnemonic(trimmedInput) !== "string";

    if (isValidMnemonic) {
      try {
        const WalletManager = WalletManagerService();

        const tempWallet = WalletManager.createTemporaryWallet({
          mnemonic: trimmedInput,
          passphrase: passphraseInput,
          derivation: DEFAULT_DERIVATION_PATH,
        });

        await WalletManager.openWalletDatabase(tempWallet.walletHash);

        const foundPath =
          derivationPath === "auto"
            ? await AddressScannerService(tempWallet).scanDerivationPaths()
            : derivationPath;

        Log.debug("Found path", foundPath);

        const walletData = {
          ...tempWallet,
          derivation: foundPath,
          name: walletNameInput,
        };

        const walletHash = WalletManager.calculateWalletHash(walletData);
        walletData.walletHash = walletHash;

        await WalletManagerService().importWallet(walletData);
        await DatabaseService().closeWalletDatabase(
          tempWallet.walletHash,
          true
        );

        navigate(`build/${walletHash}`);
      } catch (e) {
        setMessage(translate(translations.alreadyImported));
        await Haptic.error();
      }
    } else {
      setMessage(translate(translations.phraseInvalid));
      await Haptic.error();
    }
  };

  const inputSuggestions = useMemo(() => {
    if (mnemonicInput === "" || mnemonicInput.endsWith(" ")) {
      return [];
    }
    const words = mnemonicInput.split(" ");
    const lastWord = words[words.length - 1].toLowerCase();
    if (lastWord === "") {
      return [];
    }
    const suggestions = wordlist.filter((word) => word.startsWith(lastWord));
    return suggestions.slice(0, 4);
  }, [mnemonicInput]);

  const addWordSuggestion = (word) => {
    setMnemonicInput((v) => {
      const words = v.split(" ");
      words[words.length - 1] = word;
      return `${words.join(" ")} `;
    });
    textareaRef.current?.focus();
  };

  return (
    <>
      <div className="text-2xl text-center text-neutral-900 dark:text-neutral-100">
        {translate(translations.enterRecoveryPhrase)}
      </div>
      <div className="flex justify-center">
        {message === "" ? (
          <ul className="list-disc list-inside p-2 text-left text-neutral-700 dark:text-neutral-200">
            <li>{translate(translations.alsoKnownAs)}</li>
            <li>{translate(translations.exactly12Or24)}</li>
          </ul>
        ) : (
          <div className="text-error p-2">{message}</div>
        )}
      </div>
      <AutoSuggestions
        mnemonicInput={mnemonicInput}
        inputSuggestions={inputSuggestions}
        onClickWord={addWordSuggestion}
      />
      <div className="mb-2" />
      <div className="rounded-md border-4 border-primary relative">
        <textarea
          ref={textareaRef}
          data-testid="mnemonic-input"
          className="w-full text-mono h-36 max-h-36 resize-none bg-white dark:bg-neutral-700 text-primary dark:text-neutral-25"
          onChange={handleMnemonicInput}
          value={mnemonicInput}
          autoComplete="off"
        />
      </div>
      <div className="my-1">
        <label>
          <span className="font-bold dark:text-neutral-100">Wallet Name</span>
          <input
            type="text"
            className="w-full border-primary border-2 rounded-sm p-1 bg-white dark:bg-neutral-700 text-primary dark:text-neutral-25"
            onChange={handleWalletNameInput}
            value={walletNameInput}
          />
        </label>
      </div>
      <div className="my-1">
        <Accordion icon={() => null} title="Additional Options">
          <Accordion.Child icon={() => null} label="Passphrase">
            <input
              type="text"
              className="w-full border border-primary bg-white dark:bg-neutral-700 text-primary dark:text-neutral-25"
              onChange={handlePassphraseInput}
              value={passphraseInput}
              autoComplete="off"
            />
          </Accordion.Child>
          <Accordion.Child icon={() => null} label="Derivation Path">
            <Select onChange={handleDerivationSelect} value={derivationPath}>
              <option value="auto">Auto</option>
              {DERIVATION_PATHS.map((path) => (
                <option value={path}>{path}</option>
              ))}
            </Select>
          </Accordion.Child>
        </Accordion>
      </div>
      <div className="my-2">
        <Button
          label={translate(translations.importWallet)}
          labelSize="lg"
          icon={ImportOutlined}
          iconSize="2xl"
          rounded="md"
          fullWidth
          inverted
          onClick={handleImportWallet}
        />
      </div>
    </>
  );
}
