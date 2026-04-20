import { Noto_Sans_JP, M_PLUS_Rounded_1c } from "next/font/google";

export const bodyFont = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const displayFont = M_PLUS_Rounded_1c({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});