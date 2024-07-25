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

const carolPemDeployer = fs
  .readFileSync(path.resolve(__dirname, "../wallets/carol.pem"))
  .toString();
export const privateKeyCarol = UserSecretKey.fromPem(carolPemDeployer);
export const carolAddress = privateKeyCarol
  .generatePublicKey()
  .toAddress()
  .pubkey();

const DATA_CAROL = Buffer.concat([
  codec.encodeNested(new U64Value(REWARDS_START_BLOCK)),
  carolAddress,
]);
export const SIGNATURE_CAROL = privateKeySigner.sign(DATA_CAROL);
