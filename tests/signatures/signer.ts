import fs from "fs";
import path from "path";
import { UserSecretKey } from "@multiversx/sdk-wallet/out";

const signerPemSigner = fs
  .readFileSync(path.resolve(__dirname, "../wallets/signer.pem"))
  .toString();
const privateKeySigner = UserSecretKey.fromPem(signerPemSigner);
export const signerAddress = privateKeySigner
  .generatePublicKey()
  .toAddress()
  .pubkey();
