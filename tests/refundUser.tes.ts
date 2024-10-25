import { test, beforeEach, afterEach, expect } from "vitest";
import { Kvs } from "xsuite/dist/data/kvs";
import { BytesLike, e } from "xsuite";

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
  HIGH_SOFT_CAP,
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
  REFUND_DISABLED,
  DEPOSIT_TIMESTAMP,
  HIGH_HARD_CAP,
  TIMESTAMP_WITH_DELAY,
  REFUND_NOT_ENABLED,
  LOW_SOFT_CAP,
  TIMESTAMP_AFTER,
  MAX_PERCENTAGE,
  SOFT_CAP,
  HARD_CAP,
  CURRENCY1_DEPOSIT_AMOUNT,
  CURRENCY2_DEPOSIT_AMOUNT,
  CURRENCY3_DEPOSIT_AMOUNT,
  PLATFORM_FEE1,
  GROUP_FEE1,
  PLATFORM_FEE2,
  GROUP_FEE2,
  AMBASSADOR_FEE,
} from "./helpers.ts";

import {
  bobAddress,
  SIGNATURE_BOB_WALLET,
  SIGNATURE_BOB_WITH_AMBASSADOR,
  SIGNATURE_DATA_BOB_USER_REFUND_CURRENCY1,
  SIGNATURE_DATA_BOB_USER_REFUND_CURRENCY2,
} from "./signatures/bob.ts";

import {
  carolAddress,
  SIGNATURE_CAROL_WALLET,
  SIGNATURE_CAROL_WITHOUT_AMBASSADOR,
  SIGNATURE_DATA_CAROL_USER_REFUND_CURRENCY3,
} from "./signatures/carol.ts";

import {
  deployerAddress,
  SIGNATURE_AFTER,
  SIGNATURE_DEPLOYER,
  SIGNATURE_DUMMY,
} from "./signatures/deployer.ts";

import {
  generateDataAndSignature,
  getRandomInt,
  getRandomDeposit,
} from "./generator.ts";

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
      e.U64(122), // REFUND DEADLINE
      e.Addr(deployer), // PLATFORM FEE WALLET
      e.Addr(deployer), // GROUP FEE WALLET
      e.Addr(deployer), // SIGNATURE DEPLOYER
      e.Addr(walletDababaseContract), // WALLET DATABASE CONTRACT
      e.Str("Dummy1"), // CURRENCY1
      e.U64(0), // DECIMALS1
      e.Str("Dummy2"), // CURRENCY2
      e.U64(0), // DECIMALS2
    ],
    gasLimit: 50_000_000,
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

test("Refund user while refund not enabled", async () => {
  const numberOfDeposits = 1;

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
      e.U64(REFUND_DISABLED),
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

  for (let i = 0; i < numberOfDeposits; i++) {
    const {
      address,
      whitelistSignature,
      depositSignature,
      platformFee,
      groupFee,
      ambassadorFee,
      ambassadorAddress,
    } = generateDataAndSignature(1);

    const currencyRand = getRandomInt(0, 2);
    const currency = currenciesArray[currencyRand];
    const decimals = currenciesDecimals[currencyRand];
    const depositAmount = getRandomDeposit(
      MIN_DEPOSIT,
      MAX_DEPOSIT,
      DEPOSIT_INCREMENTS,
    );
    const depositAmountInCurrency =
      BigInt(depositAmount) * BigInt(10 ** decimals);

    genericWallet = await world.createWallet({
      address: address,
      balance: 100_000,
      kvs: [e.kvs.Esdts([{ id: currency, amount: depositAmountInCurrency }])],
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
        e.U(ambassadorFee),
        e.Addr(ambassadorAddress),
      ],
      esdts: [{ id: currency, amount: depositAmountInCurrency }],
    });

    await genericWallet
      .callContract({
        callee: raisePoolContract,
        gasLimit: 50_000_000,
        funcName: "userRefund",
        funcArgs: [
          e.U64(TIMESTAMP),
          e.TopBuffer(SIGNATURE_DUMMY),
          e.Str(currency),
        ],
      })
      .assertFail({ code: 4, message: "Refund is not enabled" });
  }
});

