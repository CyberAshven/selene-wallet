import bchLogo from "@/assets/bch-logo.svg";
//import bchCashtokensBwLogo from "@/assets/cashtokens-logo-bw.svg";
import bchCashtokensLogo from "@/assets/cashtokens-logo.svg";
import seleneCashtokensLogo from "@/assets/selene-cashtokens-logo.svg";
import seleneLogo from "@/assets/selene-logo.svg";

// logo keys must be all lowercase
export const logos = {
  selene: { name: "Selene", img: seleneLogo, img_tokens: seleneCashtokensLogo },
  bch: { name: "BCH", img: bchLogo, img_tokens: bchCashtokensLogo },
  none: { name: "None", img: "", img_tokens: "" },
};
