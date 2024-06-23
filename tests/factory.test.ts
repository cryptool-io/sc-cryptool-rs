import { test, beforeEach, afterEach } from "vitest";
import { assertAccount, LSWorld, LSWallet, LSContract } from "xsuite";
import { e } from "xsuite";
import {
  deployerAddress,
  bobAddress,
  POOL_ID,
  TIMESTAMP,
  SIGNATURE_DEPLOYER,
  SIGNATURE_BOB_WITH_AMBASSADOR,
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
  PLATFORM_FEE,
  GROUP_FEE,
  AMBASSADOR_FEE,
  SIGNATURE_DUMMY,
  TIMESTAMP_BEFORE,
  SIGNATURE_BEFORE,
  HARD_CAP_INVALID,
  MAX_DEPOSIT_INVALID,
  END_DATE_INVALID,
  RAISE_POOL_DUMMY_ADDRESS
} from "./helpers"; 


let world: LSWorld;
let deployer: LSWallet;
let bob: LSWallet;
let factoryContract: LSContract;
let raisePoolDummyContract: LSContract; 
let raisePoolContract: LSContract;

beforeEach(async () => {
  world = await LSWorld.start();
  await world.setCurrentBlockInfo({
    timestamp: 120,
  });
  deployer =  await world.createWallet({ address: deployerAddress });

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
      e.U64(0)
    ],
    gasLimit: 10_000_000,
  }));

  ({ contract: factoryContract } = await deployer.deployContract({
    code: "file:factory/output/factory.wasm",
    codeMetadata: [],
    gasLimit: 10_000_000,
    codeArgs: [
      e.Addr(raisePoolDummyContract), e.Addr(deployer),
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
      e.kvs
        .Mapper("raise_pool_enabled")
        .Value(e.Bool(false)),
      e.kvs.Mapper("source_contract").Value(e.Addr(raisePoolDummyContract)),
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U64(7)),
      e.kvs.Mapper("signer").Value(e.Addr(deployer)),
    ],
  });
  });

test("Deploy Pool with invalid Signature", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [e.U32(POOL_ID), 
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
      e.U64(DECIMALS1), 
      e.Str(CURRENCY2), 
      e.U64(DECIMALS2)],
    }).assertFail({ code: 10, message: "invalid signature" })
  }); 

test("Deploy Pool with too much delay", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [e.U32(POOL_ID), 
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
      e.U64(DECIMALS1), 
      e.Str(CURRENCY2), 
      e.U64(DECIMALS2)],
    }).assertFail({ code: 4, message: "Deploy took too long" })
  }); 

test("Deploy Pool with invalid Hard Cap", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [e.U32(POOL_ID), 
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
      e.U64(DECIMALS1), 
      e.Str(CURRENCY2), 
      e.U64(DECIMALS2)],
    }).assertFail({ code: 10, message: "error signalled by smartcontract" })
  });  

test("Deploy Pool with invalid Max Deposit", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [e.U32(POOL_ID), 
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
      e.U64(DECIMALS1), 
      e.Str(CURRENCY2), 
      e.U64(DECIMALS2)],
    }).assertFail({ code: 10, message: "error signalled by smartcontract" })
  });  

test("Deploy Pool with invalid End Date", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [e.U32(POOL_ID), 
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
      e.U64(DECIMALS1), 
      e.Str(CURRENCY2), 
      e.U64(DECIMALS2)],
    }).assertFail({ code: 10, message: "error signalled by smartcontract" })
  });  

test("Deploy Pool", async () => {
  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [e.U32(POOL_ID), 
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
      e.U64(DECIMALS2)],
    })
    
    assertAccount(await factoryContract.getAccount(), {
      balance: 0n,
      kvs: [
        e.kvs
          .Mapper("raise_pool_enabled")
          .Value(e.Bool(false)),
        e.kvs.Mapper("source_contract").Value(e.Addr(raisePoolDummyContract)),
        e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U64(7)),
        e.kvs.Mapper("pool_id_to_address", e.U32(POOL_ID)).Value(e.Addr(RAISE_POOL_DUMMY_ADDRESS)),
        e.kvs.Mapper("address_to_deployer", e.Addr(RAISE_POOL_DUMMY_ADDRESS)).Value(e.Addr(deployer)),
        e.kvs.Mapper("signer").Value(e.Addr(deployer)),
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
      world
    });
  
    assertAccount(await raisePoolContract.getAccount(), {
      balance: 0n,
      kvs: [
        e.kvs
        .Mapper("soft_cap")
        .Value(e.I(SOFT_CAP)),
        e.kvs
        .Mapper("hard_cap")
        .Value(e.I(HARD_CAP)),
        e.kvs
        .Mapper("min_deposit")
        .Value(e.I(MIN_DEPOSIT)),
        e.kvs
        .Mapper("max_deposit")
        .Value(e.I(MAX_DEPOSIT)),
        e.kvs
        .Mapper("deposit_increments")
        .Value(e.I(DEPOSIT_INCREMENTS)),
        e.kvs
        .Mapper("start_date")
        .Value(e.U64(START_DATE)),
        e.kvs
        .Mapper("end_date")
        .Value(e.U64(END_DATE)),
        e.kvs
        .Mapper("refund_enabled")
        .Value(e.Bool(REFUND_ENABLED)),
        e.kvs
        .Mapper("platform_fee_wallet")
        .Value(e.Addr(deployer)),
        e.kvs
        .Mapper("group_fee_wallet")
        .Value(e.Addr(deployer)),
        e.kvs
        .Mapper("payment_currencies")
        .UnorderedSet([e.Str(CURRENCY1), e.Str(CURRENCY2)]),
        e.kvs
        .Mapper("currency_decimals", e.Str(CURRENCY1))
        .Value(e.U32(DECIMALS1)), 
        e.kvs
        .Mapper("currency_decimals", e.Str(CURRENCY2))
        .Value(e.U32(DECIMALS2)), 
        e.kvs
        .Mapper("raise_pool_enabled")
        .Value(e.Bool(false)),
        e.kvs
        .Mapper("signer")
        .Value(e.Addr(deployer)),
        e.kvs
        .Mapper("pool_id")
        .Value(e.U32(POOL_ID)),
        e.kvs
        .Mapper("release_state")
        .Value(e.Usize(0)),
      ],
    });
  });  