test("Refund user after refund deadline has passed", async () => {
  const numberOfDeposits = 1;

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

  for (let i = 0; i < numberOfDeposits; i++) {
    const {
      address,
      whitelistSignature,
      depositSignature,
      platformFee,
      groupFee,
      ambassadorFee,
      ambassadorAddress,
    } = generateDataAndSignature(1);

    const currencyRand = getRandomInt(0, 2);
    const currency = currenciesArray[currencyRand];
    const decimals = currenciesDecimals[currencyRand];
    const depositAmount = getRandomDeposit(
      MIN_DEPOSIT,
      MAX_DEPOSIT,
      DEPOSIT_INCREMENTS,
    );
    const depositAmountInCurrency =
      BigInt(depositAmount) * BigInt(10 ** decimals);

    genericWallet = await world.createWallet({
      address: address,
      balance: 100_000,
      kvs: [e.kvs.Esdts([{ id: currency, amount: depositAmountInCurrency }])],
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
        e.U(ambassadorFee),
        e.Addr(ambassadorAddress),
      ],
      esdts: [{ id: currency, amount: depositAmountInCurrency }],
    });

    await world.setCurrentBlockInfo({
      timestamp: TIMESTAMP_AFTER,
    });

    await genericWallet
      .callContract({
        callee: raisePoolContract,
        gasLimit: 50_000_000,
        funcName: "userRefund",
        funcArgs: [
          e.U64(TIMESTAMP),
          e.TopBuffer(depositSignature),
          e.Str(currency),
        ],
      })
      .assertFail({ code: 4, message: "Refund deadline has passed" });
  }
});

test("Refund user with unregistered wallet", async () => {
  const numberOfDeposits = 1;

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

  for (let i = 0; i < numberOfDeposits; i++) {
    const {
      address,
      whitelistSignature,
      depositSignature,
      platformFee,
      groupFee,
      ambassadorFee,
      ambassadorAddress,
    } = generateDataAndSignature(1);

    const currencyRand = getRandomInt(0, 2);
    const currency = currenciesArray[currencyRand];
    const decimals = currenciesDecimals[currencyRand];
    const depositAmount = getRandomDeposit(
      MIN_DEPOSIT,
      MAX_DEPOSIT,
      DEPOSIT_INCREMENTS,
    );
    const depositAmountInCurrency =
      BigInt(depositAmount) * BigInt(10 ** decimals);

    genericWallet = await world.createWallet({
      address: address,
      balance: 100_000,
      kvs: [e.kvs.Esdts([{ id: currency, amount: depositAmountInCurrency }])],
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
        e.U(ambassadorFee),
        e.Addr(ambassadorAddress),
      ],
      esdts: [{ id: currency, amount: depositAmountInCurrency }],
    });

    await genericWallet.callContract({
      callee: walletDababaseContract,
      gasLimit: 50_000_000,
      funcName: "removeWallet",
      funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(whitelistSignature)],
    });

    await genericWallet
      .callContract({
        callee: raisePoolContract,
        gasLimit: 50_000_000,
        funcName: "userRefund",
        funcArgs: [
          e.U64(TIMESTAMP),
          e.TopBuffer(SIGNATURE_DUMMY),
          e.Str(currency),
        ],
      })
      .assertFail({ code: 4, message: "Wallet not registered" });
  }
});

