import { loadPrivateKey, getAddress, signData } from "./common";

const privateKeyBob = loadPrivateKey("../wallets/bob.pem");
export const bobAddress = getAddress(privateKeyBob);

export const SIGNATURE_BOB = signData(bobAddress);
