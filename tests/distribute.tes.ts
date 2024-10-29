import { test, beforeEach, afterEach, expect } from "vitest";
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
  CURRENCY1,
  CURRENCY2,
  CURRENCY3,
  CURRENCY1_DEPOSIT_AMOUNT,
  CURRENCY2_DEPOSIT_AMOUNT,
  CURRENCY3_DEPOSIT_AMOUNT,
  DUMMY_TOKEN,
  CURRENCY1_DISTRIBUTE_AMOUNT,
  ONE_EGLD,
  ONE_TENTH_EGLD,
  EGLD_AS_ESDT,
  BATCH_ID,
  INCORRECT_BATCH_ID,
} from "./helpers.ts";

import { SIGNATURE_DATA_BOB_DISTRUBUTE } from "./signatures/bob.ts";

import {
  deployerAddress,
  SIGNATURE_DUMMY,
  SIGNATURE_DATA_DEPLOYER_DISTRUBUTE,
} from "./signatures/deployer.ts";

let world: LSWorld;
let deployer: LSWallet;
let alice: LSWallet;
let bob: LSWallet;
let carol: LSWallet;
let platform_wallet: LSWallet;
let distributionContract: LSContract;

beforeEach(async () => {
  world = await LSWorld.start({
    binaryPath:
      "/home/andrei/buidly/cryptool/xSuite/xsuite-lightsimulnet-linux-amd64/bin/lsproxy",
  });
  await world.setCurrentBlockInfo({
    timestamp: TIMESTAMP,
  });
  deployer = await world.createWallet({
    address: deployerAddress,
    balance: ONE_EGLD,
    kvs: [
      e.kvs.Esdts([
        { id: DUMMY_TOKEN, amount: CURRENCY1_DEPOSIT_AMOUNT },
        { id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT },
        { id: CURRENCY2, amount: CURRENCY2_DEPOSIT_AMOUNT },
        { id: CURRENCY3, amount: CURRENCY3_DEPOSIT_AMOUNT },
        { id: EGLD_AS_ESDT, amount: ONE_EGLD },
      ]),
    ],
  });

  alice = await world.createWallet();
  bob = await world.createWallet();
  carol = await world.createWallet();
  platform_wallet = await world.createWallet();

  ({ contract: distributionContract } = await deployer.deployContract({
    code: "file:distribution/output/distribution.wasm",
    codeMetadata: [],
    codeArgs: [e.Addr(platform_wallet), e.Addr(deployer)],
    gasLimit: 10_000_000,
  }));
});

afterEach(async () => {
  world.terminate();
});

test("Distribute by non owner", async () => {
  let platform_wallet = await world.createWallet();
  await bob
    .callContract({
      callee: distributionContract,
      gasLimit: 50_000_000,
      funcName: "distribute",
      funcArgs: [
        e.Str(POOL_ID),
        e.U32(BATCH_ID),
        e.U64(TIMESTAMP),
        e.TopBuffer(SIGNATURE_DATA_BOB_DISTRUBUTE),
        e.Addr(alice),
        e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
        e.Addr(bob),
        e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
        e.Addr(carol),
        e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
      ],
    })
    .assertFail({ code: 10, message: "invalid signature" });
});

test("Distribute with wrong batch", async () => {
  await deployer
    .callContract({
      callee: distributionContract,
      gasLimit: 50_000_000,
      funcName: "distribute",
      funcArgs: [
        e.Str(POOL_ID),
        e.U32(INCORRECT_BATCH_ID),
        e.U64(TIMESTAMP),
        e.TopBuffer(SIGNATURE_DATA_DEPLOYER_DISTRUBUTE),
        e.Addr(alice),
        e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
        e.Addr(bob),
        e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
        e.Addr(carol),
        e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
      ],
      esdts: [
        { id: EGLD_AS_ESDT, amount: ONE_TENTH_EGLD },
        { id: CURRENCY1, amount: CURRENCY1_DISTRIBUTE_AMOUNT },
      ],
    })
    .assertFail({ code: 4, message: "Invalid batch id" });
});

