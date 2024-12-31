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
  AMBASSADOR_FEE2,
  DEPOSIT_TIMESTAMP,
  CURRENCY1_DEPOSIT_AMOUNT,
  CURRENCY1_DEPOSIT_TOO_LOW,
  CURRENCY2_DEPOSIT_AMOUNT,
  CURRENCY3_DEPOSIT_AMOUNT,
  PLATFORM_FEE2,
  GROUP_FEE2,
  PLATFORM_FEE3,
  GROUP_FEE3,
  TIMESTAMP_AFTER,
  TIMESTAMP_WITH_DELAY,
  CURRENCY1_DEPOSIT_MAX,
  CURRENCY2_DEPOSIT_MAX,
  CURRENCY3_DEPOSIT_MAX,
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
  SIGNATURE_BOB_WITH_AMBASSADOR2,
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
      e.U64(DECIMALS1),
      e.Str(CURRENCY2),
      e.U64(DECIMALS2),
      e.Str(CURRENCY3),
      e.U64(DECIMALS3),
    ],
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
      e.Str(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
      e.U64(DEPOSIT_INCREMENTS),
      e.U64(START_DATE),
      e.U64(END_DATE),
      e.U64(REFUND_ENABLED),
      e.U64(END_DATE),
      e.Addr(deployer),
      e.Addr(deployer),
      e.TopBuffer(SIGNATURE_DEPLOYER),
      e.U64(TIMESTAMP),
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
        e.Str(DEPOSIT_ID),
        e.U(AMBASSADOR_FEE1),
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
      e.Str(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
      e.U64(DEPOSIT_INCREMENTS),
      e.U64(START_DATE),
      e.U64(END_DATE),
      e.U64(REFUND_ENABLED),
      e.U64(END_DATE),
      e.Addr(deployer),
      e.Addr(deployer),
      e.TopBuffer(SIGNATURE_DEPLOYER),
      e.U64(TIMESTAMP),
      e.Str(CURRENCY1),
      e.Str(CURRENCY2),
      e.Str(CURRENCY3),
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

  await bob.callContract({
    callee: walletDababaseContract,
    gasLimit: 50_000_000,
    funcName: "registerWallet",
    funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_BOB_WALLET)],
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
        e.Str(DEPOSIT_ID),
        e.U(AMBASSADOR_FEE1),
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
      e.Str(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
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

  await world.setCurrentBlockInfo({
    timestamp: TIMESTAMP,
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

  await bob.callContract({
    callee: walletDababaseContract,
    gasLimit: 50_000_000,
    funcName: "registerWallet",
    funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_BOB_WALLET)],
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
        e.Str(DEPOSIT_ID),
        e.U(AMBASSADOR_FEE1),
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
      e.Str(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
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

  await world.setCurrentBlockInfo({
    timestamp: TIMESTAMP_AFTER,
  });

  bob = await world.createWallet({
    address: bobAddress,
    balance: 100_000,
    kvs: [e.kvs.Esdts([{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }])],
  });

  await bob.callContract({
    callee: walletDababaseContract,
    gasLimit: 50_000_000,
    funcName: "registerWallet",
    funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_BOB_WALLET)],
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
        e.Str(DEPOSIT_ID),
        e.U(AMBASSADOR_FEE1),
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
      e.Str(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
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

  await bob.callContract({
    callee: walletDababaseContract,
    gasLimit: 50_000_000,
    funcName: "registerWallet",
    funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_BOB_WALLET)],
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
        e.Str(DEPOSIT_ID),
        e.U(AMBASSADOR_FEE1),
        e.Addr(deployer),
      ],
      esdts: [{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }],
    })
    .assertFail({ code: 4, message: "Deposit took too long" });
});

test("Deposit while deposits closed", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.Str(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
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

  await world.setCurrentBlockInfo({
    timestamp: DEPOSIT_TIMESTAMP,
  });

  bob = await world.createWallet({
    address: bobAddress,
    balance: 100_000,
    kvs: [e.kvs.Esdts([{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }])],
  });

  await bob.callContract({
    callee: walletDababaseContract,
    gasLimit: 50_000_000,
    funcName: "registerWallet",
    funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_BOB_WALLET)],
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
        e.Str(DEPOSIT_ID),
        e.U(AMBASSADOR_FEE1),
        e.Addr(deployer),
      ],
      esdts: [{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }],
    })
    .assertFail({
      code: 4,
      message: "Backend timestamp higher than current timestamp",
    });
});

/* DISABLED
test("Deposit amount too low", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.Str(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
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
    kvs: [
      e.kvs.Esdts([
        { id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT },
        { id: CURRENCY2, amount: CURRENCY2_DEPOSIT_AMOUNT },
      ]),
    ],
  });

  await bob.callContract({
    callee: walletDababaseContract,
    gasLimit: 50_000_000,
    funcName: "registerWallet",
    funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_BOB_WALLET)],
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
        e.Str(DEPOSIT_ID),
        e.U(AMBASSADOR_FEE1),
        e.Addr(deployer),
      ],
      esdts: [{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_TOO_LOW }],
    })
    .assertFail({ code: 4, message: "Payment amount too low" });
});
*/

test("Deposit amount too high", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.Str(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
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
    kvs: [
      e.kvs.Esdts([
        { id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT * BigInt(100) },
      ]),
    ],
  });

  await bob.callContract({
    callee: walletDababaseContract,
    gasLimit: 50_000_000,
    funcName: "registerWallet",
    funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_BOB_WALLET)],
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
        e.Str(DEPOSIT_ID),
        e.U(AMBASSADOR_FEE1),
        e.Addr(deployer),
      ],
      esdts: [{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT * BigInt(3) }],
    })
    .assertFail({ code: 4, message: "Payment amount too high" });
});