test("Refund user with wrong signature", async () => {
  const numberOfDeposits = 1;

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

  for (let i = 0; i < numberOfDeposits; i++) {
    const {
      address,
      whitelistSignature,
      depositSignature,
      platformFee,
      groupFee,
      ambassadorFee,
      ambassadorAddress,
    } = generateDataAndSignature(1);

    const currencyRand = getRandomInt(0, 2);
    const currency = currenciesArray[currencyRand];
    const decimals = currenciesDecimals[currencyRand];
    const depositAmount = getRandomDeposit(
      MIN_DEPOSIT,
      MAX_DEPOSIT,
      DEPOSIT_INCREMENTS,
    );
    const depositAmountInCurrency =
      BigInt(depositAmount) * BigInt(10 ** decimals);

    genericWallet = await world.createWallet({
      address: address,
      balance: 100_000,
      kvs: [e.kvs.Esdts([{ id: currency, amount: depositAmountInCurrency }])],
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
        e.U(ambassadorFee),
        e.Addr(ambassadorAddress),
      ],
      esdts: [{ id: currency, amount: depositAmountInCurrency }],
    });

    await genericWallet
      .callContract({
        callee: raisePoolContract,
        gasLimit: 50_000_000,
        funcName: "userRefund",
        funcArgs: [
          e.U64(TIMESTAMP),
          e.TopBuffer(SIGNATURE_DUMMY),
          e.Str(currency),
        ],
      })
      .assertFail({ code: 10, message: "invalid signature" });
  }
});

