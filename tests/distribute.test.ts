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
  SOFT_CAP,
  HARD_CAP,
  HIGH_SOFT_CAP,
  HIGH_HARD_CAP,
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
  DEPOSIT_TIMESTAMP,
  CURRENCY1_DEPOSIT_AMOUNT,
  CURRENCY2_DEPOSIT_AMOUNT,
  CURRENCY3_DEPOSIT_AMOUNT,
  DUMMY_TOKEN,
  CURRENCY1_DISTRIBUTE_AMOUNT,
} from "./helpers.ts";

import { bobAddress, SIGNATURE_BOB_REFUND } from "./signatures/bob.ts";

import {
  deployerAddress,
  SIGNATURE_DEPLOYER,
  SIGNATURE_DUMMY,
} from "./signatures/deployer.ts";

let world: LSWorld;
let deployer: LSWallet;
let alice: LSWallet;
let bob: LSWallet;
let carol: LSWallet;
let factoryContract: LSContract;
let raisePoolDummyContract: LSContract;
let walletDababaseContract: LSContract;

beforeEach(async () => {
  world = await LSWorld.start();
  await world.setCurrentBlockInfo({
    timestamp: TIMESTAMP,
  });
  deployer = await world.createWallet({
    address: deployerAddress,
    kvs: [
      e.kvs.Esdts([
        { id: DUMMY_TOKEN, amount: CURRENCY1_DEPOSIT_AMOUNT },
        { id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT },
        { id: CURRENCY2, amount: CURRENCY2_DEPOSIT_AMOUNT },
        { id: CURRENCY3, amount: CURRENCY3_DEPOSIT_AMOUNT },
      ]),
    ],
  });

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
      e.Addr(deployer), // POOL OWNER
      e.Str("0"), // POOL ID
      e.U64(0), // SOFT CAP
      e.U64(10), // HARD CAP
      e.U64(1), // MIN DEPOSIT
      e.U64(10), // MAX DEPOSIT
      e.U64(1), // DEPOSIT INCREMENTS
      e.U64(121), // START DATE
      e.U64(122), // END DATE
      e.U64(1), // REFUND ENABLED
      e.Addr(deployer), // PLATFORM FEE WALLET
      e.Addr(deployer), // GROUP FEE WALLET
      e.Addr(deployer), // SIGNATURE DEPLOYER
      e.Addr(walletDababaseContract), // WALLET DATABASE CONTRACT
      e.Str("Dummy1"), // CURRENCY1
      e.U64(0), // DECIMALS1
      e.Str("Dummy2"), // CURRENCY2
      e.U64(0), // DECIMALS2
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

test("Top up with wrong signature", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.Str(POOL_ID),
      e.U64(HIGH_SOFT_CAP),
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

  await deployer
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "topUp",
      funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_DUMMY)],
    })
    .assertFail({ code: 10, message: "invalid signature" });
});

test("Top up by non owner", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.Str(POOL_ID),
      e.U64(HIGH_SOFT_CAP),
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
  });

  await bob
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "topUp",
      funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_BOB_REFUND)],
    })
    .assertFail({ code: 4, message: "Only owner can call this function" });
});

test("Top up with invalid timestamp", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.Str(POOL_ID),
      e.U64(HIGH_SOFT_CAP),
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

  const currenciesArray = [CURRENCY1, CURRENCY2, CURRENCY3];
  const currenciesDecimals = [DECIMALS1, DECIMALS2, DECIMALS3];

  await world.setCurrentBlockInfo({
    timestamp: TIMESTAMP - 10,
  });

  await deployer
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "topUp",
      funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_DEPLOYER)],
    })
    .assertFail({
      code: 4,
      message: "Timestamp provided by backend set in the future",
    });
});

test("Top up with no payment", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.Str(POOL_ID),
      e.U64(HIGH_SOFT_CAP),
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

  await deployer
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "topUp",
      funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_DEPLOYER)],
    })
    .assertFail({ code: 4, message: "incorrect number of ESDT transfers" });
});

