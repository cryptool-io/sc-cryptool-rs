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
  ONE_EGLD,
  ONE_TENTH_EGLD,
  EGLD_AS_ESDT,
  CORRECT_BATCH_ID,
  INCORRECT_BATCH_ID,
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

  ({ contract: distributionContract } = await deployer.deployContract({
    code: "file:distribution/output/distribution.wasm",
    codeMetadata: [],
    codeArgs: [e.Addr(deployer)],
    gasLimit: 10_000_000,
  }));
});

afterEach(async () => {
  world.terminate();
});

test("Distribute with wrong signature", async () => {
  await deployer
    .callContract({
      callee: distributionContract,
      gasLimit: 50_000_000,
      funcName: "distribute",
      funcArgs: [
        e.Str(POOL_ID),
        e.U32(CORRECT_BATCH_ID),
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

// test("Distribute by non owner", async () => {
//   let platform_wallet = await world.createWallet();

//   await deployer.callContract({
//     callee: factoryContract,
//     gasLimit: 50_000_000,
//     funcName: "deployRaisePool",
//     funcArgs: [
//       e.Str(POOL_ID),
//       e.U64(SOFT_CAP),
//       e.U64(HARD_CAP),
//       e.U64(MIN_DEPOSIT),
//       e.U64(MAX_DEPOSIT),
//       e.U64(DEPOSIT_INCREMENTS),
//       e.U64(START_DATE),
//       e.U64(END_DATE),
//       e.U64(REFUND_ENABLED),
//       e.U64(END_DATE),
//       e.Addr(platform_wallet),
//       e.Addr(deployer),
//       e.TopBuffer(SIGNATURE_DEPLOYER),
//       e.U64(TIMESTAMP),
//       e.Str(CURRENCY1),
//       e.Str(CURRENCY2),
//       e.Str(CURRENCY3),
//     ],
//   });

//   const raisePoolAddressResult = await deployer.query({
//     callee: factoryContract,
//     funcName: "getPoolIdToAddress",
//     funcArgs: [e.Str(POOL_ID)],
//   });

//   const raisePoolAddress = raisePoolAddressResult.returnData[0];

//   const raisePoolContract = new LSContract({
//     address: raisePoolAddress,
//     world,
//   });

//   await deployer.callContract({
//     callee: factoryContract,
//     gasLimit: 50_000_000,
//     funcName: "enableRaisePool",
//     funcArgs: [
//       e.U64(TIMESTAMP),
//       e.Str(POOL_ID),
//       e.TopBuffer(SIGNATURE_DEPLOYER),
//       e.Bool(true),
//     ],
//   });

//   await world.setCurrentBlockInfo({
//     timestamp: DEPOSIT_TIMESTAMP,
//   });

//   alice = await world.createWallet();
//   bob = await world.createWallet();
//   carol = await world.createWallet();

//   // SIMULATE EGLD AS ESDT TRANSFER
//   await deployer.transfer({
//     receiver: raisePoolContract,
//     gasLimit: 50_000_000,
//     value: ONE_TENTH_EGLD,
//   });

//   bob = await world.createWallet({
//     address: bobAddress,
//     balance: 100_000,
//   });

//   await bob
//     .callContract({
//       callee: raisePoolContract,
//       gasLimit: 50_000_000,
//       funcName: "distribute",
//       funcArgs: [
//         e.U64(TIMESTAMP),
//         e.TopBuffer(SIGNATURE_BOB_REFUND),
//         e.Addr(alice),
//         e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
//         e.Addr(bob),
//         e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
//         e.Addr(carol),
//         e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
//       ],
//     })
//     .assertFail({ code: 4, message: "Only owner can call this function" });
// });

// test("Distribute with invalid timestamp", async () => {
//   let platform_wallet = await world.createWallet();

//   await deployer.callContract({
//     callee: factoryContract,
//     gasLimit: 50_000_000,
//     funcName: "deployRaisePool",
//     funcArgs: [
//       e.Str(POOL_ID),
//       e.U64(SOFT_CAP),
//       e.U64(HARD_CAP),
//       e.U64(MIN_DEPOSIT),
//       e.U64(MAX_DEPOSIT),
//       e.U64(DEPOSIT_INCREMENTS),
//       e.U64(START_DATE),
//       e.U64(END_DATE),
//       e.U64(REFUND_ENABLED),
//       e.U64(END_DATE),
//       e.Addr(platform_wallet),
//       e.Addr(deployer),
//       e.TopBuffer(SIGNATURE_DEPLOYER),
//       e.U64(TIMESTAMP),
//       e.Str(CURRENCY1),
//       e.Str(CURRENCY2),
//       e.Str(CURRENCY3),
//     ],
//   });

//   const raisePoolAddressResult = await deployer.query({
//     callee: factoryContract,
//     funcName: "getPoolIdToAddress",
//     funcArgs: [e.Str(POOL_ID)],
//   });

//   const raisePoolAddress = raisePoolAddressResult.returnData[0];

//   const raisePoolContract = new LSContract({
//     address: raisePoolAddress,
//     world,
//   });

//   await deployer.callContract({
//     callee: factoryContract,
//     gasLimit: 50_000_000,
//     funcName: "enableRaisePool",
//     funcArgs: [
//       e.U64(TIMESTAMP),
//       e.Str(POOL_ID),
//       e.TopBuffer(SIGNATURE_DEPLOYER),
//       e.Bool(true),
//     ],
//   });

//   await world.setCurrentBlockInfo({
//     timestamp: DEPOSIT_TIMESTAMP,
//   });

//   alice = await world.createWallet();
//   bob = await world.createWallet();
//   carol = await world.createWallet();

//   // SIMULATE EGLD AS ESDT TRANSFER
//   await deployer.transfer({
//     receiver: raisePoolContract,
//     gasLimit: 50_000_000,
//     value: ONE_TENTH_EGLD,
//   });

//   await world.setCurrentBlockInfo({
//     timestamp: TIMESTAMP - 10,
//   });

//   await deployer
//     .callContract({
//       callee: raisePoolContract,
//       gasLimit: 50_000_000,
//       funcName: "distribute",
//       funcArgs: [
//         e.U64(TIMESTAMP),
//         e.TopBuffer(SIGNATURE_DEPLOYER),
//         e.Addr(alice),
//         e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
//         e.Addr(bob),
//         e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
//         e.Addr(carol),
//         e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
//       ],
//     })
//     .assertFail({
//       code: 4,
//       message: "Timestamp provided by backend set in the future",
//     });
// });

// test("Distribute with no payment", async () => {
//   let platform_wallet = await world.createWallet();

//   await deployer.callContract({
//     callee: factoryContract,
//     gasLimit: 50_000_000,
//     funcName: "deployRaisePool",
//     funcArgs: [
//       e.Str(POOL_ID),
//       e.U64(SOFT_CAP),
//       e.U64(HARD_CAP),
//       e.U64(MIN_DEPOSIT),
//       e.U64(MAX_DEPOSIT),
//       e.U64(DEPOSIT_INCREMENTS),
//       e.U64(START_DATE),
//       e.U64(END_DATE),
//       e.U64(REFUND_ENABLED),
//       e.U64(END_DATE),
//       e.Addr(platform_wallet),
//       e.Addr(deployer),
//       e.TopBuffer(SIGNATURE_DEPLOYER),
//       e.U64(TIMESTAMP),
//       e.Str(CURRENCY1),
//       e.Str(CURRENCY2),
//       e.Str(CURRENCY3),
//     ],
//   });

//   const raisePoolAddressResult = await deployer.query({
//     callee: factoryContract,
//     funcName: "getPoolIdToAddress",
//     funcArgs: [e.Str(POOL_ID)],
//   });

//   const raisePoolAddress = raisePoolAddressResult.returnData[0];

//   const raisePoolContract = new LSContract({
//     address: raisePoolAddress,
//     world,
//   });

//   await deployer.callContract({
//     callee: factoryContract,
//     gasLimit: 50_000_000,
//     funcName: "enableRaisePool",
//     funcArgs: [
//       e.U64(TIMESTAMP),
//       e.Str(POOL_ID),
//       e.TopBuffer(SIGNATURE_DEPLOYER),
//       e.Bool(true),
//     ],
//   });

//   await world.setCurrentBlockInfo({
//     timestamp: DEPOSIT_TIMESTAMP,
//   });

//   alice = await world.createWallet();
//   bob = await world.createWallet();
//   carol = await world.createWallet();

//   // SIMULATE EGLD AS ESDT TRANSFER
//   await deployer.transfer({
//     receiver: raisePoolContract,
//     gasLimit: 50_000_000,
//     value: ONE_TENTH_EGLD,
//   });

//   await deployer
//     .callContract({
//       callee: raisePoolContract,
//       gasLimit: 50_000_000,
//       funcName: "distribute",
//       funcArgs: [
//         e.U64(TIMESTAMP),
//         e.TopBuffer(SIGNATURE_DEPLOYER),
//         e.Addr(alice),
//         e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
//         e.Addr(bob),
//         e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
//         e.Addr(carol),
//         e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
//       ],
//     })
//     .assertFail({
//       code: 4,
//       message: "Two payments are expected, one for EGLD and one for ESDT",
//     });
// });

// test("Distribute", async () => {
//   let platform_wallet = await world.createWallet();

//   await deployer.callContract({
//     callee: factoryContract,
//     gasLimit: 50_000_000,
//     funcName: "deployRaisePool",
//     funcArgs: [
//       e.Str(POOL_ID),
//       e.U64(SOFT_CAP),
//       e.U64(HARD_CAP),
//       e.U64(MIN_DEPOSIT),
//       e.U64(MAX_DEPOSIT),
//       e.U64(DEPOSIT_INCREMENTS),
//       e.U64(START_DATE),
//       e.U64(END_DATE),
//       e.U64(REFUND_ENABLED),
//       e.U64(END_DATE),
//       e.Addr(platform_wallet),
//       e.Addr(deployer),
//       e.TopBuffer(SIGNATURE_DEPLOYER),
//       e.U64(TIMESTAMP),
//       e.Str(CURRENCY1),
//       e.Str(CURRENCY2),
//       e.Str(CURRENCY3),
//     ],
//   });

//   const raisePoolAddressResult = await deployer.query({
//     callee: factoryContract,
//     funcName: "getPoolIdToAddress",
//     funcArgs: [e.Str(POOL_ID)],
//   });

//   const raisePoolAddress = raisePoolAddressResult.returnData[0];

//   const raisePoolContract = new LSContract({
//     address: raisePoolAddress,
//     world,
//   });

//   await deployer.callContract({
//     callee: factoryContract,
//     gasLimit: 50_000_000,
//     funcName: "enableRaisePool",
//     funcArgs: [
//       e.U64(TIMESTAMP),
//       e.Str(POOL_ID),
//       e.TopBuffer(SIGNATURE_DEPLOYER),
//       e.Bool(true),
//     ],
//   });

//   await world.setCurrentBlockInfo({
//     timestamp: DEPOSIT_TIMESTAMP,
//   });

//   alice = await world.createWallet();
//   bob = await world.createWallet();
//   carol = await world.createWallet();

//   await deployer.callContract({
//     callee: raisePoolContract,
//     gasLimit: 50_000_000,
//     funcName: "distribute",
//     funcArgs: [
//       e.U64(TIMESTAMP),
//       e.TopBuffer(SIGNATURE_DEPLOYER),
//       e.Addr(alice),
//       e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
//       e.Addr(bob),
//       e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
//       e.Addr(carol),
//       e.U(CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3)),
//     ],
//     esdts: [
//       { id: EGLD_AS_ESDT, amount: ONE_TENTH_EGLD },
//       { id: CURRENCY1, amount: CURRENCY1_DISTRIBUTE_AMOUNT },
//     ],
//   });

//   assertAccount(await world.getAccount(alice), {
//     kvs: [
//       e.kvs.Esdts([
//         { id: CURRENCY1, amount: CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3) },
//       ]),
//     ],
//   });

//   assertAccount(await world.getAccount(bob), {
//     kvs: [
//       e.kvs.Esdts([
//         { id: CURRENCY1, amount: CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3) },
//       ]),
//     ],
//   });

//   assertAccount(await world.getAccount(carol), {
//     kvs: [
//       e.kvs.Esdts([
//         { id: CURRENCY1, amount: CURRENCY1_DISTRIBUTE_AMOUNT / BigInt(3) },
//       ]),
//     ],
//   });

//   assertAccount(await world.getAccount(platform_wallet), {
//     balance: ONE_TENTH_EGLD,
//   });

//   assertAccount(await raisePoolContract.getAccount(), {
//     balance: 0n,
//     kvs: [
//       e.kvs.Mapper("soft_cap").Value(e.I(SOFT_CAP)),
//       e.kvs.Mapper("hard_cap").Value(e.I(HARD_CAP)),
//       e.kvs.Mapper("min_deposit").Value(e.I(MIN_DEPOSIT)),
//       e.kvs.Mapper("max_deposit").Value(e.I(MAX_DEPOSIT)),
//       e.kvs.Mapper("deposit_increments").Value(e.I(DEPOSIT_INCREMENTS)),
//       e.kvs.Mapper("start_date").Value(e.U64(START_DATE)),
//       e.kvs.Mapper("end_date").Value(e.U64(END_DATE)),
//       e.kvs.Mapper("refund_enabled").Value(e.Bool(Boolean(REFUND_ENABLED))),
//       e.kvs.Mapper("refund_deadline").Value(e.U64(END_DATE)),
//       e.kvs.Mapper("platform_fee_wallet").Value(e.Addr(platform_wallet)),
//       e.kvs.Mapper("group_fee_wallet").Value(e.Addr(deployer)),
//       e.kvs
//         .Mapper("payment_currencies")
//         .UnorderedSet([e.Str(CURRENCY1), e.Str(CURRENCY2), e.Str(CURRENCY3)]),
//       e.kvs
//         .Mapper("currency_decimals", e.Str(CURRENCY1))
//         .Value(e.U32(DECIMALS1)),
//       e.kvs
//         .Mapper("currency_decimals", e.Str(CURRENCY2))
//         .Value(e.U32(DECIMALS2)),
//       e.kvs
//         .Mapper("currency_decimals", e.Str(CURRENCY3))
//         .Value(e.U32(DECIMALS3)),
//       e.kvs.Mapper("raise_pool_enabled").Value(e.Bool(false)),
//       e.kvs.Mapper("signer").Value(e.Addr(deployer)),
//       e.kvs.Mapper("pool_id").Value(e.Str(POOL_ID)),
//       e.kvs.Mapper("release_state").Value(e.Usize(0)),
//       e.kvs.Mapper("raise_pool_enabled").Value(e.Bool(true)),
//       e.kvs.Mapper("owner").Value(e.Addr(deployer)),
//       e.kvs
//         .Mapper("wallet_database_address")
//         .Value(e.Addr(walletDababaseContract)),
//     ],
//   });
// });