test("Refund bob with Currency1 after deposit Currency1, Currency2 with Bob, Currency3 with Carol", async () => {
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
      e.U(PLATFORM_FEE2),
      e.U(GROUP_FEE2),
    ],
    esdts: [{ id: CURRENCY3, amount: CURRENCY3_DEPOSIT_AMOUNT }],
  });

  await bob.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "userRefund",
    funcArgs: [
      e.U64(TIMESTAMP),
      e.TopBuffer(SIGNATURE_DATA_BOB_USER_REFUND_CURRENCY1),
      e.Str(CURRENCY1),
    ],
  });

  const denominated_currency2 =
    BigInt(CURRENCY2_DEPOSIT_AMOUNT) * BigInt(10 ** (18 - DECIMALS2));
  const denominated_currency3 =
    BigInt(CURRENCY3_DEPOSIT_AMOUNT) * BigInt(10 ** (18 - DECIMALS3));
  const total_deposited_amount = denominated_currency2 + denominated_currency3;
  const total_platform_fee =
    (BigInt(CURRENCY1_DEPOSIT_AMOUNT) * BigInt(PLATFORM_FEE1)) /
      BigInt(MAX_PERCENTAGE) +
    (denominated_currency2 * BigInt(PLATFORM_FEE1)) / BigInt(MAX_PERCENTAGE) +
    (denominated_currency3 * BigInt(PLATFORM_FEE2)) / BigInt(MAX_PERCENTAGE);
  const total_group_fee =
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
        .UnorderedSet([e.Str(CURRENCY2)]),
      e.kvs
        .Mapper("deposited_currencies", e.Addr(carol))
        .UnorderedSet([e.Str(CURRENCY3)]),
      e.kvs
        .Mapper("deposited_amount", e.Addr(bob), e.Str(CURRENCY2))
        .Value(e.U(CURRENCY2_DEPOSIT_AMOUNT)),
      e.kvs
        .Mapper("deposited_amount", e.Addr(carol), e.Str(CURRENCY3))
        .Value(e.U(CURRENCY3_DEPOSIT_AMOUNT)),
      e.kvs.Mapper("total_amount").Value(e.U(total_deposited_amount)),
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
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * PLATFORM_FEE1) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("address_platform_fee", e.Addr(bob), e.Str(CURRENCY2))
        .Value(
          e.U((CURRENCY2_DEPOSIT_AMOUNT * PLATFORM_FEE1) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("address_platform_fee", e.Addr(carol), e.Str(CURRENCY3))
        .Value(
          e.U((CURRENCY3_DEPOSIT_AMOUNT * PLATFORM_FEE2) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("platform_fee", e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * PLATFORM_FEE1) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("platform_fee", e.Str(CURRENCY2))
        .Value(
          e.U((CURRENCY2_DEPOSIT_AMOUNT * PLATFORM_FEE1) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("platform_fee", e.Str(CURRENCY3))
        .Value(
          e.U((CURRENCY3_DEPOSIT_AMOUNT * PLATFORM_FEE2) / MAX_PERCENTAGE),
        ),
      e.kvs.Mapper("total_platform_fee").Value(e.U(total_platform_fee)),
      e.kvs
        .Mapper("address_group_fee", e.Addr(bob), e.Str(CURRENCY2))
        .Value(e.U((CURRENCY2_DEPOSIT_AMOUNT * GROUP_FEE1) / MAX_PERCENTAGE)),
      e.kvs
        .Mapper("address_group_fee", e.Addr(carol), e.Str(CURRENCY3))
        .Value(e.U((CURRENCY3_DEPOSIT_AMOUNT * GROUP_FEE2) / MAX_PERCENTAGE)),
      e.kvs
        .Mapper("group_fee", e.Str(CURRENCY2))
        .Value(e.U((CURRENCY2_DEPOSIT_AMOUNT * GROUP_FEE1) / MAX_PERCENTAGE)),
      e.kvs
        .Mapper("group_fee", e.Str(CURRENCY3))
        .Value(e.U((CURRENCY3_DEPOSIT_AMOUNT * GROUP_FEE2) / MAX_PERCENTAGE)),
      e.kvs.Mapper("total_group_fee").Value(e.U(total_group_fee)),
      e.kvs.Mapper("ambassadors").UnorderedSet([e.Addr(deployer)]),
      e.kvs
        .Mapper("address_ambassador_fee", e.Addr(bob), e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("address_ambassador_fee", e.Addr(bob), e.Str(CURRENCY2))
        .Value(
          e.U((CURRENCY2_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("ambassador_fee", e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("ambassador_fee", e.Str(CURRENCY2))
        .Value(
          e.U((CURRENCY2_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("referral_ambassador_fee", e.Addr(deployer), e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("referral_ambassador_fee", e.Addr(deployer), e.Str(CURRENCY2))
        .Value(
          e.U((CURRENCY2_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("ambassador_currencies", e.Addr(deployer))
        .UnorderedSet([e.Str(CURRENCY1), e.Str(CURRENCY2)]),
      e.kvs.Esdts([{ id: CURRENCY2, amount: CURRENCY2_DEPOSIT_AMOUNT }]),
      e.kvs.Esdts([{ id: CURRENCY3, amount: CURRENCY3_DEPOSIT_AMOUNT }]),
      e.kvs.Mapper("owner").Value(e.Addr(deployer)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
    ],
  });

  assertAccount(await world.getAccount(bob), {
    kvs: [e.kvs.Esdts([{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }])],
  });
});

test("Refund bob with Currency1, Currency2 after deposit Currency1, Currency2 with Bob, Currency3 with Carol", async () => {
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
      e.U(PLATFORM_FEE2),
      e.U(GROUP_FEE2),
    ],
    esdts: [{ id: CURRENCY3, amount: CURRENCY3_DEPOSIT_AMOUNT }],
  });

  await bob.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "userRefund",
    funcArgs: [
      e.U64(TIMESTAMP),
      e.TopBuffer(SIGNATURE_DATA_BOB_USER_REFUND_CURRENCY1),
      e.Str(CURRENCY1),
    ],
  });

  await bob.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "userRefund",
    funcArgs: [
      e.U64(TIMESTAMP),
      e.TopBuffer(SIGNATURE_DATA_BOB_USER_REFUND_CURRENCY2),
      e.Str(CURRENCY2),
    ],
  });

  const denominated_currency2 =
    BigInt(CURRENCY2_DEPOSIT_AMOUNT) * BigInt(10 ** (18 - DECIMALS2));
  const denominated_currency3 =
    BigInt(CURRENCY3_DEPOSIT_AMOUNT) * BigInt(10 ** (18 - DECIMALS3));
  const total_deposited_amount = denominated_currency3;
  const total_platform_fee =
    (BigInt(CURRENCY1_DEPOSIT_AMOUNT) * BigInt(PLATFORM_FEE1)) /
      BigInt(MAX_PERCENTAGE) +
    (denominated_currency2 * BigInt(PLATFORM_FEE1)) / BigInt(MAX_PERCENTAGE) +
    (denominated_currency3 * BigInt(PLATFORM_FEE2)) / BigInt(MAX_PERCENTAGE);
  const total_group_fee =
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
        .Mapper("deposited_currencies", e.Addr(carol))
        .UnorderedSet([e.Str(CURRENCY3)]),
      e.kvs
        .Mapper("deposited_amount", e.Addr(carol), e.Str(CURRENCY3))
        .Value(e.U(CURRENCY3_DEPOSIT_AMOUNT)),
      e.kvs.Mapper("total_amount").Value(e.U(total_deposited_amount)),
      e.kvs
        .Mapper("total_amount_currency", e.Str(CURRENCY3))
        .Value(e.U(CURRENCY3_DEPOSIT_AMOUNT)),
      e.kvs
        .Mapper("address_to_ambassador", e.Addr(bob))
        .Value(e.Addr(deployer)),
      e.kvs
        .Mapper("address_platform_fee", e.Addr(bob), e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * PLATFORM_FEE1) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("address_platform_fee", e.Addr(bob), e.Str(CURRENCY2))
        .Value(
          e.U((CURRENCY2_DEPOSIT_AMOUNT * PLATFORM_FEE1) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("address_platform_fee", e.Addr(carol), e.Str(CURRENCY3))
        .Value(
          e.U((CURRENCY3_DEPOSIT_AMOUNT * PLATFORM_FEE2) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("platform_fee", e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * PLATFORM_FEE1) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("platform_fee", e.Str(CURRENCY2))
        .Value(
          e.U((CURRENCY2_DEPOSIT_AMOUNT * PLATFORM_FEE1) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("platform_fee", e.Str(CURRENCY3))
        .Value(
          e.U((CURRENCY3_DEPOSIT_AMOUNT * PLATFORM_FEE2) / MAX_PERCENTAGE),
        ),
      e.kvs.Mapper("total_platform_fee").Value(e.U(total_platform_fee)),
      e.kvs
        .Mapper("address_group_fee", e.Addr(carol), e.Str(CURRENCY3))
        .Value(e.U((CURRENCY3_DEPOSIT_AMOUNT * GROUP_FEE2) / MAX_PERCENTAGE)),
      e.kvs
        .Mapper("group_fee", e.Str(CURRENCY3))
        .Value(e.U((CURRENCY3_DEPOSIT_AMOUNT * GROUP_FEE2) / MAX_PERCENTAGE)),
      e.kvs.Mapper("total_group_fee").Value(e.U(total_group_fee)),
      e.kvs.Mapper("ambassadors").UnorderedSet([e.Addr(deployer)]),
      e.kvs
        .Mapper("address_ambassador_fee", e.Addr(bob), e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("address_ambassador_fee", e.Addr(bob), e.Str(CURRENCY2))
        .Value(
          e.U((CURRENCY2_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("ambassador_fee", e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("ambassador_fee", e.Str(CURRENCY2))
        .Value(
          e.U((CURRENCY2_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("referral_ambassador_fee", e.Addr(deployer), e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("referral_ambassador_fee", e.Addr(deployer), e.Str(CURRENCY2))
        .Value(
          e.U((CURRENCY2_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("ambassador_currencies", e.Addr(deployer))
        .UnorderedSet([e.Str(CURRENCY1), e.Str(CURRENCY2)]),
      e.kvs.Esdts([{ id: CURRENCY3, amount: CURRENCY3_DEPOSIT_AMOUNT }]),
      e.kvs.Mapper("owner").Value(e.Addr(deployer)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
    ],
  });

  assertAccount(await world.getAccount(bob), {
    kvs: [
      e.kvs.Esdts([
        { id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT },
        { id: CURRENCY2, amount: CURRENCY2_DEPOSIT_AMOUNT },
      ]),
    ],
  });
});

test("Refund Carol with Currency3 after deposit Currency1, Currency2 with Bob, Currency3 with Carol", async () => {
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
      e.U(PLATFORM_FEE2),
      e.U(GROUP_FEE2),
    ],
    esdts: [{ id: CURRENCY3, amount: CURRENCY3_DEPOSIT_AMOUNT }],
  });

  await carol.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "userRefund",
    funcArgs: [
      e.U64(TIMESTAMP),
      e.TopBuffer(SIGNATURE_DATA_CAROL_USER_REFUND_CURRENCY3),
      e.Str(CURRENCY3),
    ],
  });

  const denominated_currency2 =
    BigInt(CURRENCY2_DEPOSIT_AMOUNT) * BigInt(10 ** (18 - DECIMALS2));
  const denominated_currency3 =
    BigInt(CURRENCY3_DEPOSIT_AMOUNT) * BigInt(10 ** (18 - DECIMALS3));
  const total_deposited_amount =
    BigInt(CURRENCY1_DEPOSIT_AMOUNT) + denominated_currency2;
  const total_platform_fee =
    (BigInt(CURRENCY1_DEPOSIT_AMOUNT) * BigInt(PLATFORM_FEE1)) /
      BigInt(MAX_PERCENTAGE) +
    (denominated_currency2 * BigInt(PLATFORM_FEE1)) / BigInt(MAX_PERCENTAGE) +
    (denominated_currency3 * BigInt(PLATFORM_FEE2)) / BigInt(MAX_PERCENTAGE);
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
        .Mapper("total_amount_currency", e.Str(CURRENCY2))
        .Value(e.U(CURRENCY2_DEPOSIT_AMOUNT)),
      e.kvs
        .Mapper("address_to_ambassador", e.Addr(bob))
        .Value(e.Addr(deployer)),
      e.kvs
        .Mapper("address_platform_fee", e.Addr(bob), e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * PLATFORM_FEE1) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("address_platform_fee", e.Addr(bob), e.Str(CURRENCY2))
        .Value(
          e.U((CURRENCY2_DEPOSIT_AMOUNT * PLATFORM_FEE1) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("address_platform_fee", e.Addr(carol), e.Str(CURRENCY3))
        .Value(
          e.U((CURRENCY3_DEPOSIT_AMOUNT * PLATFORM_FEE2) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("platform_fee", e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * PLATFORM_FEE1) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("platform_fee", e.Str(CURRENCY2))
        .Value(
          e.U((CURRENCY2_DEPOSIT_AMOUNT * PLATFORM_FEE1) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("platform_fee", e.Str(CURRENCY3))
        .Value(
          e.U((CURRENCY3_DEPOSIT_AMOUNT * PLATFORM_FEE2) / MAX_PERCENTAGE),
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
      e.kvs.Mapper("ambassadors").UnorderedSet([e.Addr(deployer)]),
      e.kvs
        .Mapper("address_ambassador_fee", e.Addr(bob), e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("address_ambassador_fee", e.Addr(bob), e.Str(CURRENCY2))
        .Value(
          e.U((CURRENCY2_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("ambassador_fee", e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("ambassador_fee", e.Str(CURRENCY2))
        .Value(
          e.U((CURRENCY2_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("referral_ambassador_fee", e.Addr(deployer), e.Str(CURRENCY1))
        .Value(
          e.U((CURRENCY1_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("referral_ambassador_fee", e.Addr(deployer), e.Str(CURRENCY2))
        .Value(
          e.U((CURRENCY2_DEPOSIT_AMOUNT * AMBASSADOR_FEE) / MAX_PERCENTAGE),
        ),
      e.kvs
        .Mapper("ambassador_currencies", e.Addr(deployer))
        .UnorderedSet([e.Str(CURRENCY1), e.Str(CURRENCY2)]),
      e.kvs.Esdts([{ id: CURRENCY1, amount: CURRENCY1_DEPOSIT_AMOUNT }]),
      e.kvs.Esdts([{ id: CURRENCY2, amount: CURRENCY2_DEPOSIT_AMOUNT }]),
      e.kvs.Mapper("owner").Value(e.Addr(deployer)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
    ],
  });

  assertAccount(await world.getAccount(carol), {
    kvs: [e.kvs.Esdts([{ id: CURRENCY3, amount: CURRENCY3_DEPOSIT_AMOUNT }])],
  });
});