test("Deposit but hard cap threshold would be exceeded", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.Str(POOL_ID),
      e.U64(LOW_SOFT_CAP),
      e.U64(LOW_HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
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
      e.Str(CURRENCY3),
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
    balance: 100_000_000_000,
    kvs: [e.kvs.Esdts([{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_MAX }])],
  });

  await bob.callContract({
    callee: walletDababaseContract,
    gasLimit: 500_000_000,
    funcName: "registerWallet",
    funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_BOB_WALLET)],
  });

  await bob.callContract({
    callee: raisePoolContract,
    gasLimit: 500_000_000,
    funcName: "deposit",
    funcArgs: [
      e.U64(TIMESTAMP),
      e.TopBuffer(SIGNATURE_BOB_WITH_AMBASSADOR),
      e.U(PLATFORM_FEE1),
      e.U(GROUP_FEE1),
      e.Str(DEPOSIT_ID),
      e.U(AMBASSADOR_FEE1),
      e.Addr(deployer),
    ],
    esdts: [
      {
        id: CURRENCY1,
        amount: CURRENCY1_DEPOSIT_MAX,
      },
    ],
  });

  carol = await world.createWallet({
    address: carolAddress,
    balance: 100_000,
    kvs: [e.kvs.Esdts([{ id: CURRENCY3, amount: CURRENCY3_DEPOSIT_MAX }])],
  });

  await carol.callContract({
    callee: walletDababaseContract,
    gasLimit: 50_000_000,
    funcName: "registerWallet",
    funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_CAROL_WALLET)],
  });

  await carol
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "deposit",
      funcArgs: [
        e.U64(TIMESTAMP),
        e.TopBuffer(SIGNATURE_CAROL_WITHOUT_AMBASSADOR),
        e.U(PLATFORM_FEE3),
        e.U(GROUP_FEE3),
        e.Str(DEPOSIT_ID),
      ],
      esdts: [{ id: CURRENCY3, amount: CURRENCY3_DEPOSIT_MAX }],
    })
    .assertFail({ code: 4, message: "Hard cap threshold would be exceeded" });
});

/* DISABLED
test("Deposit with incorect deposit increment", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.Str(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
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
    kvs: [e.kvs.Esdts([{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }])],
  });

  await bob.callContract({
    callee: walletDababaseContract,
    gasLimit: 50_000_000,
    funcName: "registerWallet",
    funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_BOB_WALLET)],
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
        e.Str(DEPOSIT_ID),
        e.U(AMBASSADOR_FEE1),
        e.Addr(deployer),
      ],
      esdts: [{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_INCORECT_AMOUNT }],
    })
    .assertFail({
      code: 4,
      message: "Payment amount is not a multiple of the deposit increment",
    });
});
*/

test("Deposit Currency1 with Bob", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.Str(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
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
    kvs: [e.kvs.Esdts([{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }])],
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
      e.TopBuffer(SIGNATURE_BOB_WITH_AMBASSADOR),
      e.U(PLATFORM_FEE1),
      e.U(GROUP_FEE1),
      e.Str(DEPOSIT_ID),
      e.U(AMBASSADOR_FEE1),
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
      e.kvs.Mapper("refund_deadline").Value(e.U64(END_DATE)),
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
      e.kvs.Mapper("pool_id").Value(e.Str(POOL_ID)),
      e.kvs.Mapper("release_state").Value(e.Usize(0)),
      e.kvs.Mapper("raise_pool_enabled").Value(e.Bool(true)),
      e.kvs.Mapper("addresses").UnorderedSet([e.Addr(bob)]),
      e.kvs
        .Mapper("deposited_currencies", e.Addr(bob))
        .UnorderedSet([e.Str(CURRENCY1)]),
      e.kvs
        .Mapper("deposited_amount", e.Addr(bob), e.Str(CURRENCY1))
        .Value(e.U(CURRENCY1_DEPOSIT_AMOUNT)),
      e.kvs.Mapper("total_amount").Value(e.U(CURRENCY1_DEPOSIT_AMOUNT)),
      e.kvs
        .Mapper("total_amount_currency", e.Str(CURRENCY1))
        .Value(e.U(CURRENCY1_DEPOSIT_AMOUNT)),
      e.kvs
        .Mapper("address_platform_fee", e.Addr(bob), e.Str(CURRENCY1))
        .Value(e.U(PLATFORM_FEE1)),
      e.kvs.Mapper("platform_fee", e.Str(CURRENCY1)).Value(e.U(PLATFORM_FEE1)),
      e.kvs.Mapper("total_platform_fee").Value(e.U(PLATFORM_FEE1)),
      e.kvs
        .Mapper("address_group_fee", e.Addr(bob), e.Str(CURRENCY1))
        .Value(e.U(GROUP_FEE1)),
      e.kvs.Mapper("group_fee", e.Str(CURRENCY1)).Value(e.U(GROUP_FEE1)),
      e.kvs.Mapper("total_group_fee").Value(e.U(GROUP_FEE1)),
      e.kvs.Mapper("total_ambassador_fee").Value(e.U(AMBASSADOR_FEE1)),
      e.kvs.Mapper("ambassadors").UnorderedSet([e.Addr(deployer)]),
      e.kvs
        .Mapper("address_ambassador_fee", e.Addr(bob), e.Str(CURRENCY1))
        .Value(e.U(AMBASSADOR_FEE1)),
      e.kvs
        .Mapper("address_to_ambassador", e.Addr(bob))
        .Value(e.Addr(deployer)),
      e.kvs
        .Mapper("ambassador_fee", e.Str(CURRENCY1))
        .Value(e.U(AMBASSADOR_FEE1)),
      e.kvs
        .Mapper("referral_ambassador_fee", e.Addr(deployer), e.Str(CURRENCY1))
        .Value(e.U(AMBASSADOR_FEE1)),
      e.kvs
        .Mapper("ambassador_currencies", e.Addr(deployer))
        .UnorderedSet([e.Str(CURRENCY1)]),
      e.kvs.Esdts([{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }]),
      e.kvs.Mapper("owner").Value(e.Addr(deployer)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
    ],
  });
});