test("Top up twice with different tokens", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.Str(POOL_ID),
      e.U64(HIGH_SOFT_CAP),
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

  await deployer.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "topUp",
    funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_DEPLOYER)],
    esdts: [{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }],
  });

  await deployer
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "topUp",
      funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_DEPLOYER)],
      esdts: [{ id: CURRENCY2, amount: CURRENCY2_DEPOSIT_AMOUNT }],
    })
    .assertFail({ code: 4, message: "Only one token can be used for top-up" });
});

test("Top up twice", async () => {
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

  await deployer.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "topUp",
    funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_DEPLOYER)],
    esdts: [{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT / BigInt(2) }],
  });

  await deployer.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "topUp",
    funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_DEPLOYER)],
    esdts: [{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT / BigInt(2) }],
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
      e.kvs.Mapper("owner").Value(e.Addr(deployer)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
      e.kvs.Mapper("top_up_amount").Value(e.U(CURRENCY1_DEPOSIT_AMOUNT)),
      e.kvs.Mapper("top_up_token").Value(e.Str(CURRENCY1)),
      e.kvs.Esdts([{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }]),
    ],
  });
});

test("Distribute with wrong signature", async () => {
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

  await deployer.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "topUp",
    funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_DEPLOYER)],
    esdts: [{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }],
  });

  alice = await world.createWallet();

  await deployer
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "distribute",
      funcArgs: [
        e.U64(TIMESTAMP),
        e.TopBuffer(SIGNATURE_DUMMY),
        e.Addr(alice),
        e.Str(CURRENCY1),
        e.U(CURRENCY1_DEPOSIT_AMOUNT),
      ],
    })
    .assertFail({ code: 10, message: "invalid signature" });
});

test("Distribute by non owner", async () => {
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

  await deployer.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "topUp",
    funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_DEPLOYER)],
    esdts: [{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }],
  });

  bob = await world.createWallet({
    address: bobAddress,
    balance: 100_000,
  });

  await bob
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "distribute",
      funcArgs: [
        e.U64(TIMESTAMP),
        e.TopBuffer(SIGNATURE_BOB_REFUND),
        e.Addr(bob),
        e.Str(CURRENCY1),
        e.U(CURRENCY1_DEPOSIT_AMOUNT),
      ],
    })
    .assertFail({ code: 4, message: "Only owner can call this function" });
});

test("Distribute too much amount", async () => {
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

  await deployer.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "topUp",
    funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_DEPLOYER)],
    esdts: [{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }],
  });

  alice = await world.createWallet();

  await deployer
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "distribute",
      funcArgs: [
        e.U64(TIMESTAMP),
        e.TopBuffer(SIGNATURE_DEPLOYER),
        e.Addr(alice),
        e.Str(CURRENCY1),
        e.U(CURRENCY1_DEPOSIT_AMOUNT * BigInt(2)),
      ],
    })
    .assertFail({ code: 10, message: "insufficient funds" });
});

test("Distribute", async () => {
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

  await deployer.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "topUp",
    funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_DEPLOYER)],
    esdts: [{ id: CURRENCY1, amount: CURRENCY1_DISTRIBUTE_AMOUNT }],
  });

  alice = await world.createWallet();
  bob = await world.createWallet();
  carol = await world.createWallet();

  await deployer.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "distribute",
    funcArgs: [
      e.U64(TIMESTAMP),
      e.TopBuffer(SIGNATURE_DEPLOYER),
      e.Addr(alice),
      e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
      e.Addr(bob),
      e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
      e.Addr(carol),
      e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
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
      e.kvs.Mapper("pool_id").Value(e.Str(POOL_ID)),
      e.kvs.Mapper("release_state").Value(e.Usize(0)),
      e.kvs.Mapper("raise_pool_enabled").Value(e.Bool(true)),
      e.kvs.Mapper("owner").Value(e.Addr(deployer)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
      e.kvs.Mapper("top_up_token").Value(e.Str(CURRENCY1)),
    ],
  });
});
