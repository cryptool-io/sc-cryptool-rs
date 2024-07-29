import { loadPrivateKey, getAddress, signData } from "./common";

const privateKeyAlice = loadPrivateKey("../wallets/alice.pem");
export const aliceAddress = getAddress(privateKeyAlice);

export const SIGNATURE_ALICE = signData(aliceAddress);