test("Deposit Currency1, Currency2 with Bob", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.Str(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
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
    kvs: [
      e.kvs.Esdts([
        { id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT },
        { id: CURRENCY2, amount: CURRENCY2_DEPOSIT_AMOUNT },
      ]),
    ],
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
      e.TopBuffer(SIGNATURE_BOB_WITH_AMBASSADOR),
      e.U(PLATFORM_FEE1),
      e.U(GROUP_FEE1),
      e.Str(DEPOSIT_ID),
      e.U(AMBASSADOR_FEE1),
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
      e.TopBuffer(SIGNATURE_BOB_WITH_AMBASSADOR2),
      e.U(PLATFORM_FEE2),
      e.U(GROUP_FEE2),
      e.Str(DEPOSIT_ID),
      e.U(AMBASSADOR_FEE2),
      e.Addr(deployer),
    ],
    esdts: [{ id: CURRENCY2, amount: CURRENCY2_DEPOSIT_AMOUNT }],
  });

  const denominated_currency2 =
    BigInt(CURRENCY2_DEPOSIT_AMOUNT) * BigInt(10 ** (18 - DECIMALS2));
  const denominated_platform_fee_currency2 =
    BigInt(PLATFORM_FEE2) * BigInt(10 ** (18 - DECIMALS2));
  const denominated_group_fee_currency2 =
    BigInt(GROUP_FEE2) * BigInt(10 ** (18 - DECIMALS2));
  const denominated_ambassador_fee_currency2 =
    BigInt(AMBASSADOR_FEE2) * BigInt(10 ** (18 - DECIMALS2));
  const total_deposited_amount =
    BigInt(CURRENCY1_DEPOSIT_AMOUNT) + denominated_currency2;
  const total_platform_fee = PLATFORM_FEE1 + denominated_platform_fee_currency2;
  const total_group_fee = GROUP_FEE1 + denominated_group_fee_currency2;
  const total_ambassador_fee =
    AMBASSADOR_FEE1 + denominated_ambassador_fee_currency2;

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
      e.kvs.Mapper("refund_deadline").Value(e.U64(END_DATE)),
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
      e.kvs.Mapper("pool_id").Value(e.Str(POOL_ID)),
      e.kvs.Mapper("release_state").Value(e.Usize(0)),
      e.kvs.Mapper("raise_pool_enabled").Value(e.Bool(true)),
      e.kvs.Mapper("addresses").UnorderedSet([e.Addr(bob)]),
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
        .Mapper("total_amount_currency", e.Str(CURRENCY1))
        .Value(e.U(CURRENCY1_DEPOSIT_AMOUNT)),
      e.kvs
        .Mapper("total_amount_currency", e.Str(CURRENCY1))
        .Value(e.U(CURRENCY1_DEPOSIT_AMOUNT)),
      e.kvs
        .Mapper("address_platform_fee", e.Addr(bob), e.Str(CURRENCY1))
        .Value(e.U(PLATFORM_FEE1)),
      e.kvs
        .Mapper("address_platform_fee", e.Addr(bob), e.Str(CURRENCY2))
        .Value(e.U(PLATFORM_FEE2)),
      e.kvs.Mapper("platform_fee", e.Str(CURRENCY1)).Value(e.U(PLATFORM_FEE1)),
      e.kvs.Mapper("platform_fee", e.Str(CURRENCY2)).Value(e.U(PLATFORM_FEE2)),
      e.kvs.Mapper("total_platform_fee").Value(e.U(total_platform_fee)),
      e.kvs.Mapper("total_ambassador_fee").Value(e.U(total_ambassador_fee)),
      e.kvs
        .Mapper("address_to_ambassador", e.Addr(bob))
        .Value(e.Addr(deployer)),
      e.kvs
        .Mapper("address_group_fee", e.Addr(bob), e.Str(CURRENCY1))
        .Value(e.U(GROUP_FEE1)),
      e.kvs
        .Mapper("address_group_fee", e.Addr(bob), e.Str(CURRENCY2))
        .Value(e.U(GROUP_FEE2)),
      e.kvs.Mapper("group_fee", e.Str(CURRENCY1)).Value(e.U(GROUP_FEE1)),
      e.kvs.Mapper("group_fee", e.Str(CURRENCY2)).Value(e.U(GROUP_FEE2)),
      e.kvs.Mapper("total_group_fee").Value(e.U(total_group_fee)),
      e.kvs.Mapper("ambassadors").UnorderedSet([e.Addr(deployer)]),
      e.kvs
        .Mapper("address_ambassador_fee", e.Addr(bob), e.Str(CURRENCY1))
        .Value(e.U(AMBASSADOR_FEE1)),
      e.kvs
        .Mapper("address_ambassador_fee", e.Addr(bob), e.Str(CURRENCY2))
        .Value(e.U(AMBASSADOR_FEE2)),
      e.kvs
        .Mapper("ambassador_fee", e.Str(CURRENCY1))
        .Value(e.U(AMBASSADOR_FEE1)),
      e.kvs
        .Mapper("ambassador_fee", e.Str(CURRENCY2))
        .Value(e.U(AMBASSADOR_FEE2)),
      e.kvs
        .Mapper("referral_ambassador_fee", e.Addr(deployer), e.Str(CURRENCY1))
        .Value(e.U(AMBASSADOR_FEE1)),
      e.kvs
        .Mapper("referral_ambassador_fee", e.Addr(deployer), e.Str(CURRENCY2))
        .Value(e.U(AMBASSADOR_FEE2)),
      e.kvs
        .Mapper("ambassador_currencies", e.Addr(deployer))
        .UnorderedSet([e.Str(CURRENCY1), e.Str(CURRENCY2)]),
      e.kvs
        .Mapper("total_amount_currency", e.Str(CURRENCY1))
        .Value(e.U(CURRENCY1_DEPOSIT_AMOUNT)),
      e.kvs
        .Mapper("total_amount_currency", e.Str(CURRENCY2))
        .Value(e.U(CURRENCY2_DEPOSIT_AMOUNT)),
      e.kvs.Esdts([{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }]),
      e.kvs.Esdts([{ id: CURRENCY2, amount: CURRENCY2_DEPOSIT_AMOUNT }]),
      e.kvs.Mapper("owner").Value(e.Addr(deployer)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
    ],
  });
});

