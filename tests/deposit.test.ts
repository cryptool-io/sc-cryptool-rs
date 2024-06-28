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
  AMBASSADOR_FEE,
  DEPOSIT_TIMESTAMP,
  CURRENCY1_DEPOSIT_AMOUNT,
  CURRENCY1_DEPOSIT_TOO_LOW,
  CURRENCY2_DEPOSIT_AMOUNT,
  CURRENCY3_DEPOSIT_AMOUNT,
  MAX_PERCENTAGE,
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
} from "./signatures/bob.ts";

import {
  carolAddress,
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
let generic_wallet: LSWallet;
let factoryContract: LSContract;
let raisePoolDummyContract: LSContract;

beforeEach(async () => {
  world = await LSWorld.start();
  await world.setCurrentBlockInfo({
    timestamp: TIMESTAMP,
  });
  deployer = await world.createWallet({ address: deployerAddress });

  ({ contract: raisePoolDummyContract } = await deployer.deployContract({
    code: "file:raise-pool/output/raise-pool.wasm",
    codeMetadata: [],
    codeArgs: [
      e.U64(0),
      e.U64(0),
      e.U64(10),
      e.U64(1),
      e.U64(5),
      e.U64(2),
      e.U64(121),
      e.U64(122),
      e.U64(1),
      e.Addr(deployer),
      e.Addr(deployer),
      e.Addr(deployer),
      e.Str("Dummy1"),
      e.U64(0),
      e.Str("Dummy2"),
      e.U64(0),
    ],
    gasLimit: 10_000_000,
  }));

  ({ contract: factoryContract } = await deployer.deployContract({
    code: "file:factory/output/factory.wasm",
    codeMetadata: [],
    gasLimit: 10_000_000,
    codeArgs: [e.Addr(raisePoolDummyContract), e.Addr(deployer)],
  }));
});

afterEach(async () => {
  world.terminate();
});
 
test("Deposit with invalid signature", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.U32(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
      e.U64(DEPOSIT_INCREMENTS),
      e.U64(START_DATE),
      e.U64(END_DATE),
      e.U64(REFUND_ENABLED),
      e.Addr(deployer),
      e.Addr(deployer),
      e.TopBuffer(SIGNATURE_DEPLOYER),
      e.U64(TIMESTAMP),
      e.Str(CURRENCY1),
      e.U64(DECIMALS1),
      e.Str(CURRENCY2),
      e.U64(DECIMALS2),
    ],
  });

  const raisePoolAddressResult = await deployer.query({
    callee: factoryContract,
    funcName: "getPoolIdToAddress",
    funcArgs: [e.U32(POOL_ID)],
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
    funcArgs: [e.U32(POOL_ID)],
  });

  bob = await world.createWallet({
    address: bobAddress,
    balance: 100_000,
    kvs: [
      e.kvs.Esdts([
        { id: CURRENCY1, amount: 2_000_000 },
        { id: CURRENCY2, amount: 1_000_000 },
      ]),
    ],
  });

  await bob
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "deposit",
      funcArgs: [
        e.U64(TIMESTAMP),
        e.TopBuffer(SIGNATURE_DUMMY),
        e.U(PLATFORM_FEE1),
        e.U(GROUP_FEE1),
        e.U(AMBASSADOR_FEE),
        e.Addr(deployer),
      ],
      esdts: [{ id: CURRENCY1, amount: 100_000 }],
    })
    .assertFail({ code: 10, message: "invalid signature" });
});

test("Deposit with invalid token", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.U32(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
      e.U64(DEPOSIT_INCREMENTS),
      e.U64(START_DATE),
      e.U64(END_DATE),
      e.U64(REFUND_ENABLED),
      e.Addr(deployer),
      e.Addr(deployer),
      e.TopBuffer(SIGNATURE_DEPLOYER),
      e.U64(TIMESTAMP),
      e.Str(CURRENCY1),
      e.U64(DECIMALS1),
      e.Str(CURRENCY2),
      e.U64(DECIMALS2),
      e.Str(CURRENCY3),
      e.U64(DECIMALS3),
    ],
  });

  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "enableRaisePool",
    funcArgs: [e.U32(POOL_ID)],
  });

  const raisePoolAddressResult = await deployer.query({
    callee: factoryContract,
    funcName: "getPoolIdToAddress",
    funcArgs: [e.U32(POOL_ID)],
  });

  const raisePoolAddress = raisePoolAddressResult.returnData[0];

  const raisePoolContract = new LSContract({
    address: raisePoolAddress,
    world,
  });

  await world.setCurrentBlockInfo({
    timestamp: DEPOSIT_TIMESTAMP,
  });

  bob = await world.createWallet({
    address: bobAddress,
    balance: 100_000,
    kvs: [
      e.kvs.Esdts([
        { id: DUMMY_TOKEN, amount: CURRENCY1_DEPOSIT_AMOUNT * BigInt(100) },
      ]),
    ],
  });

  await bob
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "deposit",
      funcArgs: [
        e.U64(TIMESTAMP),
        e.TopBuffer(SIGNATURE_BOB_WITH_AMBASSADOR),
        e.U(PLATFORM_FEE1),
        e.U(GROUP_FEE1),
        e.U(AMBASSADOR_FEE),
        e.Addr(deployer),
      ],
      esdts: [{ id: DUMMY_TOKEN, amount: CURRENCY1_DEPOSIT_AMOUNT }],
    })
    .assertFail({ code: 4, message: "Invalid token payment" });
});

test("Deposit while deposits not open yet", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.U32(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
      e.U64(DEPOSIT_INCREMENTS),
      e.U64(START_DATE),
      e.U64(END_DATE),
      e.U64(REFUND_ENABLED),
      e.Addr(deployer),
      e.Addr(deployer),
      e.TopBuffer(SIGNATURE_DEPLOYER),
      e.U64(TIMESTAMP),
      e.Str(CURRENCY1),
      e.U64(DECIMALS1),
      e.Str(CURRENCY2),
      e.U64(DECIMALS2),
    ],
  });

  const raisePoolAddressResult = await deployer.query({
    callee: factoryContract,
    funcName: "getPoolIdToAddress",
    funcArgs: [e.U32(POOL_ID)],
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
    funcArgs: [e.U32(POOL_ID)],
  });

  bob = await world.createWallet({
    address: bobAddress,
    balance: 100_000,
    kvs: [
      e.kvs.Esdts([
        { id: CURRENCY1, amount: 2_000_000 },
        { id: CURRENCY2, amount: 1_000_000 },
      ]),
    ],
  });

  await bob
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "deposit",
      funcArgs: [
        e.U64(TIMESTAMP_AFTER),
        e.TopBuffer(SIGNATURE_BOB_AFTER),
        e.U(PLATFORM_FEE1),
        e.U(GROUP_FEE1),
        e.U(AMBASSADOR_FEE),
        e.Addr(deployer),
      ],
      esdts: [{ id: CURRENCY1, amount: 100_000 }],
    })
    .assertFail({ code: 4, message: "Deposits not open yet" });
});

test("Deposit while deposits closed", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.U32(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
      e.U64(DEPOSIT_INCREMENTS),
      e.U64(START_DATE),
      e.U64(END_DATE),
      e.U64(REFUND_ENABLED),
      e.Addr(deployer),
      e.Addr(deployer),
      e.TopBuffer(SIGNATURE_DEPLOYER),
      e.U64(TIMESTAMP),
      e.Str(CURRENCY1),
      e.U64(DECIMALS1),
      e.Str(CURRENCY2),
      e.U64(DECIMALS2),
    ],
  });

  const raisePoolAddressResult = await deployer.query({
    callee: factoryContract,
    funcName: "getPoolIdToAddress",
    funcArgs: [e.U32(POOL_ID)],
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
    funcArgs: [e.U32(POOL_ID)],
  });

  await world.setCurrentBlockInfo({
    timestamp: TIMESTAMP_AFTER,
  });

  bob = await world.createWallet({
    address: bobAddress,
    balance: 100_000,
    kvs: [e.kvs.Esdts([{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }])],
  });

  await bob
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "deposit",
      funcArgs: [
        e.U64(TIMESTAMP_AFTER),
        e.TopBuffer(SIGNATURE_BOB_AFTER),
        e.U(PLATFORM_FEE1),
        e.U(GROUP_FEE1),
        e.U(AMBASSADOR_FEE),
        e.Addr(deployer),
      ],
      esdts: [{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }],
    })
    .assertFail({ code: 4, message: "Deposits closed" });
});

