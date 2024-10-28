import fs from "fs";
import path from "path";
import { UserSecretKey } from "@multiversx/sdk-wallet/out";
import {
  BinaryCodec,
  U32Value,
  U64Value,
  BigUIntValue,
  StringValue,
} from "@multiversx/sdk-core";

import {
  TIMESTAMP,
  POOL_ID,
  PLATFORM_FEE1,
  GROUP_FEE1,
  AMBASSADOR_FEE,
  TIMESTAMP_AFTER,
  AFTER_DEPOSIT_TIMESTAMP,
  CURRENCY1,
  CURRENCY2,
  BATCH_ID,
} from "../helpers";

import { deployerAddress, privateKeyDeployer } from "./deployer";

const codec = new BinaryCodec();

const signerPemBob = fs
  .readFileSync(path.resolve(process.cwd(), "tests/wallets/bob.pem"))
  .toString();
const privateKeyBob = UserSecretKey.fromPem(signerPemBob);
export const bobAddress = privateKeyBob
  .generatePublicKey()
  .toAddress()
  .pubkey();
const DATA_BOB = Buffer.concat([
  codec.encodeNested(new U64Value(TIMESTAMP)),
  codec.encodeNested(StringValue.fromUTF8(POOL_ID)),
  bobAddress,
  codec.encodeNested(new BigUIntValue(Number(PLATFORM_FEE1))),
  codec.encodeNested(new BigUIntValue(Number(GROUP_FEE1))),
  codec.encodeNested(new BigUIntValue(Number(AMBASSADOR_FEE))),
  deployerAddress,
]);
export const SIGNATURE_BOB_WITH_AMBASSADOR = privateKeyDeployer.sign(DATA_BOB);

const DATA_BOB_AFTER = Buffer.concat([
  codec.encodeNested(new U64Value(TIMESTAMP_AFTER)),
  codec.encodeNested(StringValue.fromUTF8(POOL_ID)),
  bobAddress,
  codec.encodeNested(new BigUIntValue(Number(PLATFORM_FEE1))),
  codec.encodeNested(new BigUIntValue(Number(GROUP_FEE1))),
  codec.encodeNested(new BigUIntValue(Number(AMBASSADOR_FEE))),
  deployerAddress,
]);
export const SIGNATURE_BOB_AFTER = privateKeyDeployer.sign(DATA_BOB_AFTER);

const DATA_BOB_REFUND = Buffer.concat([
  codec.encodeNested(new U64Value(TIMESTAMP)),
  codec.encodeNested(StringValue.fromUTF8(POOL_ID)),
  bobAddress,
]);
export const SIGNATURE_BOB_REFUND = privateKeyDeployer.sign(DATA_BOB_REFUND);

const DATA_WALLET = Buffer.concat([
  codec.encodeNested(new U64Value(TIMESTAMP)),
  bobAddress,
]);
export const SIGNATURE_BOB_WALLET = privateKeyDeployer.sign(DATA_WALLET);

const DATA_BOB_AFTER_DEPOSIT = Buffer.concat([
  codec.encodeNested(new U64Value(AFTER_DEPOSIT_TIMESTAMP)),
  codec.encodeNested(StringValue.fromUTF8(POOL_ID)),
  bobAddress,
  codec.encodeNested(new BigUIntValue(Number(PLATFORM_FEE1))),
  codec.encodeNested(new BigUIntValue(Number(GROUP_FEE1))),
  codec.encodeNested(new BigUIntValue(Number(AMBASSADOR_FEE))),
  deployerAddress,
]);
export const SIGNATURE_BOB_AFTER_DEPOSIT = privateKeyDeployer.sign(
  DATA_BOB_AFTER_DEPOSIT,
);

const DATA_BOB_USER_REFUND_CURRENCY1 = Buffer.concat([
  codec.encodeNested(new U64Value(TIMESTAMP)),
  codec.encodeNested(StringValue.fromUTF8(POOL_ID)),
  bobAddress,
  codec.encodeNested(StringValue.fromUTF8(CURRENCY1)),
]);
export const SIGNATURE_DATA_BOB_USER_REFUND_CURRENCY1 = privateKeyDeployer.sign(
  DATA_BOB_USER_REFUND_CURRENCY1,
);

const DATA_BOB_USER_REFUND_CURRENCY2 = Buffer.concat([
  codec.encodeNested(new U64Value(TIMESTAMP)),
  codec.encodeNested(StringValue.fromUTF8(POOL_ID)),
  bobAddress,
  codec.encodeNested(StringValue.fromUTF8(CURRENCY2)),
]);
export const SIGNATURE_DATA_BOB_USER_REFUND_CURRENCY2 = privateKeyDeployer.sign(
  DATA_BOB_USER_REFUND_CURRENCY2,
);

const DATA_BOB_DISTRUBUTE = Buffer.concat([
  codec.encodeNested(new U64Value(TIMESTAMP)),
  codec.encodeNested(StringValue.fromUTF8(POOL_ID)),
  codec.encodeNested(new U32Value(BATCH_ID)),
  bobAddress,
]);
export const SIGNATURE_DATA_BOB_DISTRUBUTE =
  privateKeyDeployer.sign(DATA_BOB_DISTRUBUTE);
