import { UserSecretKey } from "@multiversx/sdk-wallet/out";
import { Mnemonic } from "@multiversx/sdk-wallet";
import {
  BinaryCodec,
  U64Value,
  BigUIntValue,
  StringValue,
} from "@multiversx/sdk-core";

const MAX_PERCENTAGE = BigInt(10000);

import { privateKeyDeployer, deployerAddress } from "./signatures/deployer";

import { TIMESTAMP, POOL_ID } from "./helpers";

const codec = new BinaryCodec();

export function getRandomInt(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getRandomDeposit(
  minDeposit: number,
  maxDeposit: number,
  increment: number,
  decimals: number,
): bigint {
  const rangeStart = Math.ceil(minDeposit / increment);
  const rangeEnd = Math.floor(maxDeposit / increment);
  const randomMultiple = getRandomInt(rangeStart, rangeEnd);
  return BigInt(randomMultiple * increment * 10 ** decimals);
}

function generateAddress(): Buffer {
  const words = Mnemonic.generate().getWords();
  const mnemonic = words.join(" ");
  const derivedKey = Mnemonic.fromString(mnemonic).deriveKey(0);
  const secretKey = UserSecretKey.fromString(derivedKey.hex());
  const address = secretKey.generatePublicKey().toAddress().pubkey();
  return address;
}

export function generateDataAndSignature(
  ambassadorBool: number,
  depositAmount: bigint,
): {
  address: Buffer;
  whitelistSignature: Buffer;
  depositSignature: Buffer;
  platformFee: bigint;
  groupFee: bigint;
  ambassadorFee: bigint;
  ambassadorAddress: Uint8Array;
} {
  const platformFee =
    (BigInt(getRandomInt(0, 100)) * depositAmount) / MAX_PERCENTAGE;
  const groupFee =
    (BigInt(getRandomInt(101, 200)) * depositAmount) / MAX_PERCENTAGE;
  const address = generateAddress();

  var whitelist_data = Buffer.concat([
    codec.encodeNested(new U64Value(TIMESTAMP)),
    address,
  ]);

  var deploy_data = Buffer.concat([
    codec.encodeNested(new U64Value(TIMESTAMP)),
    codec.encodeNested(StringValue.fromUTF8(POOL_ID)),
    address,
    codec.encodeNested(new BigUIntValue(platformFee)),
    codec.encodeNested(new BigUIntValue(groupFee)),
  ]);
  var ambassadorFee = BigInt(0);
  var ambassadorAddress = new Uint8Array(0);
  if (ambassadorBool == 1) {
    ambassadorFee =
      (BigInt(getRandomInt(201, 300)) * depositAmount) / MAX_PERCENTAGE;
    ambassadorAddress = generateAddress();
    deploy_data = Buffer.concat([
      deploy_data,
      codec.encodeNested(new BigUIntValue(ambassadorFee)),
      ambassadorAddress,
    ]);
  }
  const whitelistSignature = privateKeyDeployer.sign(whitelist_data);
  const depositSignature = privateKeyDeployer.sign(deploy_data);

  return {
    address,
    whitelistSignature,
    depositSignature,
    platformFee,
    groupFee,
    ambassadorFee,
    ambassadorAddress,
  };
}

export function generateDataAndSignatureDeployerAmbassador(
  depositAmount: bigint,
): {
  address: Buffer;
  whitelistSignature: Buffer;
  depositSignature: Buffer;
  platformFee: bigint;
  groupFee: bigint;
  ambassadorFee: bigint;
} {
  const platformFee =
    (BigInt(getRandomInt(0, 100)) * depositAmount) / MAX_PERCENTAGE;
  const groupFee =
    (BigInt(getRandomInt(101, 200)) * depositAmount) / MAX_PERCENTAGE;
  const address = generateAddress();
  const ambassadorFee =
    (BigInt(getRandomInt(201, 300)) * depositAmount) / MAX_PERCENTAGE;

  var whitelist_data = Buffer.concat([
    codec.encodeNested(new U64Value(TIMESTAMP)),
    address,
  ]);

  var deploy_data = Buffer.concat([
    codec.encodeNested(new U64Value(TIMESTAMP)),
    codec.encodeNested(StringValue.fromUTF8(POOL_ID)),
    address,
    codec.encodeNested(new BigUIntValue(platformFee)),
    codec.encodeNested(new BigUIntValue(groupFee)),
    codec.encodeNested(new BigUIntValue(ambassadorFee)),
    deployerAddress,
  ]);

  const whitelistSignature = privateKeyDeployer.sign(whitelist_data);
  const depositSignature = privateKeyDeployer.sign(deploy_data);

  return {
    address,
    whitelistSignature,
    depositSignature,
    platformFee,
    groupFee,
    ambassadorFee,
  };
}

export function generateDataAndSignature2Ambassadors(depositAmount: bigint): {
  address: Buffer;
  whitelistSignature: Buffer;
  depositSignature: Buffer;
  platformFee: bigint;
  groupFee: bigint;
  ambassadorFee1: bigint;
  ambassadorAddress1: Uint8Array;
  ambassadorFee2: bigint;
} {
  const platformFee =
    (BigInt(getRandomInt(0, 100)) * depositAmount) / MAX_PERCENTAGE;
  const groupFee =
    (BigInt(getRandomInt(101, 200)) * depositAmount) / MAX_PERCENTAGE;
  const address = generateAddress();

  var whitelist_data = Buffer.concat([
    codec.encodeNested(new U64Value(TIMESTAMP)),
    address,
  ]);

  const ambassadorFee1 =
    (BigInt(getRandomInt(201, 300)) * depositAmount) / MAX_PERCENTAGE;
  const ambassadorAddress1 = generateAddress();
  const ambassadorFee2 =
    (BigInt(getRandomInt(201, 300)) * depositAmount) / MAX_PERCENTAGE;

  var deploy_data = Buffer.concat([
    codec.encodeNested(new U64Value(TIMESTAMP)),
    codec.encodeNested(StringValue.fromUTF8(POOL_ID)),
    address,
    codec.encodeNested(new BigUIntValue(platformFee)),
    codec.encodeNested(new BigUIntValue(groupFee)),
    codec.encodeNested(new BigUIntValue(ambassadorFee1)),
    ambassadorAddress1,
    codec.encodeNested(new BigUIntValue(ambassadorFee2)),
    deployerAddress,
  ]);
  const whitelistSignature = privateKeyDeployer.sign(whitelist_data);
  const depositSignature = privateKeyDeployer.sign(deploy_data);

  return {
    address,
    whitelistSignature,
    depositSignature,
    platformFee,
    groupFee,
    ambassadorFee1,
    ambassadorAddress1,
    ambassadorFee2,
  };
}
