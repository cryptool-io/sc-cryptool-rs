import { UserSecretKey } from "@multiversx/sdk-wallet/out";
import { Mnemonic } from "@multiversx/sdk-wallet";
import {
  BinaryCodec,
  U32Value,
  U64Value,
  BigUIntValue,
} from "@multiversx/sdk-core";

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
): number {
  const rangeStart = Math.ceil(minDeposit / increment);
  const rangeEnd = Math.floor(maxDeposit / increment);
  const randomMultiple = getRandomInt(rangeStart, rangeEnd);
  return randomMultiple * increment;
}

function generateAddress(): Buffer {
  const words = Mnemonic.generate().getWords();
  const mnemonic = words.join(" ");
  const derivedKey = Mnemonic.fromString(mnemonic).deriveKey(0);
  const secretKey = UserSecretKey.fromString(derivedKey.hex());
  const address = secretKey.generatePublicKey().toAddress().pubkey();
  return address;
}

export function generateDataAndSignature(ambassadorBool: number): {
  address: Buffer;
  whitelistSignature: Buffer;
  depositSignature: Buffer;
  platformFee: number;
  groupFee: number;
  ambassadorFee: number;
  ambassadorAddress: Uint8Array;
} {
  const platformFee = getRandomInt(0, 100);
  const groupFee = getRandomInt(101, 200);
  const address = generateAddress();

  var whitelist_data = Buffer.concat([
    codec.encodeNested(new U64Value(TIMESTAMP)),
    address,
  ]);

  var deploy_data = Buffer.concat([
    codec.encodeNested(new U64Value(TIMESTAMP)),
    codec.encodeNested(new U32Value(POOL_ID)),
    address,
    codec.encodeNested(new BigUIntValue(platformFee)),
    codec.encodeNested(new BigUIntValue(groupFee)),
  ]);
  var ambassadorFee = 0;
  var ambassadorAddress = new Uint8Array(0);
  if (ambassadorBool == 1) {
    ambassadorFee = getRandomInt(201, 300);
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

export function generateDataAndSignatureDeployerAmbassador(): {
  address: Buffer;
  whitelistSignature: Buffer;
  depositSignature: Buffer;
  platformFee: number;
  groupFee: number;
  ambassadorFee: number;
} {
  const platformFee = getRandomInt(0, 100);
  const groupFee = getRandomInt(101, 200);
  const address = generateAddress();
  const ambassadorFee = getRandomInt(201, 300);

  var whitelist_data = Buffer.concat([
    codec.encodeNested(new U64Value(TIMESTAMP)),
    address,
  ]);

  var deploy_data = Buffer.concat([
    codec.encodeNested(new U64Value(TIMESTAMP)),
    codec.encodeNested(new U32Value(POOL_ID)),
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
