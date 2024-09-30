import fs from "fs";
import path from "path";
import { UserSecretKey } from "@multiversx/sdk-wallet/out";
import {
  U32Value,
  U64Value,
  BigUIntValue,
  BinaryCodec,
} from "@multiversx/sdk-core";
const codec = new BinaryCodec();

// LOAD WALLETS
//

// DEPLOYER
const signerPemDeployer = fs
  .readFileSync(path.resolve(__dirname, "../../tests/wallets/signer.pem"))
  .toString();
const privateKeySigner = UserSecretKey.fromPem(signerPemDeployer);
export const signerAddressBech32 = privateKeySigner
  .generatePublicKey()
  .toAddress()
  .bech32();

const deployerPemDeployer = fs
  .readFileSync(path.resolve(__dirname, "../../tests/wallets/deployer.pem"))
  .toString();
export const privateKeyDeployer = UserSecretKey.fromPem(deployerPemDeployer);

export const deployerAddress = privateKeyDeployer
  .generatePublicKey()
  .toAddress()
  .pubkey();

export const deployerAddressBech32 = privateKeyDeployer
  .generatePublicKey()
  .toAddress()
  .bech32();

// BOB
const signerPemBob = fs
  .readFileSync(path.resolve(process.cwd(), "../../tests/wallets/bob.pem"))
  .toString();

export const privateKeyBob = UserSecretKey.fromPem(signerPemBob);

export const bobAddress = privateKeyBob
  .generatePublicKey()
  .toAddress()
  .pubkey();

export const bobAddressBech32 = privateKeyBob
  .generatePublicKey()
  .toAddress()
  .bech32();

// DEFINE DATA
//
export const POOL_ID = "0";
export const TIMESTAMP = Math.floor(Date.now() / 1000);
export const PLATFORM_FEE = 100;
export const GROUP_FEE = 200;
export const AMBASSADOR_FEE = 300;
export const AMOUNT = 100000000;

// SIGN DATA_DEPLOYER => DATA_DEPLOYER_SIGNED = signed(timestamp + pool_id + deployer_address)
//
const DATA_DEPLOYER = Buffer.concat([
  codec.encodeNested(new U64Value(TIMESTAMP)),
  codec.encodeNested(StringValue.fromUTF8(POOL_ID)),
  deployerAddress,
]);
export const DATA_DEPLOYER_SIGNED = privateKeySigner
  .sign(DATA_DEPLOYER)
  .toString("hex");

// SIGN REGISTER BOB WALLET => SIGNATURE_REGISTER_BOB_WALLET = signed(timestamp + user_address)
//
const DATA_REGISTER_BOB_WALLET = Buffer.concat([
  codec.encodeNested(new U64Value(TIMESTAMP)),
  bobAddress,
]);
export const SIGNATURE_REGISTER_BOB_WALLET = privateKeySigner
  .sign(DATA_REGISTER_BOB_WALLET)
  .toString("hex");

// SIGN DEPLOY BOB WALLET NO AMBASSADOR =>
// SIGNATURE_DEPLOY_BOB_WALLET_NO_AMBASSADOR = signed(timestamp + pool_id + deployer_address + platform_fee_percentage + group_fee_percentage).
//
var DATA_DEPLOY_BOB_WALLET_NO_AMBASSADOR = Buffer.concat([
  codec.encodeNested(new U64Value(TIMESTAMP)),
  codec.encodeNested(StringValue.fromUTF8(POOL_ID)),
  bobAddress,
  codec.encodeNested(new BigUIntValue(PLATFORM_FEE)),
  codec.encodeNested(new BigUIntValue(GROUP_FEE)),
]);
export const SIGNATURE_DEPLOY_BOB_WALLET_NO_AMBASSADOR = privateKeySigner
  .sign(DATA_DEPLOY_BOB_WALLET_NO_AMBASSADOR)
  .toString("hex");

// SIGN DEPLOY BOB WALLET WITH AMBASSADOR =>
// SIGNATURE_DEPLOY_BOB_WALLET_WITH_AMBASSADOR = signed(timestamp + pool_id + deployer_address + platform_fee_percentage + group_fee_percentage + ambassador_fee + ambassador_address).
//
var DATA_DEPLOY_BOB_WALLET_WITH_AMBASSADOR = Buffer.concat([
  codec.encodeNested(new U64Value(TIMESTAMP)),
  codec.encodeNested(StringValue.fromUTF8(POOL_ID)),
  bobAddress,
  codec.encodeNested(new BigUIntValue(PLATFORM_FEE)),
  codec.encodeNested(new BigUIntValue(GROUP_FEE)),
  codec.encodeNested(new BigUIntValue(AMBASSADOR_FEE)),
  deployerAddress,
]);

export const SIGNATURE_DEPLOY_BOB_WALLET_WITH_AMBASSADOR = privateKeySigner
  .sign(DATA_DEPLOY_BOB_WALLET_WITH_AMBASSADOR)
  .toString("hex");
