import fs from "fs";
import path from "path";
import { UserSecretKey } from "@multiversx/sdk-wallet/out";
import { BinaryCodec, U64Value } from "@multiversx/sdk-core";
import { REWARDS_START_BLOCK } from "../helpers";

export const codec = new BinaryCodec();

const signerPemPath = "../wallets/signer.pem";

const privateKeySigner = loadPrivateKey(signerPemPath);
export const signerAddress = getAddress(privateKeySigner);

export function loadPrivateKey(pemPath: string): UserSecretKey {
  const pemContent = fs
    .readFileSync(path.resolve(__dirname, pemPath))
    .toString();
  return UserSecretKey.fromPem(pemContent);
}

export function getAddress(privateKey: UserSecretKey): Buffer {
  return privateKey.generatePublicKey().toAddress().pubkey();
}

export function signData(address: Buffer): Buffer {
  const data = Buffer.concat([
    codec.encodeNested(new U64Value(REWARDS_START_BLOCK)),
    address,
  ]);
  return privateKeySigner.sign(data);
}
