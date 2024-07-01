import fs from 'fs';
import path from 'path';
import { UserSecretKey } from '@multiversx/sdk-wallet/out';
import { BinaryCodec, U32Value, U64Value, BigUIntValue } from "@multiversx/sdk-core"

import { 
    TIMESTAMP,
    POOL_ID,
    PLATFORM_FEE1,
    GROUP_FEE1,
    AMBASSADOR_FEE,
    TIMESTAMP_AFTER,
} from "../helpers";

import { 
    deployerAddress,
    privateKeyDeployer
} from "./deployer";

const codec = new BinaryCodec();

const signerPemBob = fs.readFileSync(path.resolve(process.cwd(), 'tests/wallets/bob.pem')).toString();
const privateKeyBob = UserSecretKey.fromPem(signerPemBob);
export const bobAddress = privateKeyBob.generatePublicKey().toAddress().pubkey();
const DATA_BOB = Buffer.concat([
  codec.encodeNested(new U64Value(TIMESTAMP)),
  codec.encodeNested(new U32Value(POOL_ID)),
  bobAddress,
  codec.encodeNested(new BigUIntValue(Number(PLATFORM_FEE1))),
  codec.encodeNested(new BigUIntValue(Number(GROUP_FEE1))),
  codec.encodeNested(new BigUIntValue(Number(AMBASSADOR_FEE))),
  deployerAddress,
]);
export const SIGNATURE_BOB_WITH_AMBASSADOR = privateKeyDeployer.sign(DATA_BOB);

const DATA_BOB_AFTER = Buffer.concat([
  codec.encodeNested(new U64Value(TIMESTAMP_AFTER)),
  codec.encodeNested(new U32Value(POOL_ID)),
  bobAddress,
  codec.encodeNested(new BigUIntValue(Number(PLATFORM_FEE1))),
  codec.encodeNested(new BigUIntValue(Number(GROUP_FEE1))),
  codec.encodeNested(new BigUIntValue(Number(AMBASSADOR_FEE))),
  deployerAddress,
]);
export const SIGNATURE_BOB_AFTER = privateKeyDeployer.sign(DATA_BOB_AFTER);

const DATA_BOB_REFUND = Buffer.concat([
  codec.encodeNested(new U64Value(TIMESTAMP)),
  codec.encodeNested(new U32Value(POOL_ID)),
  bobAddress]);
export const SIGNATURE_BOB_REFUND = privateKeyDeployer.sign(DATA_BOB_REFUND);
