/* eslint-disable */
import { useState } from "react";
import { useSelector } from "react-redux";
import { MoneyCollectOutlined } from "@ant-design/icons";

import { selectActiveWalletHash } from "@/redux/wallet";

import AddressManagerService, {
  AddressEntity,
} from "@/kernel/wallet/AddressManagerService";
import UtxoManagerService from "@/kernel/wallet/UtxoManagerService";

import Address from "@/atoms/Address";
import Satoshi from "@/atoms/Satoshi";

export default function AssetsViewAddresses() {
  const walletHash = useSelector(selectActiveWalletHash);

  const [shouldShowEmptyAddresses, setShouldShowEmptyAddresses] =
    useState(false);

  const AddressManager = AddressManagerService(walletHash);
  const receiveAddresses = AddressManager.getReceiveAddresses();
  const changeAddresses = AddressManager.getChangeAddresses();

  const unusedReceiveAddresses = receiveAddresses.filter(
    (address) => address.state === null
  );
  const unusedChangeAddresses = changeAddresses.filter(
    (address) => address.state === null
  );

  const addresses = [...receiveAddresses, ...changeAddresses];

  return (
    <div>
      <div className="flex">
        <label className="text-sm">
          <input
            className="mr-1"
            type="checkbox"
            checked={shouldShowEmptyAddresses}
            onChange={(event) =>
              setShouldShowEmptyAddresses(event.target.checked)
            }
          />
          Show Empty Addresses
        </label>
      </div>
      {/*<div>
        <ul>
          <li>Receive Addresses: {receiveAddresses.length}</li>
          <li>Unused Receive Addresses: {unusedReceiveAddresses.length}</li>
          <li>Change Addresses: {changeAddresses.length}</li>
          <li>Unused Change Addresses: {unusedChangeAddresses.length}</li>
        </ul>
      </div>*/}
      <ul className="mt-2 bg-neutral-100 text-neutral-600 divide-y divide-neutral-300 max-h-[58vh] overflow-y-scroll border border-neutral-400 shadow-inner">
        {addresses
          .filter((a) => a.balance > 0 || shouldShowEmptyAddresses)
          .map((a, i) => (
            <li key={a.address}>
              <AddressAccordion a={a} i={i} />
            </li>
          ))}
      </ul>
    </div>
  );
}

interface AddressAccordionProps {
  a: AddressEntity;
  i: number;
}

function AddressAccordion({ a, i }: AddressAccordionProps) {
  const [isOpen, setIsOpen] = useState(false);

  const walletHash = useSelector(selectActiveWalletHash);
  const UtxoManager = UtxoManagerService(walletHash);
  const coins = UtxoManager.getAddressCoins(a.address);

  const zebraCss = i % 2 === 0 ? "bg-neutral-100" : "bg-neutral-50";

  return (
    <div className={`p-1.5 ${zebraCss}`}>
      <div className="flex text-sm" onClick={() => setIsOpen(!isOpen)}>
        <div className="flex-1 text-sm">
          <span className="font-mono text-xs mr-1 tracking-tighter">
            #{a.hd_index}.{a.change}
          </span>
          <span className="text-sm">
            <Address
              address={a.address}
              short={isOpen ? false : a.balance > 0}
              maxLength={isOpen ? 0 : 40}
            />
          </span>
          <div className="opacity-90">{a.memo}</div>
        </div>
        {!isOpen && a.balance > 0 && (
          <div className="flex-1 text-right">
            <div className="font-mono">
              <Satoshi value={a.balance} />
            </div>
            <div className="text-sm opacity-80">
              <Satoshi value={a.balance} flip />
            </div>
          </div>
        )}
      </div>
      {isOpen && a.balance > 0 && (
        <div className="bg-neutral-50 rounded-sm shadow-inner text-sm mt-1 flex flex-wrap gap-1 justify-between">
          {coins.map((coin) => (
            <Coin key={`${coin.tx_hash}:${coin.tx_pos}`} coin={coin} />
          ))}
        </div>
      )}
    </div>
  );
}

/* eslint-disable react/prop-types */
function Coin({ coin }) {
  const [isSelected, setIsSelected] = useState(false);

  const selectCss = isSelected
    ? "bg-primary text-white"
    : "bg-neutral-50 text-neutral-900";

  const handleSelection = () => {
    setIsSelected(!isSelected);
  };

  return (
    <div
      className={`border rounded border-primary p-1.5 text-sm flex-1 ${selectCss}`}
      onClick={handleSelection}
    >
      <div className="flex items-center">
        <div className="text-base mr-1">
          <MoneyCollectOutlined />
        </div>
        <div>
          <div className="font-mono">
            <Satoshi value={coin.valueSatoshis} />
          </div>
          <div className="text-sm opacity-80">
            <Satoshi value={coin.valueSatoshis} flip />
          </div>
        </div>
      </div>
    </div>
  );
}
