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

const davePemDeployer = fs
  .readFileSync(path.resolve(__dirname, "../wallets/dave.pem"))
  .toString();
export const privateKeyDave = UserSecretKey.fromPem(davePemDeployer);
export const daveAddress = privateKeyDave
  .generatePublicKey()
  .toAddress()
  .pubkey();

const DATA_DAVE = Buffer.concat([
  codec.encodeNested(new U64Value(REWARDS_START_BLOCK)),
  daveAddress,
]);
export const SIGNATURE_DAVE = privateKeySigner.sign(DATA_DAVE);
