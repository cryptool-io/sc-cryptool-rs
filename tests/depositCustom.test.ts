import { test, beforeEach, afterEach } from "vitest";
import { e } from "xsuite";

import {
  assertAccount,
  LSWorld,
  LSWallet,
  LSContract,
  Encodable,
} from "xsuite";

import {
  POOL_ID,
  TIMESTAMP,
  SOFT_CAP,
  HARD_CAP,
  CURRENCY1,
  DECIMALS1,
  CURRENCY2,
  DECIMALS2,
  CURRENCY3,
  DECIMALS3,
  MIN_DEPOSIT,
  MAX_DEPOSIT,
  DEPOSIT_INCREMENTS,
  START_DATE,
  END_DATE,
  REFUND_ENABLED,
  PLATFORM_FEE1,
  GROUP_FEE1,
  AMBASSADOR_FEE1,
  DEPOSIT_TIMESTAMP,
  CURRENCY1_DEPOSIT_AMOUNT,
  CURRENCY1_DEPOSIT_TOO_LOW,
  CURRENCY2_DEPOSIT_AMOUNT,
  CURRENCY3_DEPOSIT_AMOUNT,
  PLATFORM_FEE2,
  GROUP_FEE2,
  TIMESTAMP_AFTER,
  TIMESTAMP_WITH_DELAY,
  CURRENCY1_DEPOSIT_MAX,
  CURRENCY2_DEPOSIT_MAX,
  LOW_SOFT_CAP,
  LOW_HARD_CAP,
  CURRENCY1_DEPOSIT_INCORECT_AMOUNT,
  DUMMY_TOKEN,
  HIGH_HARD_CAP,
  AFTER_DEPOSIT_TIMESTAMP,
  DEPOSIT_ID,
  PAYMENT_NETWORK_ID,
} from "./helpers.ts";

import {
  deployerAddress,
  SIGNATURE_DEPLOYER,
  SIGNATURE_DUMMY,
} from "./signatures/deployer.ts";

import {
  bobAddress,
  SIGNATURE_BOB_WITH_AMBASSADOR,
  SIGNATURE_BOB_AFTER,
  SIGNATURE_BOB_WALLET,
  SIGNATURE_BOB_AFTER_DEPOSIT,
  SIGNATURE_DATA_BOB_CUSTOM,
} from "./signatures/bob.ts";

import {
  carolAddress,
  SIGNATURE_CAROL_WALLET,
  SIGNATURE_CAROL_WITHOUT_AMBASSADOR,
} from "./signatures/carol.ts";

import {
  generateDataAndSignature,
  getRandomInt,
  getRandomDeposit,
  generateDataAndSignatureDeployerAmbassador,
} from "./generator.ts";
import { Kvs } from "xsuite/dist/data/kvs";

let world: LSWorld;
let deployer: LSWallet;
let bob: LSWallet;
let carol: LSWallet;
let genericWallet: LSWallet;
let factoryContract: LSContract;
let raisePoolDummyContract: LSContract;
let walletDababaseContract: LSContract;

beforeEach(async () => {
  world = await LSWorld.start();
  await world.setCurrentBlockInfo({
    timestamp: TIMESTAMP,
  });
  deployer = await world.createWallet({ address: deployerAddress });

  ({ contract: walletDababaseContract } = await deployer.deployContract({
    code: "file:wallet-database/output/wallet-database.wasm",
    codeMetadata: [],
    codeArgs: [e.Addr(deployer)],
    gasLimit: 10_000_000,
  }));

  ({ contract: raisePoolDummyContract } = await deployer.deployContract({
    code: "file:raise-pool/output/raise-pool.wasm",
    codeMetadata: [],
    codeArgs: [
      e.Addr(deployer),
      e.Str("0"), // POOL ID
      e.U64(0), // SOFT CAP
      e.U64(10), // HARD CAP
      e.U64(1), // MIN DEPOSIT
      e.U64(10), // MAX DEPOSIT
      e.U64(1), // DEPOSIT INCREMENTS
      e.U64(121), // START DATE
      e.U64(122), // END DATE
      e.U64(1), // REFUND ENABLED
      e.U64(122), // REFUND DEADLINE
      e.Addr(deployer), // PLATFORM FEE WALLET
      e.Addr(deployer), // GROUP FEE WALLET
      e.Addr(deployer), // SIGNER WALLET
      e.Addr(walletDababaseContract), // WALLET DATABASE CONTRACT
      e.Str("Dummy1"), // CURRENCY1
      e.U32(0), // DECIMALS1
      e.Str("Dummy2"), // CURRENCY2
      e.U32(0), // DECIMALS2
    ],
    gasLimit: 10_000_000,
  }));

  ({ contract: factoryContract } = await deployer.deployContract({
    code: "file:factory/output/factory.wasm",
    codeMetadata: [],
    gasLimit: 10_000_000,
    codeArgs: [
      e.Addr(raisePoolDummyContract),
      e.Addr(walletDababaseContract),
      e.Addr(deployer),
      e.Str(CURRENCY1),
      e.U64(6),
      e.Str(CURRENCY2),
      e.U64(6),
      e.Str(CURRENCY3),
      e.U64(6),
    ],
  }));
});

afterEach(async () => {
  world.terminate();
});

test("Deposit Currency1 with Bob", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.Str(POOL_ID),
      e.U64(4000000),
      e.U64(4000000),
      e.U64(1000000),
      e.U64(4000000),
      e.U64(DEPOSIT_INCREMENTS),
      e.U64(START_DATE),
      e.U64(END_DATE),
      e.U64(REFUND_ENABLED),
      e.U64(END_DATE),
      e.Addr(deployer),
      e.Addr(deployer),
      e.TopBuffer(SIGNATURE_DEPLOYER),
      e.U64(TIMESTAMP),
      e.Str(PAYMENT_NETWORK_ID),
      e.Str(CURRENCY1),
      e.Str(CURRENCY2),
    ],
  });

  const raisePoolAddressResult = await deployer.query({
    callee: factoryContract,
    funcName: "getPoolIdToAddress",
    funcArgs: [e.Str(POOL_ID)],
  });

  const raisePoolAddress = raisePoolAddressResult.returnData[0];

  const raisePoolContract = new LSContract({
    address: raisePoolAddress,
    world,
  });

  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "enableRaisePool",
    funcArgs: [
      e.U64(TIMESTAMP),
      e.Str(POOL_ID),
      e.TopBuffer(SIGNATURE_DEPLOYER),
      e.Bool(true),
    ],
  });

  await world.setCurrentBlockInfo({
    timestamp: DEPOSIT_TIMESTAMP,
  });

  bob = await world.createWallet({
    address: bobAddress,
    balance: 100_000,
    kvs: [e.kvs.Esdts([{ id: CURRENCY1, amount: 4870000 }])],
  });

  await bob.callContract({
    callee: walletDababaseContract,
    gasLimit: 50_000_000,
    funcName: "registerWallet",
    funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_BOB_WALLET)],
  });

  await bob.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "deposit",
    funcArgs: [
      e.U64(TIMESTAMP),
      e.TopBuffer(SIGNATURE_DATA_BOB_CUSTOM),
      e.U(19480),
      e.U(876600),
      e.Str(DEPOSIT_ID),
    ],
    esdts: [{ id: CURRENCY1, amount: 4870000 }],
  });
});
