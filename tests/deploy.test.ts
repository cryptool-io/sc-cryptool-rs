import { test, beforeEach, afterEach } from "vitest";
import { assertAccount, LSWorld, LSWallet, LSContract } from "xsuite";
import { e } from "xsuite";
import {
  POOL_ID,
  TIMESTAMP,
  SOFT_CAP,
  HARD_CAP,
  CURRENCY1,
  DECIMALS1,
  CURRENCY2,
  DECIMALS2,
  MIN_DEPOSIT,
  MAX_DEPOSIT,
  DEPOSIT_INCREMENTS,
  START_DATE,
  END_DATE,
  REFUND_ENABLED,
  TIMESTAMP_BEFORE,
  HARD_CAP_INVALID,
  MAX_DEPOSIT_INVALID,
  END_DATE_INVALID,
  RAISE_POOL_DUMMY_ADDRESS,
  MIN_DEPOSIT_INCORRECT,
  MAX_DEPOSIT_INCORRECT,
  INCORRECT_DECIMALS,
  CURRENCY3,
} from "./helpers.ts";

import {
  deployerAddress,
  SIGNATURE_DEPLOYER,
  SIGNATURE_DUMMY,
  SIGNATURE_BEFORE,
  SIGNATURE_WALLET,
} from "./signatures/deployer.ts";

let world: LSWorld;
let deployer: LSWallet;
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
      e.Addr(deployer), // POOL OWNER
      e.U64(0), // POOL ID
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
      e.Addr(deployer),
      e.Str(CURRENCY1),
      e.U64(DECIMALS1),
      e.Str(CURRENCY2),
      e.U64(DECIMALS2),
    ],
  }));
});

afterEach(async () => {
  world.terminate();
});

test("Deploy Factory", async () => {
  assertAccount(await factoryContract.getAccount(), {
    balance: 0n,
    kvs: [
      e.kvs.Mapper("raise_pool_enabled").Value(e.Bool(false)),
      e.kvs.Mapper("source_contract").Value(e.Addr(raisePoolDummyContract)),
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U64(7)),
      e.kvs.Mapper("signer").Value(e.Addr(deployer)),
      e.kvs
        .Mapper("payment_currencies")
        .UnorderedSet([e.Str(CURRENCY1), e.Str(CURRENCY2)]),
      e.kvs
        .Mapper("currency_decimals", e.Str(CURRENCY1))
        .Value(e.U32(DECIMALS1)),
      e.kvs
        .Mapper("currency_decimals", e.Str(CURRENCY2))
        .Value(e.U32(DECIMALS2)),
    ],
  });
});

test("Deploy Pool with incorrect min deposit", async () => {
  await deployer
    .callContract({
      callee: factoryContract,
      gasLimit: 50_000_000,
      funcName: "deployRaisePool",
      funcArgs: [
        e.U32(POOL_ID),
        e.U64(SOFT_CAP),
        e.U64(HARD_CAP),
        e.U64(MIN_DEPOSIT_INCORRECT),
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
      ],
    })
    .assertFail({ code: 10, message: "error signalled by smartcontract" });
});

test("Deploy Pool with incorrect max deposit", async () => {
  await deployer
    .callContract({
      callee: factoryContract,
      gasLimit: 50_000_000,
      funcName: "deployRaisePool",
      funcArgs: [
        e.U32(POOL_ID),
        e.U64(SOFT_CAP),
        e.U64(HARD_CAP),
        e.U64(MIN_DEPOSIT),
        e.U64(MAX_DEPOSIT_INCORRECT),
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
      ],
    })
    .assertFail({ code: 10, message: "error signalled by smartcontract" });
});

test("Deploy Pool with invalid Signature", async () => {
  await deployer
    .callContract({
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
        e.TopBuffer(SIGNATURE_DUMMY),
        e.U64(TIMESTAMP),
        e.Str(CURRENCY1),
        e.Str(CURRENCY2),
      ],
    })
    .assertFail({ code: 10, message: "invalid signature" });
});

