import { loadPrivateKey, getAddress, signData } from "./common";

const privateKeyCarol = loadPrivateKey("../wallets/carol.pem");
export const carolAddress = getAddress(privateKeyCarol);

export const SIGNATURE_CAROL = signData(carolAddress);