test("Deposit with too much delay", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.U32(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
      e.U64(DEPOSIT_INCREMENTS),
      e.U64(START_DATE),
      e.U64(END_DATE),
      e.U64(REFUND_ENABLED),
      e.Addr(deployer),
      e.Addr(deployer),
      e.TopBuffer(SIGNATURE_DEPLOYER),
      e.U64(TIMESTAMP),
      e.Str(CURRENCY1),
      e.U64(DECIMALS1),
      e.Str(CURRENCY2),
      e.U64(DECIMALS2),
      e.Str(CURRENCY3),
      e.U64(DECIMALS3),
    ],
  });

  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "enableRaisePool",
    funcArgs: [e.U32(POOL_ID)],
  });

  const raisePoolAddressResult = await deployer.query({
    callee: factoryContract,
    funcName: "getPoolIdToAddress",
    funcArgs: [e.U32(POOL_ID)],
  });

  const raisePoolAddress = raisePoolAddressResult.returnData[0];

  const raisePoolContract = new LSContract({
    address: raisePoolAddress,
    world,
  });

  await world.setCurrentBlockInfo({
    timestamp: TIMESTAMP_WITH_DELAY,
  });

  bob = await world.createWallet({
    address: bobAddress,
    balance: 100_000,
    kvs: [
      e.kvs.Esdts([
        { id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT },
        { id: CURRENCY2, amount: CURRENCY2_DEPOSIT_AMOUNT },
      ]),
    ],
  });

  await bob
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "deposit",
      funcArgs: [
        e.U64(TIMESTAMP),
        e.TopBuffer(SIGNATURE_BOB_WITH_AMBASSADOR),
        e.U(PLATFORM_FEE1),
        e.U(GROUP_FEE1),
        e.U(AMBASSADOR_FEE),
        e.Addr(deployer),
      ],
      esdts: [{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }],
    })
    .assertFail({ code: 4, message: "Deposit took too long" });
});

test("Deposit in not enabled pool", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.U32(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
      e.U64(DEPOSIT_INCREMENTS),
      e.U64(START_DATE),
      e.U64(END_DATE),
      e.U64(REFUND_ENABLED),
      e.Addr(deployer),
      e.Addr(deployer),
      e.TopBuffer(SIGNATURE_DEPLOYER),
      e.U64(TIMESTAMP),
      e.Str(CURRENCY1),
      e.U64(DECIMALS1),
      e.Str(CURRENCY2),
      e.U64(DECIMALS2),
    ],
  });

  const raisePoolAddressResult = await deployer.query({
    callee: factoryContract,
    funcName: "getPoolIdToAddress",
    funcArgs: [e.U32(POOL_ID)],
  });

  const raisePoolAddress = raisePoolAddressResult.returnData[0];

  const raisePoolContract = new LSContract({
    address: raisePoolAddress,
    world,
  });

  await world.setCurrentBlockInfo({
    timestamp: DEPOSIT_TIMESTAMP,
  });

  bob = await world.createWallet({
    address: bobAddress,
    balance: 100_000,
    kvs: [
      e.kvs.Esdts([
        { id: CURRENCY1, amount: 2_000_000 },
        { id: CURRENCY2, amount: 1_000_000 },
      ]),
    ],
  });

  await bob
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "deposit",
      funcArgs: [
        e.U64(TIMESTAMP),
        e.TopBuffer(SIGNATURE_BOB_WITH_AMBASSADOR),
        e.U(PLATFORM_FEE1),
        e.U(GROUP_FEE1),
        e.U(AMBASSADOR_FEE),
        e.Addr(deployer),
      ],
      esdts: [{ id: CURRENCY1, amount: 100_000 }],
    })
    .assertFail({ code: 4, message: "Pool is not enabled" });
});

test("Deposit amount too low", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.U32(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
      e.U64(DEPOSIT_INCREMENTS),
      e.U64(START_DATE),
      e.U64(END_DATE),
      e.U64(REFUND_ENABLED),
      e.Addr(deployer),
      e.Addr(deployer),
      e.TopBuffer(SIGNATURE_DEPLOYER),
      e.U64(TIMESTAMP),
      e.Str(CURRENCY1),
      e.U64(DECIMALS1),
      e.Str(CURRENCY2),
      e.U64(DECIMALS2),
      e.Str(CURRENCY3),
      e.U64(DECIMALS3),
    ],
  });

  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "enableRaisePool",
    funcArgs: [e.U32(POOL_ID)],
  });

  const raisePoolAddressResult = await deployer.query({
    callee: factoryContract,
    funcName: "getPoolIdToAddress",
    funcArgs: [e.U32(POOL_ID)],
  });

  const raisePoolAddress = raisePoolAddressResult.returnData[0];

  const raisePoolContract = new LSContract({
    address: raisePoolAddress,
    world,
  });

  await world.setCurrentBlockInfo({
    timestamp: DEPOSIT_TIMESTAMP,
  });

  bob = await world.createWallet({
    address: bobAddress,
    balance: 100_000,
    kvs: [
      e.kvs.Esdts([
        { id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT },
        { id: CURRENCY2, amount: CURRENCY2_DEPOSIT_AMOUNT },
      ]),
    ],
  });

  await bob
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "deposit",
      funcArgs: [
        e.U64(TIMESTAMP),
        e.TopBuffer(SIGNATURE_BOB_WITH_AMBASSADOR),
        e.U(PLATFORM_FEE1),
        e.U(GROUP_FEE1),
        e.U(AMBASSADOR_FEE),
        e.Addr(deployer),
      ],
      esdts: [{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_TOO_LOW }],
    })
    .assertFail({ code: 4, message: "Payment amount too low" });
});

test("Deposit amount too high", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.U32(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
      e.U64(DEPOSIT_INCREMENTS),
      e.U64(START_DATE),
      e.U64(END_DATE),
      e.U64(REFUND_ENABLED),
      e.Addr(deployer),
      e.Addr(deployer),
      e.TopBuffer(SIGNATURE_DEPLOYER),
      e.U64(TIMESTAMP),
      e.Str(CURRENCY1),
      e.U64(DECIMALS1),
      e.Str(CURRENCY2),
      e.U64(DECIMALS2),
      e.Str(CURRENCY3),
      e.U64(DECIMALS3),
    ],
  });

  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "enableRaisePool",
    funcArgs: [e.U32(POOL_ID)],
  });

  const raisePoolAddressResult = await deployer.query({
    callee: factoryContract,
    funcName: "getPoolIdToAddress",
    funcArgs: [e.U32(POOL_ID)],
  });

  const raisePoolAddress = raisePoolAddressResult.returnData[0];

  const raisePoolContract = new LSContract({
    address: raisePoolAddress,
    world,
  });

  await world.setCurrentBlockInfo({
    timestamp: DEPOSIT_TIMESTAMP,
  });

  bob = await world.createWallet({
    address: bobAddress,
    balance: 100_000,
    kvs: [
      e.kvs.Esdts([
        { id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT * BigInt(100) },
      ]),
    ],
  });

  await bob
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "deposit",
      funcArgs: [
        e.U64(TIMESTAMP),
        e.TopBuffer(SIGNATURE_BOB_WITH_AMBASSADOR),
        e.U(PLATFORM_FEE1),
        e.U(GROUP_FEE1),
        e.U(AMBASSADOR_FEE),
        e.Addr(deployer),
      ],
      esdts: [{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT * BigInt(3) }],
    })
    .assertFail({ code: 4, message: "Payment amount too high" });
});

test("Deposit but max deposit threshold would be exceeded", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.U32(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
      e.U64(DEPOSIT_INCREMENTS),
      e.U64(START_DATE),
      e.U64(END_DATE),
      e.U64(REFUND_ENABLED),
      e.Addr(deployer),
      e.Addr(deployer),
      e.TopBuffer(SIGNATURE_DEPLOYER),
      e.U64(TIMESTAMP),
      e.Str(CURRENCY1),
      e.U64(DECIMALS1),
      e.Str(CURRENCY2),
      e.U64(DECIMALS2),
      e.Str(CURRENCY3),
      e.U64(DECIMALS3),
    ],
  });

  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "enableRaisePool",
    funcArgs: [e.U32(POOL_ID)],
  });

  const raisePoolAddressResult = await deployer.query({
    callee: factoryContract,
    funcName: "getPoolIdToAddress",
    funcArgs: [e.U32(POOL_ID)],
  });

  const raisePoolAddress = raisePoolAddressResult.returnData[0];

  const raisePoolContract = new LSContract({
    address: raisePoolAddress,
    world,
  });

  await world.setCurrentBlockInfo({
    timestamp: DEPOSIT_TIMESTAMP,
  });

  bob = await world.createWallet({
    address: bobAddress,
    balance: 100_000,
    kvs: [
      e.kvs.Esdts([
        { id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT * BigInt(100) },
        { id: CURRENCY2, amount: CURRENCY2_DEPOSIT_AMOUNT * BigInt(100) },
      ]),
    ],
  });

  await bob.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "deposit",
    funcArgs: [
      e.U64(TIMESTAMP),
      e.TopBuffer(SIGNATURE_BOB_WITH_AMBASSADOR),
      e.U(PLATFORM_FEE1),
      e.U(GROUP_FEE1),
      e.U(AMBASSADOR_FEE),
      e.Addr(deployer),
    ],
    esdts: [{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }],
  });

  await bob.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "deposit",
    funcArgs: [
      e.U64(TIMESTAMP),
      e.TopBuffer(SIGNATURE_BOB_WITH_AMBASSADOR),
      e.U(PLATFORM_FEE1),
      e.U(GROUP_FEE1),
      e.U(AMBASSADOR_FEE),
      e.Addr(deployer),
    ],
    esdts: [{ id: CURRENCY2, amount: CURRENCY2_DEPOSIT_AMOUNT }],
  });

  await bob
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "deposit",
      funcArgs: [
        e.U64(TIMESTAMP),
        e.TopBuffer(SIGNATURE_BOB_WITH_AMBASSADOR),
        e.U(PLATFORM_FEE1),
        e.U(GROUP_FEE1),
        e.U(AMBASSADOR_FEE),
        e.Addr(deployer),
      ],
      esdts: [{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }],
    })
    .assertFail({
      code: 4,
      message: "Max_deposit threshold would be exceeded",
    });
});

