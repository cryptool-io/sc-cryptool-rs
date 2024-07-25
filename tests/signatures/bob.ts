import fs from "fs";
import path from "path";
import { UserSecretKey } from "@multiversx/sdk-wallet/out";
import { BinaryCodec, U64Value } from "@multiversx/sdk-core";

import { REWARDS_START_BLOCK } from "../helpers";

const codec = new BinaryCodec();

const signerPemSigner = fs
  .readFileSync(path.resolve(__dirname, "../wallets/signer.pem"))
  .toString();
export const privateKeySigner = UserSecretKey.fromPem(signerPemSigner);
export const deployerAddress = privateKeySigner
  .generatePublicKey()
  .toAddress()
  .pubkey();

const bobPemDeployer = fs
  .readFileSync(path.resolve(__dirname, "../wallets/bob.pem"))
  .toString();
export const privateKeyBob = UserSecretKey.fromPem(bobPemDeployer);
export const bobAddress = privateKeyBob
  .generatePublicKey()
  .toAddress()
  .pubkey();

const DATA_BOB = Buffer.concat([
  codec.encodeNested(new U64Value(REWARDS_START_BLOCK)),
  bobAddress,
]);
export const SIGNATURE_BOB = privateKeySigner.sign(DATA_BOB);
