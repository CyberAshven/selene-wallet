/* eslint-disable react/jsx-props-no-spreading */
import { useState } from "react";
import { QRCode } from "react-qrcode-logo";
import { useNavigate } from "react-router";

import FullColumn from "@/layout/FullColumn";
import ViewHeader from "@/layout/ViewHeader";
import LinkExternal from "@/components/atoms/LinkExternal";
import SeleneLogo from "@/components/atoms/SeleneLogo";

import { useLongPress } from "@/hooks/useLongPress";

import { logos } from "@/util/logos";
import { SELENE_WALLET_VERSION } from "@/util/version";

import { translate } from "@/util/translations";

import translations from "./CreditsViewTranslations";

export default function CreditsView() {
  const navigate = useNavigate();

  const [shouldShowQr, setShouldShowQr] = useState(true);

  const longPressEvents = useLongPress(
    () => navigate("/debug"),
    () => setShouldShowQr(!shouldShowQr),
    1674
  );

  return (
    <FullColumn>
      <ViewHeader
        icon={() => null}
        title={translate(translations.credits)}
        back="/"
      />
      <div className="bg-primary text-white text-center p-2 dark:bg-primarydark-200">
        <div className="flex items-center justify-center" {...longPressEvents}>
          {shouldShowQr ? (
            <div className="border-2 border-primary-700 rounded-sm">
              <QRCode
                value="https://selene.cash"
                size={180}
                quietZone={12}
                bgColor="#f7fcf1"
                fgColor="#262b27"
                logoImage={logos.selene.img}
                logoWidth={48}
                logoHeight={48}
              />
            </div>
          ) : (
            <SeleneLogo className="h-40" />
          )}
        </div>
        <div className="py-1">
          <h1 className="text-2xl font-bold">
            <LinkExternal to="https://selene.cash" className="underline">
              Selene Wallet v{SELENE_WALLET_VERSION}
            </LinkExternal>
          </h1>
          <h2 className="text-xl font-bold">
            {translate(translations.developedWith)}
          </h2>
          <h2 className="font-bold text-xl flex justify-center flex-wrap gap-x-1">
            <LinkExternal to="https://kallisti.io" className="underline">
              Kallisti.cash
            </LinkExternal>
            <span>&amp;</span>
            <LinkExternal
              to="https://bitcoincashpodcast.com"
              className="underline"
            >
              The Bitcoin Cash Podcast
            </LinkExternal>
          </h2>
        </div>
      </div>
      <div className="p-2 w-5/6 mx-auto">
        <h3 className="font-bold text-xl">FundMe: May 2025</h3>
        <ol className="list-inside list-decimal">
          <li>majamalu</li>
          <li>molecular</li>
          <li>TimeToDeliver</li>
          <li>molecsdrunkuncl</li>
          <li>&quot;Satoshi&quot;</li>
          <li>Lucky 13</li>
          <li>steve4096</li>
          <li>@cashstamps</li>
          <li>BigV</li>
          <li>Selene User2543</li>
          <li>Milton Friedman</li>
          <li>Steve2048</li>
          <li>David - AFoG</li>
          <li>Paul</li>
          <li>Ryan Giffin</li>
          <li>Bliss Goer</li>
          <li>Bernanácatl</li>
          <li>EmergentReasons</li>
          <li>Mathieu G.</li>
          <li>9500</li>
          <li>kiok</li>
          <li>Cheapy</li>
          <li>PurelyPeer</li>
          <li>Drunk Bernanctl</li>
          <li>Billy</li>
          <li>im_uname</li>
          <li>coolcleaner</li>
          <li>yeahhhbeer</li>
          <li>sandakersmann</li>
          <li>Bitvitor.com</li>
          <li>Gustavo</li>
          <li>Anonymous</li>
          <li>devperate</li>
          <li>MTO</li>
          <li>Murray Store</li>
          <li>Remora_101</li>
          <li>Andrew#128</li>
          <li>Nico</li>
          <li>BitcoinOutLoud</li>
          <li>Dunconomics</li>
          <li>Xandigal</li>
          <li>Andy</li>
          <li>Ben</li>
          <li>Anonymous</li>
          <li>Eggroley</li>
          <li>Mike</li>
          <li>rattattouille</li>
          <li>Selene User</li>
        </ol>

        <br />

        <h3 className="font-bold text-xl">Flipstarter: March 2024</h3>
        <ol className="list-inside list-decimal">
          <li>molecular</li>
          <li>toorik</li>
          <li>majamalu</li>
          <li>Renegade</li>
          <li>Mike Komaransky</li>
          <li>ErdoganTalk</li>
          <li>Shadow Of Harbringer</li>
          <li>BigV</li>
          <li>@_minisatoshi</li>
          <li>imaginary_username</li>
          <li>Joemar Taganna / Paytaca</li>
          <li>emergent_reasons</li>
          <li>notme</li>
          <li>Bernanácatl</li>
          <li>Omar</li>
          <li>Steve2048</li>
          <li>coolcleaner</li>
          <li>2qx</li>
          <li>Dmoney$$</li>
          <li>yeahhhbeer</li>
          <li>sandakersmann</li>
          <li>George Engelmann</li>
          <li>Bitcoin Out Loud</li>
          <li>bchtoronto.com</li>
          <li>Remora_101</li>
          <li>Josh (@MrJPE)</li>
          <li>Nico MG</li>
          <li>Anonymous</li>
          <li>Killian</li>
          <li>George Donnelly</li>
          <li>chrome</li>
          <li>Anonymous</li>
          <li>Eggroley</li>
          <li>devperate</li>
          <li>bchforeveryone.net</li>
          <li>bchpls.org</li>
          <li>BCHTV</li>
          <li>Anonymous</li>
          <li>Anonymous</li>
          <li>Nick</li>
          <li>Deidor</li>
          <li>@HashmobMedia</li>
          <li>Manilo</li>
          <li>nemecis1000</li>
          <li>Biometric/PIN Authentica</li>
          <li>AVG</li>
          <li>Anonymous</li>
        </ol>

        <br />

        <h3 className="font-bold text-xl">Flipstarter: May 2023</h3>
        <ol className="list-inside list-decimal">
          <li>majamalu</li>
          <li>toorik</li>
          <li>&quot;Satoshi Nakamoto&quot;</li>
          <li>ErdoganTalk</li>
          <li>Mike Komaransky</li>
          <li>Anonymous</li>
          <li>&quot;Philip J Fry&quot;</li>
          <li>Cheapy</li>
          <li>Jett</li>
          <li>imaginary_username</li>
          <li>fshinetop</li>
          <li>emergent_reasons</li>
          <li>2qx</li>
          <li>Bernanácatl</li>
          <li>pat</li>
          <li>Yasin</li>
          <li>&quot;ChatGPT&quot;</li>
          <li>Bitcoin Out Loud</li>
          <li>zmach1n3</li>
          <li>Omar</li>
          <li>Max Hastings</li>
          <li>sandakersmann</li>
          <li>Sydwell</li>
          <li>Steve2048</li>
          <li>Gustavo</li>
          <li>Coins4Clothes</li>
          <li>Remora_101</li>
          <li>PanteraBCH</li>
          <li>Anonymous (x5)</li>
        </ol>

        <h2 className="font-bold text-2xl mt-4">
          {translate(translations.developers)}
        </h2>
        <ul className="list-inside list-disc">
          <li>Jim Hamill</li>
          <li>Mateus Dal Bianco</li>
          <li>Simon Volpert</li>
        </ul>

        <h2 className="font-bold text-2xl mt-4">
          {translate(translations.docs)}
        </h2>
        <ul className="list-inside list-disc">
          <li>Josh (@MrJPE)</li>
        </ul>

        <h2 className="font-bold text-2xl mt-4">
          {translate(translations.testers)}
        </h2>
        <ul className="list-inside list-disc">
          <li>Gustavo</li>
          <li>nemecis1000</li>
        </ul>

        <h2 className="font-bold text-2xl mt-4">
          {translate(translations.translators)}
        </h2>
        <ul className="list-inside list-disc">
          <li>Marius Kjærstad (GitLab: @sandakersmann)</li>
          <li>Prashant Singh Pawar (GitLab: @prashantpawar)</li>
          <li>Luned Whelan (Welsh - https://lunedwhelan.co.uk/)</li>
        </ul>

        <h2 className="font-bold text-2xl mt-4">
          {translate(translations.introVideo)}
        </h2>
        <ul className="list-inside list-disc">
          <li>Duncan (Dunconomics.com)</li>
        </ul>

        <h2 className="font-bold text-2xl mt-4">
          {translate(translations.specialThanks)}
        </h2>
        <ul className="list-inside list-disc">
          <li>Jason Dreyzehner</li>
          <li>Lisa L</li>
          <li>NeonDaThal</li>
          <li>Johnathan Silverblood</li>
          <li>Mathieu Geukens</li>
          <li>Jim Hamill</li>
          <li>Calin Culianu</li>
          <li>Bitcoin Jason</li>
          <li>Sahid Miller</li>
          <li>Ian Blas</li>
          <li>@CM_Works</li>
          <li>Arthur</li>
          <li>XaYaZaZa</li>
          <li>@_minisatoshi</li>
          <li>Steve Thurmond</li>
          <li>The Paytaca Team</li>
          <li>Jett Scythe</li>
          <li>FiendishCrypto</li>
          <li>Renegade</li>
          <li>hosseinzoda</li>
          <li>Sayoshi Nakamario</li>
          <li>1ultrafresh</li>
        </ul>
      </div>
    </FullColumn>
  );
}
