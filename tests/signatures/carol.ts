import fs from "fs";
import path from "path";
import { UserSecretKey } from "@multiversx/sdk-wallet/out";
import {
  BinaryCodec,
  U32Value,
  U64Value,
  BigUIntValue,
} from "@multiversx/sdk-core";

import {
  TIMESTAMP,
  POOL_ID,
  PLATFORM_FEE2,
  GROUP_FEE2,
  AMBASSADOR_FEE,
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
  codec.encodeNested(new U32Value(POOL_ID)),
  carolAddress,
  codec.encodeNested(new BigUIntValue(PLATFORM_FEE2)),
  codec.encodeNested(new BigUIntValue(GROUP_FEE2)),
]);
export const SIGNATURE_CAROL_WITHOUT_AMBASSADOR = privateKeyDeployer.sign(
  DATA_CAROL_WITHOUT_AMBASSADOR,
);

const DATA_CAROL_WITH_AMBASSADOR = Buffer.concat([
  codec.encodeNested(new U64Value(TIMESTAMP)),
  codec.encodeNested(new U32Value(POOL_ID)),
  carolAddress,
  codec.encodeNested(new BigUIntValue(PLATFORM_FEE2)),
  codec.encodeNested(new BigUIntValue(GROUP_FEE2)),
  codec.encodeNested(new BigUIntValue(AMBASSADOR_FEE)),
  deployerAddress,
]);

export const SIGNATURE_CAROL_WITH_AMBASSADOR = privateKeyDeployer.sign(
  DATA_CAROL_WITH_AMBASSADOR,
);

const DATA_WALLET = Buffer.concat([
  codec.encodeNested(new U64Value(TIMESTAMP)),
  carolAddress,
]);
export const SIGNATURE_CAROL_WALLET = privateKeyDeployer.sign(DATA_WALLET);
