import fs from "fs";
import path from "path";
import { UserSecretKey } from "@multiversx/sdk-wallet/out";
import {
  BinaryCodec,
  U32Value,
  U64Value,
  StringValue,
} from "@multiversx/sdk-core";

import {
  TIMESTAMP,
  POOL_ID,
  TIMESTAMP_BEFORE,
  TIMESTAMP_AFTER,
  BATCH_ID,
} from "../helpers";

const codec = new BinaryCodec();

const signerPemDeployer = fs
  .readFileSync(path.resolve(__dirname, "../wallets/deployer.pem"))
  .toString();
export const privateKeyDeployer = UserSecretKey.fromPem(signerPemDeployer);
export const deployerAddress = privateKeyDeployer
  .generatePublicKey()
  .toAddress()
  .pubkey();
const DATA_DEPLOYER = Buffer.concat([
  codec.encodeNested(new U64Value(TIMESTAMP)),
  codec.encodeNested(StringValue.fromUTF8(POOL_ID)),
  deployerAddress,
]);
export const SIGNATURE_DEPLOYER = privateKeyDeployer.sign(DATA_DEPLOYER);

export const SIGNATURE_DUMMY = privateKeyDeployer.sign(
  Buffer.from("SOME DUMMY DATA"),
);

const DATA_BEFORE = Buffer.concat([
  codec.encodeNested(new U64Value(TIMESTAMP_BEFORE)),
  codec.encodeNested(StringValue.fromUTF8(POOL_ID)),
  deployerAddress,
]);
export const SIGNATURE_BEFORE = privateKeyDeployer.sign(DATA_BEFORE);

const DATA_AFTER = Buffer.concat([
  codec.encodeNested(new U64Value(TIMESTAMP_AFTER)),
  codec.encodeNested(StringValue.fromUTF8(POOL_ID)),
  deployerAddress,
]);
export const SIGNATURE_AFTER = privateKeyDeployer.sign(DATA_AFTER);

const DATA_DEPLOYER_DISTRUBUTE = Buffer.concat([
  codec.encodeNested(new U64Value(TIMESTAMP)),
  codec.encodeNested(StringValue.fromUTF8(POOL_ID)),
  codec.encodeNested(new U32Value(BATCH_ID)),
  deployerAddress,
]);
export const SIGNATURE_DATA_DEPLOYER_DISTRUBUTE = privateKeyDeployer.sign(
  DATA_DEPLOYER_DISTRUBUTE,
);
