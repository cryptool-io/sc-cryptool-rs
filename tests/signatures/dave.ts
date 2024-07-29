import { loadPrivateKey, getAddress, signData } from "./common";

const privateKeyDave = loadPrivateKey("../wallets/dave.pem");
export const daveAddress = getAddress(privateKeyDave);

export const SIGNATURE_DAVE = signData(daveAddress);
