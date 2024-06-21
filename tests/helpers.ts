import fs from 'fs';
import path from 'path';
import { UserSecretKey } from '@multiversx/sdk-wallet/out';
import { BinaryCodec, U32Value, U64Value, BigUIntValue } from "@multiversx/sdk-core"

export const POOL_ID = 0
export const SOFT_CAP = 10000
export const HARD_CAP = 50000
export const CURRENCY1= "USDC-123456"
export const DECIMALS1=18
export const CURRENCY2 = "USDT-654321"
export const DECIMALS2 = 12
export const MIN_DEPOSIT = 1000
export const MAX_DEPOSIT = 5000
export const DEPOSIT_INCREMENTS = 50
export const START_DATE = 180
export const END_DATE = 240
export const REFUND_ENABLED = 1
export const TIMESTAMP = 120
  

const codec = new BinaryCodec();
const signerPemDeployer = fs.readFileSync(path.resolve(process.cwd(), 'tests/deployer.pem')).toString();
const privateKeyDeployer = UserSecretKey.fromPem(signerPemDeployer);
export const deployerAddress = privateKeyDeployer.generatePublicKey().toAddress().pubkey();
const DATA_DEPLOYER = Buffer.concat([
    codec.encodeNested(new U64Value(TIMESTAMP)),
    codec.encodeNested(new U32Value(POOL_ID)),
    deployerAddress,
  ]);
export const SIGNATURE_DEPLOYER = privateKeyDeployer.sign(DATA_DEPLOYER);

export const SIGNATURE_DUMMY = privateKeyDeployer.sign(Buffer.from("SOME DUMMY DATA")); 
export const TIMESTAMP_BEFORE = 30

const DATA_BEFORE = Buffer.concat([
    codec.encodeNested(new U64Value(TIMESTAMP_BEFORE)),
    codec.encodeNested(new U32Value(POOL_ID)),
    deployerAddress,
  ]);
export const SIGNATURE_BEFORE = privateKeyDeployer.sign(DATA_BEFORE);

export const HARD_CAP_INVALID = 5000
export const MAX_DEPOSIT_INVALID = 500
export const END_DATE_INVALID = 150
export const RAISE_POOL_ADDRESS = "erd1qqqqqqqqqqqqqpgqzyg3zygqqqqqqqqqqqqq2qqqqqqqqqqqqqqqtstllp"

export const PLATFORM_FEE = 100
export const GROUP_FEE = 200
export const AMBASSADOR_FEE = 300

const signerPemBob = fs.readFileSync(path.resolve(process.cwd(), 'tests/bob.pem')).toString();
const privateKeyBob = UserSecretKey.fromPem(signerPemBob);
export const bobAddress = privateKeyBob.generatePublicKey().toAddress().pubkey();
const DATA_BOB = Buffer.concat([
  codec.encodeNested(new U64Value(TIMESTAMP)),
  codec.encodeNested(new U32Value(POOL_ID)),
  bobAddress,
  codec.encodeNested(new BigUIntValue(PLATFORM_FEE)),
  codec.encodeNested(new BigUIntValue(GROUP_FEE)),
  codec.encodeNested(new BigUIntValue(AMBASSADOR_FEE)),
  deployerAddress,
]);
export const SIGNATURE_BOB_WITH_AMBASSADOR = privateKeyDeployer.sign(DATA_BOB);