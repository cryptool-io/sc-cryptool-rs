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

const alicePemDeployer = fs
  .readFileSync(path.resolve(__dirname, "../wallets/alice.pem"))
  .toString();
export const privateKeyAlice = UserSecretKey.fromPem(alicePemDeployer);
export const aliceAddress = privateKeyAlice
  .generatePublicKey()
  .toAddress()
  .pubkey();

const DATA_ALICE = Buffer.concat([
  codec.encodeNested(new U64Value(REWARDS_START_BLOCK)),
  aliceAddress,
]);
export const SIGNATURE_ALICE = privateKeySigner.sign(DATA_ALICE);