test("Distribute with invalid timestamp", async () => {
  await world.setCurrentBlockInfo({
    timestamp: TIMESTAMP - 10,
  });

  let platform_wallet = await world.createWallet();
  await deployer
    .callContract({
      callee: distributionContract,
      gasLimit: 50_000_000,
      funcName: "distribute",
      funcArgs: [
        e.Str(POOL_ID),
        e.U32(BATCH_ID),
        e.U64(TIMESTAMP),
        e.TopBuffer(SIGNATURE_DATA_DEPLOYER_DISTRUBUTE),
        e.Addr(alice),
        e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
        e.Addr(bob),
        e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
        e.Addr(carol),
        e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
      ],
      esdts: [
        { id: EGLD_AS_ESDT, amount: ONE_TENTH_EGLD },
        { id: CURRENCY1, amount: CURRENCY1_DISTRIBUTE_AMOUNT },
      ],
    })
    .assertFail({ code: 4, message: "Deposit took too long" });
});

test("Distribute with wrong signature", async () => {
  await deployer
    .callContract({
      callee: distributionContract,
      gasLimit: 50_000_000,
      funcName: "distribute",
      funcArgs: [
        e.Str(POOL_ID),
        e.U32(BATCH_ID),
        e.U64(TIMESTAMP),
        e.TopBuffer(SIGNATURE_DUMMY),
        e.Addr(alice),
        e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
        e.Addr(bob),
        e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
        e.Addr(carol),
        e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
      ],
      esdts: [
        { id: EGLD_AS_ESDT, amount: ONE_TENTH_EGLD },
        { id: CURRENCY1, amount: CURRENCY1_DISTRIBUTE_AMOUNT },
      ],
    })
    .assertFail({ code: 10, message: "invalid signature" });
});

test("Distribute with no payment", async () => {
  await deployer
    .callContract({
      callee: distributionContract,
      gasLimit: 50_000_000,
      funcName: "distribute",
      funcArgs: [
        e.Str(POOL_ID),
        e.U32(BATCH_ID),
        e.U64(TIMESTAMP),
        e.TopBuffer(SIGNATURE_DATA_DEPLOYER_DISTRUBUTE),
        e.Addr(alice),
        e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
        e.Addr(bob),
        e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
        e.Addr(carol),
        e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
      ],
    })
    .assertFail({
      code: 4,
      message: "Two payments are expected, one for EGLD and one for ESDT",
    });
});

test("Distribute", async () => {
  await deployer.callContract({
    callee: distributionContract,
    gasLimit: 50_000_000,
    funcName: "distribute",
    funcArgs: [
      e.Str(POOL_ID),
      e.U32(BATCH_ID),
      e.U64(TIMESTAMP),
      e.TopBuffer(SIGNATURE_DATA_DEPLOYER_DISTRUBUTE),
      e.Addr(alice),
      e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
      e.Addr(bob),
      e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
      e.Addr(carol),
      e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
    ],
    esdts: [
      { id: EGLD_AS_ESDT, amount: ONE_TENTH_EGLD },
      { id: CURRENCY1, amount: CURRENCY1_DISTRIBUTE_AMOUNT },
    ],
  });

  assertAccount(await world.getAccount(alice), {
    kvs: [
      e.kvs.Esdts([
        { id: CURRENCY1, amount: CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3) },
      ]),
    ],
  });

  assertAccount(await world.getAccount(bob), {
    kvs: [
      e.kvs.Esdts([
        { id: CURRENCY1, amount: CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3) },
      ]),
    ],
  });

  assertAccount(await world.getAccount(carol), {
    kvs: [
      e.kvs.Esdts([
        { id: CURRENCY1, amount: CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3) },
      ]),
    ],
  });

  assertAccount(await world.getAccount(platform_wallet), {
    balance: ONE_TENTH_EGLD,
  });

  assertAccount(await distributionContract.getAccount(), {
    balance: 0n,
    kvs: [
      e.kvs.Mapper("batch_id", e.Str(POOL_ID)).Value(e.U32(BATCH_ID + 1)),
      e.kvs.Mapper("platform_fee_wallet").Value(e.Addr(platform_wallet)),
      e.kvs.Mapper("signer").Value(e.Addr(deployer)),
    ],
  });
});