test("Deposit but hard cap threshold would be exceeded", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.U32(POOL_ID),
      e.U64(LOW_SOFT_CAP),
      e.U64(LOW_HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
      e.U64(DEPOSIT_INCREMENTS),
      e.U64(START_DATE),
      e.U64(END_DATE),
      e.U64(REFUND_ENABLED),
      e.Addr(deployer),
      e.Addr(deployer),
      e.TopBuffer(SIGNATURE_DEPLOYER),
      e.U64(TIMESTAMP),
      e.Str(CURRENCY1),
      e.U64(DECIMALS1),
      e.Str(CURRENCY2),
      e.U64(DECIMALS2),
      e.Str(CURRENCY3),
      e.U64(DECIMALS3),
    ],
  });

  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "enableRaisePool",
    funcArgs: [e.U32(POOL_ID)],
  });

  const raisePoolAddressResult = await deployer.query({
    callee: factoryContract,
    funcName: "getPoolIdToAddress",
    funcArgs: [e.U32(POOL_ID)],
  });

  const raisePoolAddress = raisePoolAddressResult.returnData[0];

  const raisePoolContract = new LSContract({
    address: raisePoolAddress,
    world,
  });

  await world.setCurrentBlockInfo({
    timestamp: DEPOSIT_TIMESTAMP,
  });

  bob = await world.createWallet({
    address: bobAddress,
    balance: 100_000,
    kvs: [e.kvs.Esdts([{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_MAX }])],
  });

  await bob.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "deposit",
    funcArgs: [
      e.U64(TIMESTAMP),
      e.TopBuffer(SIGNATURE_BOB_WITH_AMBASSADOR),
      e.U(PLATFORM_FEE1),
      e.U(GROUP_FEE1),
      e.U(AMBASSADOR_FEE),
      e.Addr(deployer),
    ],
    esdts: [{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_MAX }],
  });

  carol = await world.createWallet({
    address: carolAddress,
    balance: 100_000,
    kvs: [e.kvs.Esdts([{ id: CURRENCY2, amount: CURRENCY2_DEPOSIT_MAX }])],
  });

  await carol
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "deposit",
      funcArgs: [
        e.U64(TIMESTAMP),
        e.TopBuffer(SIGNATURE_CAROL_WITHOUT_AMBASSADOR),
        e.U(PLATFORM_FEE2),
        e.U(GROUP_FEE2),
      ],
      esdts: [{ id: CURRENCY2, amount: CURRENCY2_DEPOSIT_MAX }],
    })
    .assertFail({ code: 4, message: "Hard cap threshold would be exceeded" });
});

test("Deposit with incorect deposit increment", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.U32(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
      e.U64(DEPOSIT_INCREMENTS),
      e.U64(START_DATE),
      e.U64(END_DATE),
      e.U64(REFUND_ENABLED),
      e.Addr(deployer),
      e.Addr(deployer),
      e.TopBuffer(SIGNATURE_DEPLOYER),
      e.U64(TIMESTAMP),
      e.Str(CURRENCY1),
      e.U64(DECIMALS1),
      e.Str(CURRENCY2),
      e.U64(DECIMALS2),
    ],
  });

  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "enableRaisePool",
    funcArgs: [e.U32(POOL_ID)],
  });

  const raisePoolAddressResult = await deployer.query({
    callee: factoryContract,
    funcName: "getPoolIdToAddress",
    funcArgs: [e.U32(POOL_ID)],
  });

  const raisePoolAddress = raisePoolAddressResult.returnData[0];

  const raisePoolContract = new LSContract({
    address: raisePoolAddress,
    world,
  });

  await world.setCurrentBlockInfo({
    timestamp: DEPOSIT_TIMESTAMP,
  });

  bob = await world.createWallet({
    address: bobAddress,
    balance: 100_000,
    kvs: [e.kvs.Esdts([{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }])],
  });

  await bob
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "deposit",
      funcArgs: [
        e.U64(TIMESTAMP),
        e.TopBuffer(SIGNATURE_BOB_WITH_AMBASSADOR),
        e.U(PLATFORM_FEE1),
        e.U(GROUP_FEE1),
        e.U(AMBASSADOR_FEE),
        e.Addr(deployer),
      ],
      esdts: [{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_INCORECT_AMOUNT }],
    })
    .assertFail({
      code: 4,
      message: "Payment amount is not a multiple of the deposit increment",
    });
});

test("Deposit Currency1 with Bob", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.U32(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
      e.U64(DEPOSIT_INCREMENTS),
      e.U64(START_DATE),
      e.U64(END_DATE),
      e.U64(REFUND_ENABLED),
      e.Addr(deployer),
      e.Addr(deployer),
      e.TopBuffer(SIGNATURE_DEPLOYER),
      e.U64(TIMESTAMP),
      e.Str(CURRENCY1),
      e.U64(DECIMALS1),
      e.Str(CURRENCY2),
      e.U64(DECIMALS2),
    ],
  });

  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "enableRaisePool",
    funcArgs: [e.U32(POOL_ID)],
  });

  const raisePoolAddressResult = await deployer.query({
    callee: factoryContract,
    funcName: "getPoolIdToAddress",
    funcArgs: [e.U32(POOL_ID)],
  });

  const raisePoolAddress = raisePoolAddressResult.returnData[0];

  const raisePoolContract = new LSContract({
    address: raisePoolAddress,
    world,
  });

  await world.setCurrentBlockInfo({
    timestamp: DEPOSIT_TIMESTAMP,
  });

  bob = await world.createWallet({
    address: bobAddress,
    balance: 100_000,
    kvs: [e.kvs.Esdts([{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }])],
  });

  await bob.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "deposit",
    funcArgs: [
      e.U64(TIMESTAMP),
      e.TopBuffer(SIGNATURE_BOB_WITH_AMBASSADOR),
      e.U(PLATFORM_FEE1),
      e.U(GROUP_FEE1),
      e.U(AMBASSADOR_FEE),
      e.Addr(deployer),
    ],
    esdts: [{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }],
  });

  assertAccount(await raisePoolContract.getAccount(), {
    balance: 0n,
    kvs: [
      e.kvs.Mapper("soft_cap").Value(e.I(SOFT_CAP)),
      e.kvs.Mapper("hard_cap").Value(e.I(HARD_CAP)),
      e.kvs.Mapper("min_deposit").Value(e.I(MIN_DEPOSIT)),
      e.kvs.Mapper("max_deposit").Value(e.I(MAX_DEPOSIT)),
      e.kvs.Mapper("deposit_increments").Value(e.I(DEPOSIT_INCREMENTS)),
      e.kvs.Mapper("start_date").Value(e.U64(START_DATE)),
      e.kvs.Mapper("end_date").Value(e.U64(END_DATE)),
      e.kvs.Mapper("refund_enabled").Value(e.Bool(Boolean(REFUND_ENABLED))),
      e.kvs.Mapper("platform_fee_wallet").Value(e.Addr(deployer)),
      e.kvs.Mapper("group_fee_wallet").Value(e.Addr(deployer)),
      e.kvs
        .Mapper("payment_currencies")
        .UnorderedSet([e.Str(CURRENCY1), e.Str(CURRENCY2)]),
      e.kvs
        .Mapper("currency_decimals", e.Str(CURRENCY1))
        .Value(e.U32(DECIMALS1)),
      e.kvs
        .Mapper("currency_decimals", e.Str(CURRENCY2))
        .Value(e.U32(DECIMALS2)),
      e.kvs.Mapper("raise_pool_enabled").Value(e.Bool(false)),
      e.kvs.Mapper("signer").Value(e.Addr(deployer)),
      e.kvs.Mapper("pool_id").Value(e.U32(POOL_ID)),
      e.kvs.Mapper("release_state").Value(e.Usize(0)),
      e.kvs.Mapper("raise_pool_enabled").Value(e.Bool(true)),
      e.kvs.Mapper("addresses").Set([[1, e.Addr(bob)]]),
      e.kvs
        .Mapper("deposited_currencies", e.Addr(bob))
        .UnorderedSet([e.Str(CURRENCY1)]),
      e.kvs
        .Mapper("deposited_amount", e.Addr(bob), e.Str(CURRENCY1))
        .Value(e.U(CURRENCY1_DEPOSIT_AMOUNT)),
      e.kvs.Mapper("total_amount").Value(e.U(CURRENCY1_DEPOSIT_AMOUNT)),
      e.kvs
        .Mapper("address_platform_fee", e.Addr(bob), e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * PLATFORM_FEE1) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("platform_fee", e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * PLATFORM_FEE1) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("total_platform_fee")
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * PLATFORM_FEE1) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("address_group_fee", e.Addr(bob), e.Str(CURRENCY1))
        .Value(e.U((CURRENCY1_DEPOSIT_AMOUNT * GROUP_FEE1) / MAX_PERCENTAGE)),
      e.kvs
        .Mapper("group_fee", e.Str(CURRENCY1))
        .Value(e.U((CURRENCY1_DEPOSIT_AMOUNT * GROUP_FEE1) / MAX_PERCENTAGE)),
      e.kvs
        .Mapper("total_group_fee")
        .Value(e.U((CURRENCY1_DEPOSIT_AMOUNT * GROUP_FEE1) / MAX_PERCENTAGE)),
      e.kvs.Mapper("ambassadors").Set([[1, e.Addr(deployer)]]),
      e.kvs
        .Mapper("address_ambassador_fee", e.Addr(bob), e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("ambassador_fee", e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("referral_ambassador_fee", e.Addr(deployer), e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("ambassador_currencies", e.Addr(deployer))
        .UnorderedSet([e.Str(CURRENCY1)]),
      e.kvs.Esdts([{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }]),
    ],
  });
});