test("Deploy Pool with too much delay", async () => {
  await deployer
    .callContract({
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
        e.TopBuffer(SIGNATURE_BEFORE),
        e.U64(TIMESTAMP_BEFORE),
        e.Str(CURRENCY1),
        e.Str(CURRENCY2),
      ],
    })
    .assertFail({ code: 4, message: "Deploy took too long" });
});

test("Deploy Pool with invalid Soft, Hard Cap pair", async () => {
  await deployer
    .callContract({
      callee: factoryContract,
      gasLimit: 50_000_000,
      funcName: "deployRaisePool",
      funcArgs: [
        e.U32(POOL_ID),
        e.U64(SOFT_CAP),
        e.U64(HARD_CAP_INVALID),
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
      ],
    })
    .assertFail({ code: 10, message: "error signalled by smartcontract" });
});

test("Deploy Pool with invalid Min, Max Deposit pair", async () => {
  await deployer
    .callContract({
      callee: factoryContract,
      gasLimit: 50_000_000,
      funcName: "deployRaisePool",
      funcArgs: [
        e.U32(POOL_ID),
        e.U64(SOFT_CAP),
        e.U64(HARD_CAP),
        e.U64(MIN_DEPOSIT),
        e.U64(MAX_DEPOSIT_INVALID),
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
      ],
    })
    .assertFail({ code: 10, message: "error signalled by smartcontract" });
});

test("Deploy Pool with invalid Start, End Date pair", async () => {
  await deployer
    .callContract({
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
        e.U64(END_DATE_INVALID),
        e.U64(REFUND_ENABLED),
        e.Addr(deployer),
        e.Addr(deployer),
        e.TopBuffer(SIGNATURE_DEPLOYER),
        e.U64(TIMESTAMP),
        e.Str(CURRENCY1),
        e.Str(CURRENCY2),
      ],
    })
    .assertFail({ code: 10, message: "error signalled by smartcontract" });
});

test("Deploy Pool with incorrect decimals", async () => {
  await deployer
    .deployContract({
      code: "file:factory/output/factory.wasm",
      codeMetadata: [],
      gasLimit: 10_000_000,
      codeArgs: [
        e.Addr(raisePoolDummyContract),
        e.Addr(deployer),
        e.Str(CURRENCY1),
        e.U64(INCORRECT_DECIMALS),
        e.Str(CURRENCY2),
        e.U64(DECIMALS2),
      ],
    })
    .assertFail({ code: 4, message: "Maximum decimals number is 18" });
});

test("Deploy Pool with not whitelisted currency", async () => {
  await deployer
    .callContract({
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
        e.Str(CURRENCY3),
        e.Str(CURRENCY2),
      ],
    })
    .assertFail({ code: 4, message: "One of the currencies is not whitelisted" });
});

test("Deploy Pool", async () => {
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
      e.Str(CURRENCY2),
    ],
  });

  assertAccount(await factoryContract.getAccount(), {
    balance: 0n,
    kvs: [
      e.kvs.Mapper("raise_pool_enabled").Value(e.Bool(false)),
      e.kvs.Mapper("source_contract").Value(e.Addr(raisePoolDummyContract)),
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U64(7)),
      e.kvs
        .Mapper("pool_id_to_address", e.U32(POOL_ID))
        .Value(e.Addr(RAISE_POOL_DUMMY_ADDRESS)),
      e.kvs
        .Mapper("address_to_deployer", e.Addr(RAISE_POOL_DUMMY_ADDRESS))
        .Value(e.Addr(deployer)),
      e.kvs.Mapper("signer").Value(e.Addr(deployer)),
      e.kvs
        .Mapper("payment_currencies")
        .UnorderedSet([e.Str(CURRENCY1), e.Str(CURRENCY2)]),
      e.kvs
        .Mapper("currency_decimals", e.Str(CURRENCY1))
        .Value(e.U32(DECIMALS1)),
      e.kvs
        .Mapper("currency_decimals", e.Str(CURRENCY2))
        .Value(e.U32(DECIMALS2)),
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
      e.kvs.Mapper("owner").Value(e.Addr(deployer)),
    ],
  });
});
