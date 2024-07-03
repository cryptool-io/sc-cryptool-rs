import fs from "fs";
import path from "path";
import { UserSecretKey } from "@multiversx/sdk-wallet/out";
import { BinaryCodec, U32Value, U64Value } from "@multiversx/sdk-core";

const codec = new BinaryCodec();

const signerPemDeployer = fs
  .readFileSync(path.resolve(__dirname, "./wallets/deployer.pem"))
  .toString();
export const privateKeyDeployer = UserSecretKey.fromPem(signerPemDeployer);
export const deployerAddress = privateKeyDeployer
  .generatePublicKey()
  .toAddress()
  .pubkey();
const DATA_DEPLOYER = Buffer.concat([deployerAddress]);
export const SIGNATURE_DEPLOYER = privateKeyDeployer.sign(DATA_DEPLOYER);

const signerPemBob = fs
  .readFileSync(path.resolve(__dirname, "./wallets/bob.pem"))
  .toString();
const privateKeyBob = UserSecretKey.fromPem(signerPemBob);
export const bobAddress = privateKeyBob
  .generatePublicKey()
  .toAddress()
  .pubkey();
export const bobAddressHex = privateKeyBob
  .generatePublicKey()
  .toAddress()
  .hex();
const DATA_BOB = Buffer.concat([bobAddress]);

export const SIGNATURE_BOB = privateKeyDeployer.sign(DATA_BOB);

export const SIGNATURE_DUMMY = privateKeyDeployer.sign(
  Buffer.from("SOME DUMMY DATA")
);