test("Deposit Currency1, Currency2 with Bob, Currency3 with Carol", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.Str(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
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
      e.Str(CURRENCY3),
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
    kvs: [
      e.kvs.Esdts([
        { id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT },
        { id: CURRENCY2, amount: CURRENCY2_DEPOSIT_AMOUNT },
      ]),
    ],
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
      e.TopBuffer(SIGNATURE_BOB_WITH_AMBASSADOR),
      e.U(PLATFORM_FEE1),
      e.U(GROUP_FEE1),
      e.Str(DEPOSIT_ID),
      e.U(AMBASSADOR_FEE1),
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
      e.TopBuffer(SIGNATURE_BOB_WITH_AMBASSADOR2),
      e.U(PLATFORM_FEE2),
      e.U(GROUP_FEE2),
      e.Str(DEPOSIT_ID),
      e.U(AMBASSADOR_FEE2),
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
    callee: walletDababaseContract,
    gasLimit: 50_000_000,
    funcName: "registerWallet",
    funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_CAROL_WALLET)],
  });

  await carol.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "deposit",
    funcArgs: [
      e.U64(TIMESTAMP),
      e.TopBuffer(SIGNATURE_CAROL_WITHOUT_AMBASSADOR),
      e.U(PLATFORM_FEE3),
      e.U(GROUP_FEE3),
      e.Str(DEPOSIT_ID),
    ],
    esdts: [{ id: CURRENCY3, amount: CURRENCY3_DEPOSIT_AMOUNT }],
  });

  const denominated_currency2 =
    BigInt(CURRENCY2_DEPOSIT_AMOUNT) * BigInt(10 ** (18 - DECIMALS2));
  const denominated_currency3 =
    BigInt(CURRENCY3_DEPOSIT_AMOUNT) * BigInt(10 ** (18 - DECIMALS3));
  const denominated_platform_fee_currency2 =
    BigInt(PLATFORM_FEE2) * BigInt(10 ** (18 - DECIMALS2));
  const denominated_group_fee_currency2 =
    BigInt(GROUP_FEE2) * BigInt(10 ** (18 - DECIMALS2));
  const denominated_ambassador_fee_currency2 =
    BigInt(AMBASSADOR_FEE2) * BigInt(10 ** (18 - DECIMALS2));
  const denominated_platform_fee_currency3 =
    BigInt(PLATFORM_FEE3) * BigInt(10 ** (18 - DECIMALS3));
  const denominated_group_fee_currency3 =
    BigInt(GROUP_FEE3) * BigInt(10 ** (18 - DECIMALS3));
  const total_deposited_amount =
    BigInt(CURRENCY1_DEPOSIT_AMOUNT) +
    denominated_currency2 +
    denominated_currency3;
  const total_platform_fee =
    PLATFORM_FEE1 +
    denominated_platform_fee_currency2 +
    denominated_platform_fee_currency3;
  const total_group_fee =
    GROUP_FEE1 +
    denominated_group_fee_currency2 +
    denominated_group_fee_currency3;
  const total_ambassador_fee =
    AMBASSADOR_FEE1 + denominated_ambassador_fee_currency2;

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
      e.kvs.Mapper("refund_deadline").Value(e.U64(END_DATE)),
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
      e.kvs.Mapper("pool_id").Value(e.Str(POOL_ID)),
      e.kvs.Mapper("release_state").Value(e.Usize(0)),
      e.kvs.Mapper("raise_pool_enabled").Value(e.Bool(true)),
      e.kvs.Mapper("addresses").UnorderedSet([e.Addr(bob), e.Addr(carol)]),
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
        .Mapper("total_amount_currency", e.Str(CURRENCY1))
        .Value(e.U(CURRENCY1_DEPOSIT_AMOUNT)),
      e.kvs
        .Mapper("total_amount_currency", e.Str(CURRENCY2))
        .Value(e.U(CURRENCY2_DEPOSIT_AMOUNT)),
      e.kvs
        .Mapper("total_amount_currency", e.Str(CURRENCY3))
        .Value(e.U(CURRENCY3_DEPOSIT_AMOUNT)),
      e.kvs
        .Mapper("address_to_ambassador", e.Addr(bob))
        .Value(e.Addr(deployer)),
      e.kvs
        .Mapper("address_platform_fee", e.Addr(bob), e.Str(CURRENCY1))
        .Value(e.U(PLATFORM_FEE1)),
      e.kvs
        .Mapper("address_platform_fee", e.Addr(bob), e.Str(CURRENCY2))
        .Value(e.U(PLATFORM_FEE2)),
      e.kvs
        .Mapper("address_platform_fee", e.Addr(carol), e.Str(CURRENCY3))
        .Value(e.U(PLATFORM_FEE3)),
      e.kvs.Mapper("platform_fee", e.Str(CURRENCY1)).Value(e.U(PLATFORM_FEE1)),
      e.kvs.Mapper("platform_fee", e.Str(CURRENCY2)).Value(e.U(PLATFORM_FEE2)),
      e.kvs.Mapper("platform_fee", e.Str(CURRENCY3)).Value(e.U(PLATFORM_FEE3)),
      e.kvs.Mapper("total_platform_fee").Value(e.U(total_platform_fee)),
      e.kvs
        .Mapper("address_group_fee", e.Addr(bob), e.Str(CURRENCY1))
        .Value(e.U(GROUP_FEE1)),
      e.kvs
        .Mapper("address_group_fee", e.Addr(bob), e.Str(CURRENCY2))
        .Value(e.U(GROUP_FEE2)),
      e.kvs
        .Mapper("address_group_fee", e.Addr(carol), e.Str(CURRENCY3))
        .Value(e.U(GROUP_FEE3)),
      e.kvs.Mapper("group_fee", e.Str(CURRENCY1)).Value(e.U(GROUP_FEE1)),
      e.kvs.Mapper("group_fee", e.Str(CURRENCY2)).Value(e.U(GROUP_FEE2)),
      e.kvs.Mapper("group_fee", e.Str(CURRENCY3)).Value(e.U(GROUP_FEE3)),
      e.kvs.Mapper("total_group_fee").Value(e.U(total_group_fee)),
      e.kvs.Mapper("total_ambassador_fee").Value(e.U(total_ambassador_fee)),
      e.kvs.Mapper("ambassadors").UnorderedSet([e.Addr(deployer)]),
      e.kvs
        .Mapper("address_ambassador_fee", e.Addr(bob), e.Str(CURRENCY1))
        .Value(e.U(AMBASSADOR_FEE1)),
      e.kvs
        .Mapper("address_ambassador_fee", e.Addr(bob), e.Str(CURRENCY2))
        .Value(e.U(AMBASSADOR_FEE2)),
      e.kvs
        .Mapper("ambassador_fee", e.Str(CURRENCY1))
        .Value(e.U(AMBASSADOR_FEE1)),
      e.kvs
        .Mapper("ambassador_fee", e.Str(CURRENCY2))
        .Value(e.U(AMBASSADOR_FEE2)),
      e.kvs
        .Mapper("referral_ambassador_fee", e.Addr(deployer), e.Str(CURRENCY1))
        .Value(e.U(AMBASSADOR_FEE1)),
      e.kvs
        .Mapper("referral_ambassador_fee", e.Addr(deployer), e.Str(CURRENCY2))
        .Value(e.U(AMBASSADOR_FEE2)),
      e.kvs
        .Mapper("ambassador_currencies", e.Addr(deployer))
        .UnorderedSet([e.Str(CURRENCY1), e.Str(CURRENCY2)]),
      e.kvs.Esdts([{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }]),
      e.kvs.Esdts([{ id: CURRENCY2, amount: CURRENCY2_DEPOSIT_AMOUNT }]),
      e.kvs.Esdts([{ id: CURRENCY3, amount: CURRENCY3_DEPOSIT_AMOUNT }]),
      e.kvs.Mapper("owner").Value(e.Addr(deployer)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
    ],
  });
});