test("Deposit Currency1, Currency2 with Bob", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.U32(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
      e.U64(DEPOSIT_INCREMENTS),
      e.U64(START_DATE),
      e.U64(END_DATE),
      e.U64(REFUND_ENABLED),
      e.Addr(deployer),
      e.Addr(deployer),
      e.TopBuffer(SIGNATURE_DEPLOYER),
      e.U64(TIMESTAMP),
      e.Str(CURRENCY1),
      e.U64(DECIMALS1),
      e.Str(CURRENCY2),
      e.U64(DECIMALS2),
    ],
  });

  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "enableRaisePool",
    funcArgs: [e.U32(POOL_ID)],
  });

  const raisePoolAddressResult = await deployer.query({
    callee: factoryContract,
    funcName: "getPoolIdToAddress",
    funcArgs: [e.U32(POOL_ID)],
  });

  const raisePoolAddress = raisePoolAddressResult.returnData[0];

  const raisePoolContract = new LSContract({
    address: raisePoolAddress,
    world,
  });

  await world.setCurrentBlockInfo({
    timestamp: DEPOSIT_TIMESTAMP,
  });

  bob = await world.createWallet({
    address: bobAddress,
    balance: 100_000,
    kvs: [
      e.kvs.Esdts([
        { id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT },
        { id: CURRENCY2, amount: CURRENCY2_DEPOSIT_AMOUNT },
      ]),
    ],
  });

  await bob.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "deposit",
    funcArgs: [
      e.U64(TIMESTAMP),
      e.TopBuffer(SIGNATURE_BOB_WITH_AMBASSADOR),
      e.U(PLATFORM_FEE1),
      e.U(GROUP_FEE1),
      e.U(AMBASSADOR_FEE),
      e.Addr(deployer),
    ],
    esdts: [{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }],
  });

  await bob.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "deposit",
    funcArgs: [
      e.U64(TIMESTAMP),
      e.TopBuffer(SIGNATURE_BOB_WITH_AMBASSADOR),
      e.U(PLATFORM_FEE1),
      e.U(GROUP_FEE1),
      e.U(AMBASSADOR_FEE),
      e.Addr(deployer),
    ],
    esdts: [{ id: CURRENCY2, amount: CURRENCY2_DEPOSIT_AMOUNT }],
  });

  const denominated_currency2 =
    BigInt(CURRENCY2_DEPOSIT_AMOUNT) * BigInt(10 ** (18 - DECIMALS2));
  const total_deposited_amount =
    BigInt(CURRENCY1_DEPOSIT_AMOUNT) + denominated_currency2;
  const total_platform_fee =
    (BigInt(CURRENCY1_DEPOSIT_AMOUNT) * BigInt(PLATFORM_FEE1)) /
      BigInt(MAX_PERCENTAGE) +
    (denominated_currency2 * BigInt(PLATFORM_FEE1)) / BigInt(MAX_PERCENTAGE);
  const total_group_fee =
    (BigInt(CURRENCY1_DEPOSIT_AMOUNT) * BigInt(GROUP_FEE1)) /
      BigInt(MAX_PERCENTAGE) +
    (denominated_currency2 * BigInt(GROUP_FEE1)) / BigInt(MAX_PERCENTAGE);

  assertAccount(await raisePoolContract.getAccount(), {
    balance: 0n,
    kvs: [
      e.kvs.Mapper("soft_cap").Value(e.I(SOFT_CAP)),
      e.kvs.Mapper("hard_cap").Value(e.I(HARD_CAP)),
      e.kvs.Mapper("min_deposit").Value(e.I(MIN_DEPOSIT)),
      e.kvs.Mapper("max_deposit").Value(e.I(MAX_DEPOSIT)),
      e.kvs.Mapper("deposit_increments").Value(e.I(DEPOSIT_INCREMENTS)),
      e.kvs.Mapper("start_date").Value(e.U64(START_DATE)),
      e.kvs.Mapper("end_date").Value(e.U64(END_DATE)),
      e.kvs.Mapper("refund_enabled").Value(e.Bool(Boolean(REFUND_ENABLED))),
      e.kvs.Mapper("platform_fee_wallet").Value(e.Addr(deployer)),
      e.kvs.Mapper("group_fee_wallet").Value(e.Addr(deployer)),
      e.kvs
        .Mapper("payment_currencies")
        .UnorderedSet([e.Str(CURRENCY1), e.Str(CURRENCY2)]),
      e.kvs
        .Mapper("currency_decimals", e.Str(CURRENCY1))
        .Value(e.U32(DECIMALS1)),
      e.kvs
        .Mapper("currency_decimals", e.Str(CURRENCY2))
        .Value(e.U32(DECIMALS2)),
      e.kvs.Mapper("raise_pool_enabled").Value(e.Bool(false)),
      e.kvs.Mapper("signer").Value(e.Addr(deployer)),
      e.kvs.Mapper("pool_id").Value(e.U32(POOL_ID)),
      e.kvs.Mapper("release_state").Value(e.Usize(0)),
      e.kvs.Mapper("raise_pool_enabled").Value(e.Bool(true)),
      e.kvs.Mapper("addresses").Set([[1, e.Addr(bob)]]),
      e.kvs
        .Mapper("deposited_currencies", e.Addr(bob))
        .UnorderedSet([e.Str(CURRENCY1), e.Str(CURRENCY2)]),
      e.kvs
        .Mapper("deposited_amount", e.Addr(bob), e.Str(CURRENCY1))
        .Value(e.U(CURRENCY1_DEPOSIT_AMOUNT)),
      e.kvs
        .Mapper("deposited_amount", e.Addr(bob), e.Str(CURRENCY2))
        .Value(e.U(CURRENCY2_DEPOSIT_AMOUNT)),
      e.kvs.Mapper("total_amount").Value(e.U(total_deposited_amount)),
      e.kvs
        .Mapper("address_platform_fee", e.Addr(bob), e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * PLATFORM_FEE1) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("address_platform_fee", e.Addr(bob), e.Str(CURRENCY2))
        .Value(
          e.U((CURRENCY2_DEPOSIT_AMOUNT * PLATFORM_FEE1) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("platform_fee", e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * PLATFORM_FEE1) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("platform_fee", e.Str(CURRENCY2))
        .Value(
          e.U((CURRENCY2_DEPOSIT_AMOUNT * PLATFORM_FEE1) / MAX_PERCENTAGE)
        ),
      e.kvs.Mapper("total_platform_fee").Value(e.U(total_platform_fee)),
      e.kvs
        .Mapper("address_group_fee", e.Addr(bob), e.Str(CURRENCY1))
        .Value(e.U((CURRENCY1_DEPOSIT_AMOUNT * GROUP_FEE1) / MAX_PERCENTAGE)),
      e.kvs
        .Mapper("address_group_fee", e.Addr(bob), e.Str(CURRENCY2))
        .Value(e.U((CURRENCY2_DEPOSIT_AMOUNT * GROUP_FEE1) / MAX_PERCENTAGE)),
      e.kvs
        .Mapper("group_fee", e.Str(CURRENCY1))
        .Value(e.U((CURRENCY1_DEPOSIT_AMOUNT * GROUP_FEE1) / MAX_PERCENTAGE)),
      e.kvs
        .Mapper("group_fee", e.Str(CURRENCY2))
        .Value(e.U((CURRENCY2_DEPOSIT_AMOUNT * GROUP_FEE1) / MAX_PERCENTAGE)),
      e.kvs.Mapper("total_group_fee").Value(e.U(total_group_fee)),
      e.kvs.Mapper("ambassadors").Set([[1, e.Addr(deployer)]]),
      e.kvs
        .Mapper("address_ambassador_fee", e.Addr(bob), e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("address_ambassador_fee", e.Addr(bob), e.Str(CURRENCY2))
        .Value(
          e.U((CURRENCY2_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("ambassador_fee", e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("ambassador_fee", e.Str(CURRENCY2))
        .Value(
          e.U((CURRENCY2_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("referral_ambassador_fee", e.Addr(deployer), e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("referral_ambassador_fee", e.Addr(deployer), e.Str(CURRENCY2))
        .Value(
          e.U((CURRENCY2_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("ambassador_currencies", e.Addr(deployer))
        .UnorderedSet([e.Str(CURRENCY1), e.Str(CURRENCY2)]),
      e.kvs.Esdts([{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }]),
      e.kvs.Esdts([{ id: CURRENCY2, amount: CURRENCY2_DEPOSIT_AMOUNT }]),
    ],
  });
});

test("Deposit Currency1, Currency2 with Bob, Currency3 with Carol", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.U32(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
      e.U64(DEPOSIT_INCREMENTS),
      e.U64(START_DATE),
      e.U64(END_DATE),
      e.U64(REFUND_ENABLED),
      e.Addr(deployer),
      e.Addr(deployer),
      e.TopBuffer(SIGNATURE_DEPLOYER),
      e.U64(TIMESTAMP),
      e.Str(CURRENCY1),
      e.U64(DECIMALS1),
      e.Str(CURRENCY2),
      e.U64(DECIMALS2),
      e.Str(CURRENCY3),
      e.U64(DECIMALS3),
    ],
  });

  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "enableRaisePool",
    funcArgs: [e.U32(POOL_ID)],
  });

  const raisePoolAddressResult = await deployer.query({
    callee: factoryContract,
    funcName: "getPoolIdToAddress",
    funcArgs: [e.U32(POOL_ID)],
  });

  const raisePoolAddress = raisePoolAddressResult.returnData[0];

  const raisePoolContract = new LSContract({
    address: raisePoolAddress,
    world,
  });

  await world.setCurrentBlockInfo({
    timestamp: DEPOSIT_TIMESTAMP,
  });

  bob = await world.createWallet({
    address: bobAddress,
    balance: 100_000,
    kvs: [
      e.kvs.Esdts([
        { id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT },
        { id: CURRENCY2, amount: CURRENCY2_DEPOSIT_AMOUNT },
      ]),
    ],
  });

  await bob.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "deposit",
    funcArgs: [
      e.U64(TIMESTAMP),
      e.TopBuffer(SIGNATURE_BOB_WITH_AMBASSADOR),
      e.U(PLATFORM_FEE1),
      e.U(GROUP_FEE1),
      e.U(AMBASSADOR_FEE),
      e.Addr(deployer),
    ],
    esdts: [{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }],
  });

  await bob.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "deposit",
    funcArgs: [
      e.U64(TIMESTAMP),
      e.TopBuffer(SIGNATURE_BOB_WITH_AMBASSADOR),
      e.U(PLATFORM_FEE1),
      e.U(GROUP_FEE1),
      e.U(AMBASSADOR_FEE),
      e.Addr(deployer),
    ],
    esdts: [{ id: CURRENCY2, amount: CURRENCY2_DEPOSIT_AMOUNT }],
  });

  carol = await world.createWallet({
    address: carolAddress,
    balance: 100_000,
    kvs: [e.kvs.Esdts([{ id: CURRENCY3, amount: CURRENCY3_DEPOSIT_AMOUNT }])],
  });

  await carol.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "deposit",
    funcArgs: [
      e.U64(TIMESTAMP),
      e.TopBuffer(SIGNATURE_CAROL_WITHOUT_AMBASSADOR),
      e.U(PLATFORM_FEE2),
      e.U(GROUP_FEE2),
    ],
    esdts: [{ id: CURRENCY3, amount: CURRENCY3_DEPOSIT_AMOUNT }],
  });

  const denominated_currency2 =
    BigInt(CURRENCY2_DEPOSIT_AMOUNT) * BigInt(10 ** (18 - DECIMALS2));
  const denominated_currency3 =
    BigInt(CURRENCY3_DEPOSIT_AMOUNT) * BigInt(10 ** (18 - DECIMALS3));
  const total_deposited_amount =
    BigInt(CURRENCY1_DEPOSIT_AMOUNT) +
    denominated_currency2 +
    denominated_currency3;
  const total_platform_fee =
    (BigInt(CURRENCY1_DEPOSIT_AMOUNT) * BigInt(PLATFORM_FEE1)) /
      BigInt(MAX_PERCENTAGE) +
    (denominated_currency2 * BigInt(PLATFORM_FEE1)) / BigInt(MAX_PERCENTAGE) +
    (denominated_currency3 * BigInt(PLATFORM_FEE2)) / BigInt(MAX_PERCENTAGE);
  const total_group_fee =
    (BigInt(CURRENCY1_DEPOSIT_AMOUNT) * BigInt(GROUP_FEE1)) /
      BigInt(MAX_PERCENTAGE) +
    (denominated_currency2 * BigInt(GROUP_FEE1)) / BigInt(MAX_PERCENTAGE) +
    (denominated_currency3 * BigInt(GROUP_FEE2)) / BigInt(MAX_PERCENTAGE);

  assertAccount(await raisePoolContract.getAccount(), {
    balance: 0n,
    kvs: [
      e.kvs.Mapper("soft_cap").Value(e.I(SOFT_CAP)),
      e.kvs.Mapper("hard_cap").Value(e.I(HARD_CAP)),
      e.kvs.Mapper("min_deposit").Value(e.I(MIN_DEPOSIT)),
      e.kvs.Mapper("max_deposit").Value(e.I(MAX_DEPOSIT)),
      e.kvs.Mapper("deposit_increments").Value(e.I(DEPOSIT_INCREMENTS)),
      e.kvs.Mapper("start_date").Value(e.U64(START_DATE)),
      e.kvs.Mapper("end_date").Value(e.U64(END_DATE)),
      e.kvs.Mapper("refund_enabled").Value(e.Bool(Boolean(REFUND_ENABLED))),
      e.kvs.Mapper("platform_fee_wallet").Value(e.Addr(deployer)),
      e.kvs.Mapper("group_fee_wallet").Value(e.Addr(deployer)),
      e.kvs
        .Mapper("payment_currencies")
        .UnorderedSet([e.Str(CURRENCY1), e.Str(CURRENCY2), e.Str(CURRENCY3)]),
      e.kvs
        .Mapper("currency_decimals", e.Str(CURRENCY1))
        .Value(e.U32(DECIMALS1)),
      e.kvs
        .Mapper("currency_decimals", e.Str(CURRENCY2))
        .Value(e.U32(DECIMALS2)),
      e.kvs
        .Mapper("currency_decimals", e.Str(CURRENCY3))
        .Value(e.U32(DECIMALS3)),
      e.kvs.Mapper("raise_pool_enabled").Value(e.Bool(false)),
      e.kvs.Mapper("signer").Value(e.Addr(deployer)),
      e.kvs.Mapper("pool_id").Value(e.U32(POOL_ID)),
      e.kvs.Mapper("release_state").Value(e.Usize(0)),
      e.kvs.Mapper("raise_pool_enabled").Value(e.Bool(true)),
      e.kvs.Mapper("addresses").Set([
        [1, e.Addr(bob)],
        [2, e.Addr(carol)],
      ]),
      e.kvs
        .Mapper("deposited_currencies", e.Addr(bob))
        .UnorderedSet([e.Str(CURRENCY1), e.Str(CURRENCY2)]),
      e.kvs
        .Mapper("deposited_currencies", e.Addr(carol))
        .UnorderedSet([e.Str(CURRENCY3)]),
      e.kvs
        .Mapper("deposited_amount", e.Addr(bob), e.Str(CURRENCY1))
        .Value(e.U(CURRENCY1_DEPOSIT_AMOUNT)),
      e.kvs
        .Mapper("deposited_amount", e.Addr(bob), e.Str(CURRENCY2))
        .Value(e.U(CURRENCY2_DEPOSIT_AMOUNT)),
      e.kvs
        .Mapper("deposited_amount", e.Addr(carol), e.Str(CURRENCY3))
        .Value(e.U(CURRENCY3_DEPOSIT_AMOUNT)),
      e.kvs.Mapper("total_amount").Value(e.U(total_deposited_amount)),
      e.kvs
        .Mapper("address_platform_fee", e.Addr(bob), e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * PLATFORM_FEE1) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("address_platform_fee", e.Addr(bob), e.Str(CURRENCY2))
        .Value(
          e.U((CURRENCY2_DEPOSIT_AMOUNT * PLATFORM_FEE1) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("address_platform_fee", e.Addr(carol), e.Str(CURRENCY3))
        .Value(
          e.U((CURRENCY3_DEPOSIT_AMOUNT * PLATFORM_FEE2) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("platform_fee", e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * PLATFORM_FEE1) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("platform_fee", e.Str(CURRENCY2))
        .Value(
          e.U((CURRENCY2_DEPOSIT_AMOUNT * PLATFORM_FEE1) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("platform_fee", e.Str(CURRENCY3))
        .Value(
          e.U((CURRENCY3_DEPOSIT_AMOUNT * PLATFORM_FEE2) / MAX_PERCENTAGE)
        ),
      e.kvs.Mapper("total_platform_fee").Value(e.U(total_platform_fee)),
      e.kvs
        .Mapper("address_group_fee", e.Addr(bob), e.Str(CURRENCY1))
        .Value(e.U((CURRENCY1_DEPOSIT_AMOUNT * GROUP_FEE1) / MAX_PERCENTAGE)),
      e.kvs
        .Mapper("address_group_fee", e.Addr(bob), e.Str(CURRENCY2))
        .Value(e.U((CURRENCY2_DEPOSIT_AMOUNT * GROUP_FEE1) / MAX_PERCENTAGE)),
      e.kvs
        .Mapper("address_group_fee", e.Addr(carol), e.Str(CURRENCY3))
        .Value(e.U((CURRENCY3_DEPOSIT_AMOUNT * GROUP_FEE2) / MAX_PERCENTAGE)),
      e.kvs
        .Mapper("group_fee", e.Str(CURRENCY1))
        .Value(e.U((CURRENCY1_DEPOSIT_AMOUNT * GROUP_FEE1) / MAX_PERCENTAGE)),
      e.kvs
        .Mapper("group_fee", e.Str(CURRENCY2))
        .Value(e.U((CURRENCY2_DEPOSIT_AMOUNT * GROUP_FEE1) / MAX_PERCENTAGE)),
      e.kvs
        .Mapper("group_fee", e.Str(CURRENCY3))
        .Value(e.U((CURRENCY3_DEPOSIT_AMOUNT * GROUP_FEE2) / MAX_PERCENTAGE)),
      e.kvs.Mapper("total_group_fee").Value(e.U(total_group_fee)),
      e.kvs.Mapper("ambassadors").Set([[1, e.Addr(deployer)]]),
      e.kvs
        .Mapper("address_ambassador_fee", e.Addr(bob), e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("address_ambassador_fee", e.Addr(bob), e.Str(CURRENCY2))
        .Value(
          e.U((CURRENCY2_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("ambassador_fee", e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("ambassador_fee", e.Str(CURRENCY2))
        .Value(
          e.U((CURRENCY2_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("referral_ambassador_fee", e.Addr(deployer), e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("referral_ambassador_fee", e.Addr(deployer), e.Str(CURRENCY2))
        .Value(
          e.U((CURRENCY2_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE)
        ),
      e.kvs
        .Mapper("ambassador_currencies", e.Addr(deployer))
        .UnorderedSet([e.Str(CURRENCY1), e.Str(CURRENCY2)]),
      e.kvs.Esdts([{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }]),
      e.kvs.Esdts([{ id: CURRENCY2, amount: CURRENCY2_DEPOSIT_AMOUNT }]),
      e.kvs.Esdts([{ id: CURRENCY3, amount: CURRENCY3_DEPOSIT_AMOUNT }]),
    ],
  });
});

test("Deposit automatically with random parameters", async () => {
  const numberOfDeposits = 100;

  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.U32(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HIGH_HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
      e.U64(DEPOSIT_INCREMENTS),
      e.U64(START_DATE),
      e.U64(END_DATE),
      e.U64(REFUND_ENABLED),
      e.Addr(deployer),
      e.Addr(deployer),
      e.TopBuffer(SIGNATURE_DEPLOYER),
      e.U64(TIMESTAMP),
      e.Str(CURRENCY1),
      e.U64(DECIMALS1),
      e.Str(CURRENCY2),
      e.U64(DECIMALS2),
      e.Str(CURRENCY3),
      e.U64(DECIMALS3),
    ],
  });

  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "enableRaisePool",
    funcArgs: [e.U32(POOL_ID)],
  });

  const raisePoolAddressResult = await deployer.query({
    callee: factoryContract,
    funcName: "getPoolIdToAddress",
    funcArgs: [e.U32(POOL_ID)],
  });

  const raisePoolAddress = raisePoolAddressResult.returnData[0];

  const raisePoolContract = new LSContract({
    address: raisePoolAddress,
    world,
  });

  await world.setCurrentBlockInfo({
    timestamp: DEPOSIT_TIMESTAMP,
  });

  const baseKvs = [
    e.kvs.Mapper("soft_cap").Value(e.I(SOFT_CAP)),
    e.kvs.Mapper("hard_cap").Value(e.I(HIGH_HARD_CAP)),
    e.kvs.Mapper("min_deposit").Value(e.I(MIN_DEPOSIT)),
    e.kvs.Mapper("max_deposit").Value(e.I(MAX_DEPOSIT)),
    e.kvs.Mapper("deposit_increments").Value(e.I(DEPOSIT_INCREMENTS)),
    e.kvs.Mapper("start_date").Value(e.U64(START_DATE)),
    e.kvs.Mapper("end_date").Value(e.U64(END_DATE)),
    e.kvs.Mapper("refund_enabled").Value(e.Bool(Boolean(REFUND_ENABLED))),
    e.kvs.Mapper("platform_fee_wallet").Value(e.Addr(deployer)),
    e.kvs.Mapper("group_fee_wallet").Value(e.Addr(deployer)),
    e.kvs
      .Mapper("payment_currencies")
      .UnorderedSet([e.Str(CURRENCY1), e.Str(CURRENCY2), e.Str(CURRENCY3)]),
    e.kvs.Mapper("currency_decimals", e.Str(CURRENCY1)).Value(e.U32(DECIMALS1)),
    e.kvs.Mapper("currency_decimals", e.Str(CURRENCY2)).Value(e.U32(DECIMALS2)),
    e.kvs.Mapper("currency_decimals", e.Str(CURRENCY3)).Value(e.U32(DECIMALS3)),
    e.kvs.Mapper("raise_pool_enabled").Value(e.Bool(false)),
    e.kvs.Mapper("signer").Value(e.Addr(deployer)),
    e.kvs.Mapper("pool_id").Value(e.U32(POOL_ID)),
    e.kvs.Mapper("release_state").Value(e.Usize(0)),
    e.kvs.Mapper("raise_pool_enabled").Value(e.Bool(true)),
  ];

  type TripleBigIntArray = [BigInt, BigInt, BigInt];
  var extraKvs: Kvs[] = [];
  var addresses: [number | bigint, Encodable][] = [];
  var totalAmount: bigint = BigInt(0);
  var totalPlatformFee: bigint = BigInt(0);
  var totalGroupFee: bigint = BigInt(0);
  var ambassadorsSet: [number, Encodable][] = [];
  var ambassadorsRefferalFees: TripleBigIntArray[] = [];

  const currenciesArray = [CURRENCY1, CURRENCY2, CURRENCY3];
  const currenciesDecimals = [DECIMALS1, DECIMALS2, DECIMALS3];
  var currenciesTotal = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesPlatformFees = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesGroupFees = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesAmbassadorFees = [BigInt(0), BigInt(0), BigInt(0)];
  var ambIdx = 0;

  for (let i = 0; i < numberOfDeposits; i++) {
    const ambassadorBool = getRandomInt(0, 1);
    const {
      address,
      signature,
      platformFee,
      groupFee,
      ambassadorFee,
      ambassadorAddress,
    } = generateDataAndSignature(ambassadorBool);

    const currencyRand = getRandomInt(0, 2);
    const currency = currenciesArray[currencyRand];
    const decimals = currenciesDecimals[currencyRand];
    const depositAmount = getRandomDeposit(
      MIN_DEPOSIT,
      MAX_DEPOSIT,
      DEPOSIT_INCREMENTS
    );
    const depositAmountInCurrency =
      BigInt(depositAmount) * BigInt(10 ** decimals);
    const depositAmountDenominated = BigInt(depositAmount) * BigInt(10 ** 18);

    generic_wallet = await world.createWallet({
      address: address,
      balance: 100_000,
      kvs: [e.kvs.Esdts([{ id: currency, amount: depositAmountInCurrency }])],
    });

    if (ambassadorBool == 1) {
      await generic_wallet.callContract({
        callee: raisePoolContract,
        gasLimit: 50_000_000,
        funcName: "deposit",
        funcArgs: [
          e.U64(TIMESTAMP),
          e.TopBuffer(signature),
          e.U(platformFee),
          e.U(groupFee),
          e.U(ambassadorFee),
          e.Addr(ambassadorAddress),
        ],
        esdts: [{ id: currency, amount: depositAmountInCurrency }],
      });
    } else {
      await generic_wallet.callContract({
        callee: raisePoolContract,
        gasLimit: 50_000_000,
        funcName: "deposit",
        funcArgs: [
          e.U64(TIMESTAMP),
          e.TopBuffer(signature),
          e.U(platformFee),
          e.U(groupFee),
        ],
        esdts: [{ id: currency, amount: depositAmountInCurrency }],
      });
    }

    console.log(
      `Id: ${String(i + 1).padStart(2, " ")} | Deposit ${String(
        depositAmount
      ).padStart(3, " ")} ${currency.padEnd(3, " ")}, platformFee ${String(
        platformFee
      ).padStart(3, " ")}, groupFee ${String(groupFee).padStart(
        3,
        " "
      )}, ambassadorFee ${String(ambassadorFee).padStart(3, " ")}`
    );

    extraKvs.push(
      e.kvs
        .Mapper("deposited_currencies", e.Addr(generic_wallet))
        .UnorderedSet([e.Str(currency)])
    );
    extraKvs.push(
      e.kvs
        .Mapper("deposited_amount", e.Addr(generic_wallet), e.Str(currency))
        .Value(e.U(depositAmountInCurrency))
    );
    extraKvs.push(
      e.kvs
        .Mapper("address_platform_fee", e.Addr(generic_wallet), e.Str(currency))
        .Value(
          e.U((depositAmountInCurrency * BigInt(platformFee)) / MAX_PERCENTAGE)
        )
    );
    extraKvs.push(
      e.kvs
        .Mapper("address_group_fee", e.Addr(generic_wallet), e.Str(currency))
        .Value(
          e.U((depositAmountInCurrency * BigInt(groupFee)) / MAX_PERCENTAGE)
        )
    );
    addresses.push([i + 1, e.Addr(generic_wallet)]);

    totalAmount += depositAmountDenominated;
    currenciesTotal[currencyRand] += depositAmountInCurrency;
    currenciesPlatformFees[currencyRand] +=
      (depositAmountInCurrency * BigInt(platformFee)) / MAX_PERCENTAGE;
    totalPlatformFee +=
      (depositAmountDenominated * BigInt(platformFee)) / MAX_PERCENTAGE;
    currenciesGroupFees[currencyRand] +=
      (depositAmountInCurrency * BigInt(groupFee)) / MAX_PERCENTAGE;
    totalGroupFee +=
      (depositAmountDenominated * BigInt(groupFee)) / MAX_PERCENTAGE;

    if (ambassadorBool == 1) {
      extraKvs.push(
        e.kvs
          .Mapper(
            "address_ambassador_fee",
            e.Addr(generic_wallet),
            e.Str(currency)
          )
          .Value(
            e.U(
              (depositAmountInCurrency * BigInt(ambassadorFee)) / MAX_PERCENTAGE
            )
          )
      );

      const ambassadorFeeInCurrency =
        (depositAmountInCurrency * BigInt(ambassadorFee)) / MAX_PERCENTAGE;
      currenciesAmbassadorFees[currencyRand] += ambassadorFeeInCurrency;
      ambassadorsRefferalFees.push([BigInt(0), BigInt(0), BigInt(0)]);
      ambassadorsRefferalFees[ambIdx][currencyRand] = ambassadorFeeInCurrency;
      ambIdx += 1;
      ambassadorsSet.push([ambIdx, e.Addr(ambassadorAddress)]);
    }
  }

  for (let i = 0; i < ambassadorsRefferalFees.length; i++) {
    const [_, addr] = ambassadorsSet[i];
    var ambassadorCurrencies: Encodable[] = [];
    for (let j = 0; j < 3; j++) {
      const fees = BigInt(ambassadorsRefferalFees[i][j].toString());
      extraKvs.push(
        e.kvs
          .Mapper("referral_ambassador_fee", addr, e.Str(currenciesArray[j]))
          .Value(e.U(fees))
      );
      if (fees != BigInt(0)) {
        ambassadorCurrencies.push(e.Str(currenciesArray[j]));
      }
    }
    extraKvs.push(
      e.kvs
        .Mapper("ambassador_currencies", addr)
        .UnorderedSet(ambassadorCurrencies)
    );
  }

  assertAccount(await raisePoolContract.getAccount(), {
    balance: 0n,
    kvs: [
      ...baseKvs,
      ...extraKvs,
      e.kvs.Mapper("addresses").Set(addresses),
      e.kvs.Mapper("total_amount").Value(e.U(totalAmount)),
      e.kvs
        .Mapper("platform_fee", e.Str(CURRENCY1))
        .Value(e.U(currenciesPlatformFees[0])),
      e.kvs
        .Mapper("platform_fee", e.Str(CURRENCY2))
        .Value(e.U(currenciesPlatformFees[1])),
      e.kvs
        .Mapper("platform_fee", e.Str(CURRENCY3))
        .Value(e.U(currenciesPlatformFees[2])),
      e.kvs.Mapper("total_platform_fee").Value(e.U(totalPlatformFee)),
      e.kvs
        .Mapper("group_fee", e.Str(CURRENCY1))
        .Value(e.U(currenciesGroupFees[0])),
      e.kvs
        .Mapper("group_fee", e.Str(CURRENCY2))
        .Value(e.U(currenciesGroupFees[1])),
      e.kvs
        .Mapper("group_fee", e.Str(CURRENCY3))
        .Value(e.U(currenciesGroupFees[2])),
      e.kvs.Mapper("total_group_fee").Value(e.U(totalGroupFee)),
      e.kvs.Mapper("ambassadors").Set(ambassadorsSet),
      e.kvs
        .Mapper("ambassador_fee", e.Str(CURRENCY1))
        .Value(e.U(currenciesAmbassadorFees[0])),
      e.kvs
        .Mapper("ambassador_fee", e.Str(CURRENCY2))
        .Value(e.U(currenciesAmbassadorFees[1])),
      e.kvs
        .Mapper("ambassador_fee", e.Str(CURRENCY3))
        .Value(e.U(currenciesAmbassadorFees[2])),
      e.kvs.Esdts([
        { id: CURRENCY1, amount: currenciesTotal[0] },
        { id: CURRENCY2, amount: currenciesTotal[1] },
        { id: CURRENCY3, amount: currenciesTotal[2] },
      ]),
    ],
  });
}, 60000);
 
test("Deposit automatically with deployer as ambassador", async () => {
  
  const numberOfDeposits = 30;

  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.U32(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HIGH_HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
      e.U64(DEPOSIT_INCREMENTS),
      e.U64(START_DATE),
      e.U64(END_DATE),
      e.U64(REFUND_ENABLED),
      e.Addr(deployer),
      e.Addr(deployer),
      e.TopBuffer(SIGNATURE_DEPLOYER),
      e.U64(TIMESTAMP),
      e.Str(CURRENCY1),
      e.U64(DECIMALS1),
      e.Str(CURRENCY2),
      e.U64(DECIMALS2),
      e.Str(CURRENCY3),
      e.U64(DECIMALS3),
    ],
  });

  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "enableRaisePool",
    funcArgs: [e.U32(POOL_ID)],
  });

  const raisePoolAddressResult = await deployer.query({
    callee: factoryContract,
    funcName: "getPoolIdToAddress",
    funcArgs: [e.U32(POOL_ID)],
  });

  const raisePoolAddress = raisePoolAddressResult.returnData[0];

  const raisePoolContract = new LSContract({
    address: raisePoolAddress,
    world,
  });

  await world.setCurrentBlockInfo({
    timestamp: DEPOSIT_TIMESTAMP,
  });

  const baseKvs = [
    e.kvs.Mapper("soft_cap").Value(e.I(SOFT_CAP)),
    e.kvs.Mapper("hard_cap").Value(e.I(HIGH_HARD_CAP)),
    e.kvs.Mapper("min_deposit").Value(e.I(MIN_DEPOSIT)),
    e.kvs.Mapper("max_deposit").Value(e.I(MAX_DEPOSIT)),
    e.kvs.Mapper("deposit_increments").Value(e.I(DEPOSIT_INCREMENTS)),
    e.kvs.Mapper("start_date").Value(e.U64(START_DATE)),
    e.kvs.Mapper("end_date").Value(e.U64(END_DATE)),
    e.kvs.Mapper("refund_enabled").Value(e.Bool(Boolean(REFUND_ENABLED))),
    e.kvs.Mapper("platform_fee_wallet").Value(e.Addr(deployer)),
    e.kvs.Mapper("group_fee_wallet").Value(e.Addr(deployer)),
    e.kvs
      .Mapper("payment_currencies")
      .UnorderedSet([e.Str(CURRENCY1), e.Str(CURRENCY2), e.Str(CURRENCY3)]),
    e.kvs.Mapper("currency_decimals", e.Str(CURRENCY1)).Value(e.U32(DECIMALS1)),
    e.kvs.Mapper("currency_decimals", e.Str(CURRENCY2)).Value(e.U32(DECIMALS2)),
    e.kvs.Mapper("currency_decimals", e.Str(CURRENCY3)).Value(e.U32(DECIMALS3)),
    e.kvs.Mapper("raise_pool_enabled").Value(e.Bool(false)),
    e.kvs.Mapper("signer").Value(e.Addr(deployer)),
    e.kvs.Mapper("pool_id").Value(e.U32(POOL_ID)),
    e.kvs.Mapper("release_state").Value(e.Usize(0)),
    e.kvs.Mapper("raise_pool_enabled").Value(e.Bool(true)),
  ];

  type TripleBigIntArray = [BigInt, BigInt, BigInt];
  var extraKvs: Kvs[] = [];
  var addresses: [number | bigint, Encodable][] = [];
  var totalAmount: bigint = BigInt(0);
  var totalPlatformFee: bigint = BigInt(0);
  var totalGroupFee: bigint = BigInt(0);
  var ambassadorsSet: [number, Encodable][] = [];
  var ambassadorsRefferalFees: TripleBigIntArray[] = [];

  const currenciesArray = [CURRENCY1, CURRENCY2, CURRENCY3];
  const currenciesDecimals = [DECIMALS1, DECIMALS2, DECIMALS3];
  var currenciesTotal = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesPlatformFees = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesGroupFees = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesAmbassadorFees = [BigInt(0), BigInt(0), BigInt(0)];
  var ambassadorCurrencies: Encodable[] = [];
  var ambIdx = 0;

  for (let i = 0; i < numberOfDeposits; i++) {
    const { address, signature, platformFee, groupFee, ambassadorFee } =
      generateDataAndSignatureDeployerAmbassador();

    const currencyRand = getRandomInt(0, 2);
    const currency = currenciesArray[currencyRand];
    const decimals = currenciesDecimals[currencyRand];
    const depositAmount = getRandomDeposit(
      MIN_DEPOSIT,
      MAX_DEPOSIT,
      DEPOSIT_INCREMENTS
    );
    const depositAmountInCurrency =
      BigInt(depositAmount) * BigInt(10 ** decimals);
    const depositAmountDenominated = BigInt(depositAmount) * BigInt(10 ** 18);

    generic_wallet = await world.createWallet({
      address: address,
      balance: 100_000,
      kvs: [e.kvs.Esdts([{ id: currency, amount: depositAmountInCurrency }])],
    });

    await generic_wallet.callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "deposit",
      funcArgs: [
        e.U64(TIMESTAMP),
        e.TopBuffer(signature),
        e.U(platformFee),
        e.U(groupFee),
        e.U(ambassadorFee),
        e.Addr(deployer),
      ],
      esdts: [{ id: currency, amount: depositAmountInCurrency }],
    });

    console.log(
      `Id: ${String(i + 1).padStart(2, " ")} | Deposit ${String(
        depositAmount
      ).padStart(3, " ")} ${currency.padEnd(3, " ")}, platformFee ${String(
        platformFee
      ).padStart(3, " ")}, groupFee ${String(groupFee).padStart(
        3,
        " "
      )}, ambassadorFee ${String(ambassadorFee).padStart(3, " ")}`
    );

    extraKvs.push(
      e.kvs
        .Mapper("deposited_currencies", e.Addr(generic_wallet))
        .UnorderedSet([e.Str(currency)])
    );
    extraKvs.push(
      e.kvs
        .Mapper("deposited_amount", e.Addr(generic_wallet), e.Str(currency))
        .Value(e.U(depositAmountInCurrency))
    );
    extraKvs.push(
      e.kvs
        .Mapper("address_platform_fee", e.Addr(generic_wallet), e.Str(currency))
        .Value(
          e.U((depositAmountInCurrency * BigInt(platformFee)) / MAX_PERCENTAGE)
        )
    );
    extraKvs.push(
      e.kvs
        .Mapper("address_group_fee", e.Addr(generic_wallet), e.Str(currency))
        .Value(
          e.U((depositAmountInCurrency * BigInt(groupFee)) / MAX_PERCENTAGE)
        )
    );
    addresses.push([i + 1, e.Addr(generic_wallet)]);

    totalAmount += depositAmountDenominated;
    currenciesTotal[currencyRand] += depositAmountInCurrency;
    currenciesPlatformFees[currencyRand] +=
      (depositAmountInCurrency * BigInt(platformFee)) / MAX_PERCENTAGE;
    totalPlatformFee +=
      (depositAmountDenominated * BigInt(platformFee)) / MAX_PERCENTAGE;
    currenciesGroupFees[currencyRand] +=
      (depositAmountInCurrency * BigInt(groupFee)) / MAX_PERCENTAGE;
    totalGroupFee +=
      (depositAmountDenominated * BigInt(groupFee)) / MAX_PERCENTAGE;

    extraKvs.push(
      e.kvs
        .Mapper(
          "address_ambassador_fee",
          e.Addr(generic_wallet),
          e.Str(currency)
        )
        .Value(
          e.U(
            (depositAmountInCurrency * BigInt(ambassadorFee)) / MAX_PERCENTAGE
          )
        )
    );

    const ambassadorFeeInCurrency =
      (depositAmountInCurrency * BigInt(ambassadorFee)) / MAX_PERCENTAGE;
    currenciesAmbassadorFees[currencyRand] += ambassadorFeeInCurrency;

    const index = ambassadorsSet.findIndex(([_, addr]) => {
      return addr.toTopHex() === e.Addr(deployerAddress).toTopHex();
    });
    if (index === -1) {
      ambassadorsRefferalFees.push([BigInt(0), BigInt(0), BigInt(0)]);
      ambassadorsRefferalFees[ambIdx][currencyRand] = ambassadorFeeInCurrency;
      ambIdx += 1;
      ambassadorsSet.push([ambIdx, e.Addr(deployerAddress)]);
    } else {
      const current = ambassadorsRefferalFees[index][currencyRand];
      ambassadorsRefferalFees[index][currencyRand] =
        BigInt(current.toString()) + BigInt(ambassadorFeeInCurrency.toString());
    }
    const currencyEncoded = e.Str(currenciesArray[currencyRand]);
    console.log(currenciesArray[currencyRand]);
    const indexCurrency = ambassadorCurrencies.findIndex(
      (cEncoded) => cEncoded.toTopHex() === currencyEncoded.toTopHex()
    );
    if (indexCurrency == -1) {
      ambassadorCurrencies.push(currencyEncoded);
    }
  }
  for (let i = 0; i < ambassadorsRefferalFees.length; i++) {
    const [_, addr] = ambassadorsSet[i];

    for (let j = 0; j < 3; j++) {
      const fees = BigInt(ambassadorsRefferalFees[i][j].toString());
      extraKvs.push(
        e.kvs
          .Mapper("referral_ambassador_fee", addr, e.Str(currenciesArray[j]))
          .Value(e.U(fees))
      );
    }
    extraKvs.push(
      e.kvs
        .Mapper("ambassador_currencies", addr)
        .UnorderedSet(ambassadorCurrencies)
    );
  }

  assertAccount(await raisePoolContract.getAccount(), {
    balance: 0n,
    kvs: [
      ...baseKvs,
      ...extraKvs,
      e.kvs.Mapper("addresses").Set(addresses),
      e.kvs.Mapper("total_amount").Value(e.U(totalAmount)),
      e.kvs
        .Mapper("platform_fee", e.Str(CURRENCY1))
        .Value(e.U(currenciesPlatformFees[0])),
      e.kvs
        .Mapper("platform_fee", e.Str(CURRENCY2))
        .Value(e.U(currenciesPlatformFees[1])),
      e.kvs
        .Mapper("platform_fee", e.Str(CURRENCY3))
        .Value(e.U(currenciesPlatformFees[2])),
      e.kvs.Mapper("total_platform_fee").Value(e.U(totalPlatformFee)),
      e.kvs
        .Mapper("group_fee", e.Str(CURRENCY1))
        .Value(e.U(currenciesGroupFees[0])),
      e.kvs
        .Mapper("group_fee", e.Str(CURRENCY2))
        .Value(e.U(currenciesGroupFees[1])),
      e.kvs
        .Mapper("group_fee", e.Str(CURRENCY3))
        .Value(e.U(currenciesGroupFees[2])),
      e.kvs.Mapper("total_group_fee").Value(e.U(totalGroupFee)),
      e.kvs.Mapper("ambassadors").Set(ambassadorsSet),
      e.kvs
        .Mapper("ambassador_fee", e.Str(CURRENCY1))
        .Value(e.U(currenciesAmbassadorFees[0])),
      e.kvs
        .Mapper("ambassador_fee", e.Str(CURRENCY2))
        .Value(e.U(currenciesAmbassadorFees[1])),
      e.kvs
        .Mapper("ambassador_fee", e.Str(CURRENCY3))
        .Value(e.U(currenciesAmbassadorFees[2])),
      e.kvs.Esdts([
        { id: CURRENCY1, amount: currenciesTotal[0] },
        { id: CURRENCY2, amount: currenciesTotal[1] },
        { id: CURRENCY3, amount: currenciesTotal[2] },
      ]),
    ],
  });
}, 60000);
 
