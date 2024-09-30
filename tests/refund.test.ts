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
  DEPOSIT_TIMESTAMP,
  HIGH_HARD_CAP,
  TIMESTAMP_WITH_DELAY,
  REFUND_NOT_ENABLED,
  LOW_SOFT_CAP,
  TIMESTAMP_AFTER,
} from "./helpers.ts";

import { bobAddress, SIGNATURE_BOB_REFUND } from "./signatures/bob.ts";

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

test("Refund with wrong signature", async () => {
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
  }

  await deployer
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "refund",
      funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_DUMMY)],
    })
    .assertFail({ code: 10, message: "invalid signature" });
});

test("Refund by non owner", async () => {
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
  }

  bob = await world.createWallet({
    address: bobAddress,
    balance: 100_000,
  });

  await bob
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "refund",
      funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_BOB_REFUND)],
    })
    .assertFail({ code: 4, message: "Only owner can call this function" });
});

test("Refund with too much delay", async () => {
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
  }

  await world.setCurrentBlockInfo({
    timestamp: TIMESTAMP_WITH_DELAY,
  });

  await deployer
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "refund",
      funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_DEPLOYER)],
    })
    .assertFail({ code: 4, message: "Function call took too long" });
});

test("Refund while refunds not enabled", async () => {
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
      e.U64(REFUND_NOT_ENABLED),
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
  }

  await deployer
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "refund",
      funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_DEPLOYER)],
    })
    .assertFail({ code: 4, message: "Refunds are not enabled" });
});

test("Refund while refunds not open", async () => {
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
  }

  await deployer
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "refund",
      funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_DEPLOYER)],
    })
    .assertFail({ code: 4, message: "Refunds are not open" });
});

test("Refund after soft cap exceeded", async () => {
  const numberOfDeposits = 3;

  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.Str(POOL_ID),
      e.U64(LOW_SOFT_CAP),
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
  }

  await world.setCurrentBlockInfo({
    timestamp: TIMESTAMP_AFTER,
  });

  await deployer
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "refund",
      funcArgs: [e.U64(TIMESTAMP_AFTER), e.TopBuffer(SIGNATURE_AFTER)],
    })
    .assertFail({ code: 4, message: "Soft cap exceeded" });
});

test("Refund in 1 call", async () => {
  const numberOfDeposits = 140;

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

  await world.setCurrentBlockInfo({
    timestamp: DEPOSIT_TIMESTAMP,
  });

  const currenciesArray = [CURRENCY1, CURRENCY2, CURRENCY3];
  const currenciesDecimals = [DECIMALS1, DECIMALS2, DECIMALS3];
  var wallets: Encodable[] = [];
  var currencies: string[] = [];
  var depositedAmounts: bigint[] = [];

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

    wallets.push(genericWallet);
    depositedAmounts.push(depositAmountInCurrency);
    currencies.push(currency);

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
  }

  await world.setCurrentBlockInfo({
    timestamp: TIMESTAMP_AFTER,
  });

  let state = await deployer.callContract({
    callee: raisePoolContract,
    gasLimit: 500_000_000,
    funcName: "refund",
    funcArgs: [e.U64(TIMESTAMP_AFTER), e.TopBuffer(SIGNATURE_AFTER)],
  });

  expect(state.returnData[0]).toBe(Buffer.from("completed").toString("hex"));

  for (let i = 0; i < numberOfDeposits; i++) {
    assertAccount(await await world.getAccount(wallets[i]), {
      kvs: [e.kvs.Esdts([{ id: currencies[i], amount: depositedAmounts[i] }])],
    });
    console.log(`Returned amount to Id: ${String(i + 1).padStart(2, " ")}`);
  }
}, 200000);

test("Refund in 2 calls", async () => {
  const numberOfDeposits = 200;

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

  await world.setCurrentBlockInfo({
    timestamp: DEPOSIT_TIMESTAMP,
  });

  const currenciesArray = [CURRENCY1, CURRENCY2, CURRENCY3];
  const currenciesDecimals = [DECIMALS1, DECIMALS2, DECIMALS3];
  var wallets: Encodable[] = [];
  var currencies: string[] = [];
  var depositedAmounts: bigint[] = [];

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

    wallets.push(genericWallet);
    depositedAmounts.push(depositAmountInCurrency);
    currencies.push(currency);

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
  }

  await world.setCurrentBlockInfo({
    timestamp: TIMESTAMP_AFTER,
  });

  let state1 = await deployer.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "refund",
    funcArgs: [e.U64(TIMESTAMP_AFTER), e.TopBuffer(SIGNATURE_AFTER)],
  });

  expect(state1.returnData[0]).toBe(Buffer.from("interrupted").toString("hex"));

  let state2 = await deployer.callContract({
    callee: raisePoolContract,
    gasLimit: 500_000_000,
    funcName: "refund",
    funcArgs: [e.U64(TIMESTAMP_AFTER), e.TopBuffer(SIGNATURE_AFTER)],
  });

  expect(state2.returnData[0]).toBe(Buffer.from("completed").toString("hex"));

  for (let i = 0; i < numberOfDeposits; i++) {
    assertAccount(await await world.getAccount(wallets[i]), {
      kvs: [e.kvs.Esdts([{ id: currencies[i], amount: depositedAmounts[i] }])],
    });
    console.log(`Returned amount to Id: ${String(i + 1).padStart(2, " ")}`);
  }
}, 200000);

test("Refund with not enough gas", async () => {
  const numberOfDeposits = 5;

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

  await world.setCurrentBlockInfo({
    timestamp: DEPOSIT_TIMESTAMP,
  });

  const currenciesArray = [CURRENCY1, CURRENCY2, CURRENCY3];
  const currenciesDecimals = [DECIMALS1, DECIMALS2, DECIMALS3];
  var wallets: Encodable[] = [];
  var currencies: string[] = [];
  var depositedAmounts: bigint[] = [];

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

    wallets.push(genericWallet);
    depositedAmounts.push(depositAmountInCurrency);
    currencies.push(currency);
  }

  await world.setCurrentBlockInfo({
    timestamp: TIMESTAMP_AFTER,
  });

  await deployer
    .callContract({
      callee: raisePoolContract,
      gasLimit: 5_000_000,
      funcName: "refund",
      funcArgs: [e.U64(TIMESTAMP_AFTER), e.TopBuffer(SIGNATURE_AFTER)],
    })
    .assertFail({ code: 5, message: "not enough gas" });
}, 20000);