test("Deposit automatically with random parameters", async () => {
  const numberOfDeposits = 150;

  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.Str(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HIGH_HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
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
      e.Str(CURRENCY3),
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

  const baseKvs = [
    e.kvs.Mapper("soft_cap").Value(e.I(SOFT_CAP)),
    e.kvs.Mapper("hard_cap").Value(e.I(HIGH_HARD_CAP)),
    e.kvs.Mapper("min_deposit").Value(e.I(MIN_DEPOSIT)),
    e.kvs.Mapper("max_deposit").Value(e.I(MAX_DEPOSIT)),
    e.kvs.Mapper("deposit_increments").Value(e.I(DEPOSIT_INCREMENTS)),
    e.kvs.Mapper("start_date").Value(e.U64(START_DATE)),
    e.kvs.Mapper("end_date").Value(e.U64(END_DATE)),
    e.kvs.Mapper("refund_enabled").Value(e.Bool(Boolean(REFUND_ENABLED))),
    e.kvs.Mapper("refund_deadline").Value(e.U64(END_DATE)),
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
    e.kvs.Mapper("pool_id").Value(e.Str(POOL_ID)),
    e.kvs.Mapper("release_state").Value(e.Usize(0)),
    e.kvs.Mapper("raise_pool_enabled").Value(e.Bool(true)),
    e.kvs.Mapper("owner").Value(e.Addr(deployer)),
    e.kvs
      .Mapper("wallet_database_address")
      .Value(e.Addr(walletDababaseContract)),
  ];

  type TripleBigIntArray = [BigInt, BigInt, BigInt];
  var walletsKvs: Kvs[] = [];
  var addresses: Encodable[] = [];
  var totalAmount: bigint = BigInt(0);
  var totalPlatformFee: bigint = BigInt(0);
  var totalGroupFee: bigint = BigInt(0);
  var ambassadors: Encodable[] = [];
  var ambassadorsRefferalFees: TripleBigIntArray[] = [];
  var totalAmbassadorsAmount: bigint = BigInt(0);

  const currenciesArray = [CURRENCY1, CURRENCY2, CURRENCY3];
  const currenciesDecimals = [DECIMALS1, DECIMALS2, DECIMALS3];
  var currenciesTotal = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesPlatformFees = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesGroupFees = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesAmbassadorFees = [BigInt(0), BigInt(0), BigInt(0)];
  var ambIdx = 0;

  for (let i = 0; i < numberOfDeposits; i++) {
    const ambassadorBool = getRandomInt(0, 1);
    const currencyRand = getRandomInt(0, 2);
    const currency = currenciesArray[currencyRand];
    const decimals = currenciesDecimals[currencyRand];
    const depositAmount = getRandomDeposit(
      MIN_DEPOSIT,
      MAX_DEPOSIT,
      DEPOSIT_INCREMENTS,
      decimals,
    );
    const {
      address,
      whitelistSignature,
      depositSignature,
      platformFee,
      groupFee,
      ambassadorFee,
      ambassadorAddress,
    } = generateDataAndSignature(ambassadorBool, depositAmount);

    const depositAmountDenominated =
      BigInt(depositAmount) * BigInt(10 ** (18 - decimals));
    const platformFeeDenominated = platformFee * BigInt(10 ** (18 - decimals));
    const groupFeeDenominated = groupFee * BigInt(10 ** (18 - decimals));
    const ambassadorFeeDenominated =
      ambassadorFee * BigInt(10 ** (18 - decimals));

    genericWallet = await world.createWallet({
      address: address,
      balance: 100_000,
      kvs: [e.kvs.Esdts([{ id: currency, amount: depositAmount }])],
    });

    await genericWallet.callContract({
      callee: walletDababaseContract,
      gasLimit: 50_000_000,
      funcName: "registerWallet",
      funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(whitelistSignature)],
    });

    if (ambassadorBool == 1) {
      await genericWallet.callContract({
        callee: raisePoolContract,
        gasLimit: 50_000_000,
        funcName: "deposit",
        funcArgs: [
          e.U64(TIMESTAMP),
          e.TopBuffer(depositSignature),
          e.U(platformFee),
          e.U(groupFee),
          e.Str(DEPOSIT_ID),
          e.U(ambassadorFee),
          e.Addr(ambassadorAddress),
        ],
        esdts: [{ id: currency, amount: depositAmount }],
      });
    } else {
      await genericWallet.callContract({
        callee: raisePoolContract,
        gasLimit: 50_000_000,
        funcName: "deposit",
        funcArgs: [
          e.U64(TIMESTAMP),
          e.TopBuffer(depositSignature),
          e.U(platformFee),
          e.U(groupFee),
          e.Str(DEPOSIT_ID),
        ],
        esdts: [{ id: currency, amount: depositAmount }],
      });
    }

    /*
    console.log(
      `Id: ${String(i + 1).padStart(2, " ")} | Deposit ${String(
        depositAmount,
      ).padStart(3, " ")} ${currency.padEnd(3, " ")}, platformFee ${String(
        platformFee,
      ).padStart(3, " ")}, groupFee ${String(groupFee).padStart(
        3,
        " ",
      )}, ambassadorFee ${String(ambassadorFee).padStart(3, " ")}`,
    );
    */

    walletsKvs.push(
      e.kvs
        .Mapper("deposited_currencies", e.Addr(genericWallet))
        .UnorderedSet([e.Str(currency)]),
    );
    walletsKvs.push(
      e.kvs
        .Mapper("deposited_amount", e.Addr(genericWallet), e.Str(currency))
        .Value(e.U(depositAmount)),
    );
    walletsKvs.push(
      e.kvs
        .Mapper("address_platform_fee", e.Addr(genericWallet), e.Str(currency))
        .Value(e.U(platformFee)),
    );
    walletsKvs.push(
      e.kvs
        .Mapper("address_group_fee", e.Addr(genericWallet), e.Str(currency))
        .Value(e.U(groupFee)),
    );
    addresses.push(e.Addr(genericWallet));

    totalAmount += depositAmountDenominated;
    currenciesTotal[currencyRand] += BigInt(depositAmount);
    currenciesPlatformFees[currencyRand] += platformFee;
    totalPlatformFee += platformFeeDenominated;
    currenciesGroupFees[currencyRand] += groupFee;
    totalGroupFee += groupFeeDenominated;

    if (ambassadorBool == 1) {
      totalAmbassadorsAmount += ambassadorFeeDenominated;
      walletsKvs.push(
        e.kvs
          .Mapper(
            "address_ambassador_fee",
            e.Addr(genericWallet),
            e.Str(currency),
          )
          .Value(e.U(ambassadorFee)),
      );

      walletsKvs.push(
        e.kvs
          .Mapper("address_to_ambassador", e.Addr(genericWallet))
          .Value(e.Addr(ambassadorAddress)),
      );

      currenciesAmbassadorFees[currencyRand] += ambassadorFee;
      ambassadorsRefferalFees.push([BigInt(0), BigInt(0), BigInt(0)]);
      ambassadorsRefferalFees[ambIdx][currencyRand] = ambassadorFee;
      ambIdx += 1;
      ambassadors.push(e.Addr(ambassadorAddress));
    }
  }

  for (let i = 0; i < ambassadorsRefferalFees.length; i++) {
    const addr = ambassadors[i];
    var ambassadorCurrencies: Encodable[] = [];
    for (let j = 0; j < 3; j++) {
      const fees = BigInt(ambassadorsRefferalFees[i][j].toString());
      walletsKvs.push(
        e.kvs
          .Mapper("referral_ambassador_fee", addr, e.Str(currenciesArray[j]))
          .Value(e.U(fees)),
      );
      if (fees != BigInt(0)) {
        ambassadorCurrencies.push(e.Str(currenciesArray[j]));
      }
    }
    walletsKvs.push(
      e.kvs
        .Mapper("ambassador_currencies", addr)
        .UnorderedSet(ambassadorCurrencies),
    );
  }

  const amountsKvs = [
    e.kvs.Mapper("addresses").UnorderedSet(addresses),
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
    e.kvs.Mapper("total_ambassador_fee").Value(e.U(totalAmbassadorsAmount)),
    e.kvs.Mapper("ambassadors").UnorderedSet(ambassadors),
    e.kvs
      .Mapper("ambassador_fee", e.Str(CURRENCY1))
      .Value(e.U(currenciesAmbassadorFees[0])),
    e.kvs
      .Mapper("ambassador_fee", e.Str(CURRENCY2))
      .Value(e.U(currenciesAmbassadorFees[1])),
    e.kvs
      .Mapper("ambassador_fee", e.Str(CURRENCY3))
      .Value(e.U(currenciesAmbassadorFees[2])),
    e.kvs
      .Mapper("total_amount_currency", e.Str(CURRENCY1))
      .Value(e.U(currenciesTotal[0])),
    e.kvs
      .Mapper("total_amount_currency", e.Str(CURRENCY2))
      .Value(e.U(currenciesTotal[1])),
    e.kvs
      .Mapper("total_amount_currency", e.Str(CURRENCY3))
      .Value(e.U(currenciesTotal[2])),
    e.kvs.Esdts([
      { id: CURRENCY1, amount: currenciesTotal[0] },
      { id: CURRENCY2, amount: currenciesTotal[1] },
      { id: CURRENCY3, amount: currenciesTotal[2] },
    ]),
  ];

  assertAccount(await raisePoolContract.getAccount(), {
    balance: 0n,
    kvs: [...baseKvs, ...walletsKvs, ...amountsKvs],
  });
}, 120000);

