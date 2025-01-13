import fs from "fs";
import path from "path";
import { UserSecretKey } from "@multiversx/sdk-wallet/out";
import {
  BinaryCodec,
  U64Value,
  BigUIntValue,
  StringValue,
} from "@multiversx/sdk-core";

import {
  TIMESTAMP,
  POOL_ID,
  PLATFORM_FEE3,
  GROUP_FEE3,
  CURRENCY3,
} from "../helpers";

import { deployerAddress, privateKeyDeployer } from "./deployer";

const codec = new BinaryCodec();

const signerPemCarol = fs
  .readFileSync(path.resolve(process.cwd(), "tests/wallets/carol.pem"))
  .toString();
const privateKeyCarol = UserSecretKey.fromPem(signerPemCarol);
export const carolAddress = privateKeyCarol
  .generatePublicKey()
  .toAddress()
  .pubkey();
const DATA_CAROL_WITHOUT_AMBASSADOR = Buffer.concat([
  codec.encodeNested(new U64Value(TIMESTAMP)),
  codec.encodeNested(StringValue.fromUTF8(POOL_ID)),
  carolAddress,
  codec.encodeNested(new BigUIntValue(PLATFORM_FEE3)),
  codec.encodeNested(new BigUIntValue(GROUP_FEE3)),
]);
export const SIGNATURE_CAROL_WITHOUT_AMBASSADOR = privateKeyDeployer.sign(
  DATA_CAROL_WITHOUT_AMBASSADOR,
);

const DATA_WALLET = Buffer.concat([
  codec.encodeNested(new U64Value(TIMESTAMP)),
  carolAddress,
]);
export const SIGNATURE_CAROL_WALLET = privateKeyDeployer.sign(DATA_WALLET);

const DATA_CAROL_USER_REFUND_CURRENCY3 = Buffer.concat([
  codec.encodeNested(new U64Value(TIMESTAMP)),
  codec.encodeNested(StringValue.fromUTF8(POOL_ID)),
  carolAddress,
  codec.encodeNested(StringValue.fromUTF8(CURRENCY3)),
]);
export const SIGNATURE_DATA_CAROL_USER_REFUND_CURRENCY3 =
  privateKeyDeployer.sign(DATA_CAROL_USER_REFUND_CURRENCY3);
