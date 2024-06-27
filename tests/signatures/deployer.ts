import fs from 'fs';
import path from 'path';
import { UserSecretKey } from '@multiversx/sdk-wallet/out';
import { BinaryCodec, U32Value, U64Value} from "@multiversx/sdk-core"

import { 
    TIMESTAMP,
    POOL_ID,
    TIMESTAMP_BEFORE,
    TIMESTAMP_WITH_DELAY
} from "../helpers";

const codec = new BinaryCodec();

const signerPemDeployer = fs.readFileSync(path.resolve(process.cwd(), 'tests/wallets/deployer.pem')).toString();
export const privateKeyDeployer = UserSecretKey.fromPem(signerPemDeployer);
export const deployerAddress = privateKeyDeployer.generatePublicKey().toAddress().pubkey();
const DATA_DEPLOYER = Buffer.concat([
    codec.encodeNested(new U64Value(TIMESTAMP)),
    codec.encodeNested(new U32Value(POOL_ID)),
    deployerAddress,
  ]);
export const SIGNATURE_DEPLOYER = privateKeyDeployer.sign(DATA_DEPLOYER);

export const SIGNATURE_DUMMY = privateKeyDeployer.sign(Buffer.from("SOME DUMMY DATA")); 

const DATA_BEFORE = Buffer.concat([
    codec.encodeNested(new U64Value(TIMESTAMP_BEFORE)),
    codec.encodeNested(new U32Value(POOL_ID)),
    deployerAddress,
  ]);
export const SIGNATURE_BEFORE = privateKeyDeployer.sign(DATA_BEFORE);

 