test("Deposit automatically with deployer as ambassador", async () => {
  const numberOfDeposits = 30;

  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.Str(POOL_ID),
      e.U64(SOFT_CAP),
      e.U64(HIGH_HARD_CAP),
      e.U64(MIN_DEPOSIT),
      e.U64(MAX_DEPOSIT),
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
      e.Str(CURRENCY3),
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

  const baseKvs = [
    e.kvs.Mapper("soft_cap").Value(e.I(SOFT_CAP)),
    e.kvs.Mapper("hard_cap").Value(e.I(HIGH_HARD_CAP)),
    e.kvs.Mapper("min_deposit").Value(e.I(MIN_DEPOSIT)),
    e.kvs.Mapper("max_deposit").Value(e.I(MAX_DEPOSIT)),
    e.kvs.Mapper("deposit_increments").Value(e.I(DEPOSIT_INCREMENTS)),
    e.kvs.Mapper("start_date").Value(e.U64(START_DATE)),
    e.kvs.Mapper("end_date").Value(e.U64(END_DATE)),
    e.kvs.Mapper("refund_enabled").Value(e.Bool(Boolean(REFUND_ENABLED))),
    e.kvs.Mapper("refund_deadline").Value(e.U64(END_DATE)),
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
    e.kvs.Mapper("pool_id").Value(e.Str(POOL_ID)),
    e.kvs.Mapper("release_state").Value(e.Usize(0)),
    e.kvs.Mapper("raise_pool_enabled").Value(e.Bool(true)),
    e.kvs.Mapper("owner").Value(e.Addr(deployer)),
    e.kvs
      .Mapper("wallet_database_address")
      .Value(e.Addr(walletDababaseContract)),
  ];

  type TripleBigIntArray = [BigInt, BigInt, BigInt];
  var walletsKvs: Kvs[] = [];
  var addresses: Encodable[] = [];
  var totalAmount: bigint = BigInt(0);
  var totalPlatformFee: bigint = BigInt(0);
  var totalGroupFee: bigint = BigInt(0);
  var ambassadors: Encodable[] = [];
  var ambassadorsRefferalFees: TripleBigIntArray[] = [];
  var totalAmbassadorsAmount: bigint = BigInt(0);

  const currenciesArray = [CURRENCY1, CURRENCY2, CURRENCY3];
  const currenciesDecimals = [DECIMALS1, DECIMALS2, DECIMALS3];
  var currenciesTotal = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesPlatformFees = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesGroupFees = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesAmbassadorFees = [BigInt(0), BigInt(0), BigInt(0)];
  var ambassadorCurrencies: Encodable[] = [];
  var ambIdx = 0;

  for (let i = 0; i < numberOfDeposits; i++) {
    const currencyRand = getRandomInt(0, 2);
    const currency = currenciesArray[currencyRand];
    const decimals = currenciesDecimals[currencyRand];
    const depositAmount = getRandomDeposit(
      MIN_DEPOSIT,
      MAX_DEPOSIT,
      DEPOSIT_INCREMENTS,
      decimals,
    );
    const {
      address,
      whitelistSignature,
      depositSignature,
      platformFee,
      groupFee,
      ambassadorFee,
    } = generateDataAndSignatureDeployerAmbassador(depositAmount);

    const depositAmountDenominated =
      BigInt(depositAmount) * BigInt(10 ** (18 - decimals));
    const platformFeeDenominated = platformFee * BigInt(10 ** (18 - decimals));
    const groupFeeDenominated = groupFee * BigInt(10 ** (18 - decimals));
    const ambassadorFeeDenominated =
      ambassadorFee * BigInt(10 ** (18 - decimals));

    genericWallet = await world.createWallet({
      address: address,
      balance: 100_000,
      kvs: [e.kvs.Esdts([{ id: currency, amount: depositAmount }])],
    });

    await genericWallet.callContract({
      callee: walletDababaseContract,
      gasLimit: 50_000_000,
      funcName: "registerWallet",
      funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(whitelistSignature)],
    });

    await genericWallet.callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "deposit",
      funcArgs: [
        e.U64(TIMESTAMP),
        e.TopBuffer(depositSignature),
        e.U(platformFee),
        e.U(groupFee),
        e.Str(DEPOSIT_ID),
        e.U(ambassadorFee),
        e.Addr(deployer),
      ],
      esdts: [{ id: currency, amount: depositAmount }],
    });

    /*
    console.log(
      `Id: ${String(i + 1).padStart(2, " ")} | Deposit ${String(
        depositAmount,
      ).padStart(3, " ")} ${currency.padEnd(3, " ")}, platformFee ${String(
        platformFee,
      ).padStart(3, " ")}, groupFee ${String(groupFee).padStart(
        3,
        " ",
      )}, ambassadorFee ${String(ambassadorFee).padStart(3, " ")}`,
    );
     */

    walletsKvs.push(
      e.kvs
        .Mapper("deposited_currencies", e.Addr(genericWallet))
        .UnorderedSet([e.Str(currency)]),
    );
    walletsKvs.push(
      e.kvs
        .Mapper("deposited_amount", e.Addr(genericWallet), e.Str(currency))
        .Value(e.U(depositAmount)),
    );
    walletsKvs.push(
      e.kvs
        .Mapper("address_platform_fee", e.Addr(genericWallet), e.Str(currency))
        .Value(e.U(platformFee)),
    );
    walletsKvs.push(
      e.kvs
        .Mapper("address_group_fee", e.Addr(genericWallet), e.Str(currency))
        .Value(e.U(groupFee)),
    );
    addresses.push(e.Addr(genericWallet));

    totalAmount += depositAmountDenominated;
    currenciesTotal[currencyRand] += depositAmount;
    currenciesPlatformFees[currencyRand] += platformFee;
    totalPlatformFee += platformFeeDenominated;
    currenciesGroupFees[currencyRand] += groupFee;
    totalGroupFee += groupFeeDenominated;
    totalAmbassadorsAmount += ambassadorFeeDenominated;

    walletsKvs.push(
      e.kvs
        .Mapper(
          "address_ambassador_fee",
          e.Addr(genericWallet),
          e.Str(currency),
        )
        .Value(e.U(ambassadorFee)),
    );

    walletsKvs.push(
      e.kvs
        .Mapper("address_to_ambassador", e.Addr(genericWallet))
        .Value(e.Addr(deployer)),
    );

    currenciesAmbassadorFees[currencyRand] += ambassadorFee;

    const index = ambassadors.findIndex((addr) => {
      return addr.toTopHex() === e.Addr(deployerAddress).toTopHex();
    });
    if (index === -1) {
      ambassadorsRefferalFees.push([BigInt(0), BigInt(0), BigInt(0)]);
      ambassadorsRefferalFees[ambIdx][currencyRand] = ambassadorFee;
      ambIdx += 1;
      ambassadors.push(e.Addr(deployerAddress));
    } else {
      const current = ambassadorsRefferalFees[index][currencyRand];
      ambassadorsRefferalFees[index][currencyRand] =
        BigInt(current.toString()) + BigInt(ambassadorFee.toString());
    }
    const currencyEncoded = e.Str(currenciesArray[currencyRand]);
    const indexCurrency = ambassadorCurrencies.findIndex(
      (cEncoded) => cEncoded.toTopHex() === currencyEncoded.toTopHex(),
    );
    if (indexCurrency == -1) {
      ambassadorCurrencies.push(currencyEncoded);
    }
  }
  for (let i = 0; i < ambassadorsRefferalFees.length; i++) {
    const addr = ambassadors[i];

    for (let j = 0; j < 3; j++) {
      const fees = BigInt(ambassadorsRefferalFees[i][j].toString());
      walletsKvs.push(
        e.kvs
          .Mapper("referral_ambassador_fee", addr, e.Str(currenciesArray[j]))
          .Value(e.U(fees)),
      );
    }
    walletsKvs.push(
      e.kvs
        .Mapper("ambassador_currencies", addr)
        .UnorderedSet(ambassadorCurrencies),
    );
  }

  const amountsKvs = [
    e.kvs.Mapper("addresses").UnorderedSet(addresses),
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
    e.kvs.Mapper("total_ambassador_fee").Value(e.U(totalAmbassadorsAmount)),
    e.kvs.Mapper("ambassadors").UnorderedSet(ambassadors),
    e.kvs
      .Mapper("ambassador_fee", e.Str(CURRENCY1))
      .Value(e.U(currenciesAmbassadorFees[0])),
    e.kvs
      .Mapper("ambassador_fee", e.Str(CURRENCY2))
      .Value(e.U(currenciesAmbassadorFees[1])),
    e.kvs
      .Mapper("ambassador_fee", e.Str(CURRENCY3))
      .Value(e.U(currenciesAmbassadorFees[2])),
    e.kvs
      .Mapper("total_amount_currency", e.Str(CURRENCY1))
      .Value(e.U(currenciesTotal[0])),
    e.kvs
      .Mapper("total_amount_currency", e.Str(CURRENCY2))
      .Value(e.U(currenciesTotal[1])),
    e.kvs
      .Mapper("total_amount_currency", e.Str(CURRENCY3))
      .Value(e.U(currenciesTotal[2])),
    e.kvs.Esdts([
      { id: CURRENCY1, amount: currenciesTotal[0] },
      { id: CURRENCY2, amount: currenciesTotal[1] },
      { id: CURRENCY3, amount: currenciesTotal[2] },
    ]),
  ];

  assertAccount(await raisePoolContract.getAccount(), {
    balance: 0n,
    kvs: [...baseKvs, ...walletsKvs, ...amountsKvs],
  });
}, 60000);
