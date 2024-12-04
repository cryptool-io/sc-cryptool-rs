import { test, beforeEach, afterEach, expect } from "vitest";
import { BytesLike, e, Encodable } from "xsuite";
import { Kvs } from "xsuite/dist/data/kvs";

import { assertAccount, LSWorld, LSWallet, LSContract } from "xsuite";

import {
  POOL_ID,
  TIMESTAMP,
  SOFT_CAP,
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
  MAX_PERCENTAGE,
  TIMESTAMP_AFTER,
  TIMESTAMP_WITH_DELAY,
  LOW_SOFT_CAP,
  LOW_HARD_CAP,
  HIGH_HARD_CAP,
  HIGH_SOFT_CAP,
  PAYMENT_NETWORK_ID,
  DEPOSIT_ID,
} from "./helpers.ts";

import {
  deployerAddress,
  SIGNATURE_AFTER,
  SIGNATURE_DEPLOYER,
  SIGNATURE_DUMMY,
} from "./signatures/deployer.ts";

import { bobAddress, SIGNATURE_BOB_REFUND } from "./signatures/bob.ts";

import {
  generateDataAndSignature,
  getRandomInt,
  getRandomDeposit,
} from "./generator.ts";

let world: LSWorld;
let deployer: LSWallet;
let bob: LSWallet;
let genericWallet: LSWallet;
let platformWallet: LSWallet;
let groupWallet: LSWallet;
let ambassadorWallet: LSWallet;
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

test("Release with wrong signature", async () => {
  const numberOfDeposits = 1;

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
        e.Str(DEPOSIT_ID),
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
      funcName: "release",
      funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_DUMMY)],
    })
    .assertFail({ code: 10, message: "invalid signature" });
});

test("Release by non owner", async () => {
  const numberOfDeposits = 1;

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
        e.Str(DEPOSIT_ID),
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
      funcName: "release",
      funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_BOB_REFUND)],
    })
    .assertFail({ code: 4, message: "Only owner can call this function" });
});

test("Release with too much delay", async () => {
  const numberOfDeposits = 1;

  await deployer.callContract({
    callee: factoryContract,
    gasLimit: 50_000_000,
    funcName: "deployRaisePool",
    funcArgs: [
      e.Str(POOL_ID),
      e.U64(LOW_HARD_CAP),
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
        e.Str(DEPOSIT_ID),
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
      funcName: "release",
      funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_DEPLOYER)],
    })
    .assertFail({ code: 4, message: "Function call took too long" });
});

test("Enable pool after release", async () => {
  const numberOfDeposits = 1;

  platformWallet = await world.createWallet();
  groupWallet = await world.createWallet();

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
      e.U64(END_DATE),
      e.Addr(platformWallet),
      e.Addr(groupWallet),
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

  const currenciesArray = [CURRENCY1, CURRENCY2, CURRENCY3];
  const currenciesDecimals = [DECIMALS1, DECIMALS2, DECIMALS3];
  var currenciesPlatformFees = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesGroupFees = [BigInt(0), BigInt(0), BigInt(0)];
  var ambassadorWallets: LSWallet[] = [];
  var currencies: string[] = [];
  var depositedAmounts: bigint[] = [];
  var ambassadorFees: bigint[] = [];

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
    const ambassadorFeeAmountInCurrency =
      (BigInt(depositAmountInCurrency) * BigInt(ambassadorFee)) /
      MAX_PERCENTAGE;
    currenciesPlatformFees[currencyRand] +=
      (BigInt(depositAmountInCurrency) * BigInt(platformFee)) / MAX_PERCENTAGE;
    currenciesGroupFees[currencyRand] +=
      (BigInt(depositAmountInCurrency) * BigInt(groupFee)) / MAX_PERCENTAGE;

    genericWallet = await world.createWallet({
      address: address,
      balance: 0,
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
        e.Str(DEPOSIT_ID),
        e.U(ambassadorFee),
        e.Addr(ambassadorAddress),
      ],
      esdts: [{ id: currency, amount: depositAmountInCurrency }],
    });

    ambassadorWallet = await world.createWallet({
      address: ambassadorAddress,
      balance: 0n,
    });

    ambassadorWallets.push(ambassadorWallet);
    depositedAmounts.push(depositAmountInCurrency);
    currencies.push(currency);
    ambassadorFees.push(ambassadorFeeAmountInCurrency);

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
  }

  await world.setCurrentBlockInfo({
    timestamp: TIMESTAMP_AFTER,
  });

  let result = await deployer.callContract({
    callee: raisePoolContract,
    gasLimit: 500_000_000,
    funcName: "release",
    funcArgs: [e.U64(TIMESTAMP_AFTER), e.TopBuffer(SIGNATURE_AFTER)],
  });

  expect(result.returnData[0]).toBe(Buffer.from("completed").toString("hex"));

  assertAccount(await world.getAccount(platformWallet), {
    kvs: [
      e.kvs.Esdts([{ id: CURRENCY1, amount: currenciesPlatformFees[0] }]),
      e.kvs.Esdts([{ id: CURRENCY2, amount: currenciesPlatformFees[1] }]),
      e.kvs.Esdts([{ id: CURRENCY3, amount: currenciesPlatformFees[2] }]),
    ],
  });

  assertAccount(await world.getAccount(groupWallet), {
    kvs: [
      e.kvs.Esdts([{ id: CURRENCY1, amount: currenciesGroupFees[0] }]),
      e.kvs.Esdts([{ id: CURRENCY2, amount: currenciesGroupFees[1] }]),
      e.kvs.Esdts([{ id: CURRENCY3, amount: currenciesGroupFees[2] }]),
    ],
  });

  for (let i = 0; i < numberOfDeposits; i++) {
    assertAccount(await world.getAccount(ambassadorWallets[i]), {
      kvs: [e.kvs.Esdts([{ id: currencies[i], amount: ambassadorFees[i] }])],
    });
    /*
    console.log(
      `Amount sent to Ambassador Id: ${String(i + 1).padStart(2, " ")}`,
    );
    */
  }

  await deployer
    .callContract({
      callee: factoryContract,
      gasLimit: 50_000_000,
      funcName: "enableRaisePool",
      funcArgs: [
        e.U64(TIMESTAMP),
        e.Str(POOL_ID),
        e.TopBuffer(SIGNATURE_DEPLOYER),
        e.Bool(true),
      ],
    })
    .assertFail({
      code: 10,
      message: "error signalled by smartcontract",
    });
}, 200000);

test("Release in 1 call no overcommitment", async () => {
  const numberOfDeposits = 140;

  platformWallet = await world.createWallet();
  groupWallet = await world.createWallet();

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
      e.U64(END_DATE),
      e.Addr(platformWallet),
      e.Addr(groupWallet),
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

  var totalAmount: bigint = BigInt(0);
  var platformFeeAmount: bigint = BigInt(0);
  var platformFeeAmountInCurrency: bigint = BigInt(0);
  var groupFeeAmount: bigint = BigInt(0);
  var groupFeeAmountInCurrency: bigint = BigInt(0);
  var ambassadorFeeAmount: bigint = BigInt(0);

  const currenciesArray = [CURRENCY1, CURRENCY2, CURRENCY3];
  const currenciesDecimals = [DECIMALS1, DECIMALS2, DECIMALS3];
  var currenciesTotal = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesPlatformFees = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesGroupFees = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesAmbassadorFees = [BigInt(0), BigInt(0), BigInt(0)];
  var ambassadorWallets: LSWallet[] = [];
  var currencies: string[] = [];
  var ambassadorFees: bigint[] = [];

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

    genericWallet = await world.createWallet({
      address: address,
      balance: 0,
      kvs: [
        e.kvs.Esdts([
          {
            id: currency,
            amount: BigInt(depositAmount) * BigInt(10 ** decimals),
          },
        ]),
      ],
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
        e.Addr(ambassadorAddress),
      ],
      esdts: [
        {
          id: currency,
          amount: BigInt(depositAmount) * BigInt(10 ** decimals),
        },
      ],
    });

    ambassadorWallet = await world.createWallet({
      address: ambassadorAddress,
      balance: 0n,
    });

    const depositAmountInCurrency =
      BigInt(depositAmount) * BigInt(10 ** decimals);
    const depositAmountDenominated = BigInt(depositAmount) * BigInt(10 ** 18);

    platformFeeAmountInCurrency =
      (BigInt(depositAmountInCurrency) * BigInt(platformFee)) / MAX_PERCENTAGE;
    groupFeeAmountInCurrency =
      (BigInt(depositAmountInCurrency) * BigInt(groupFee)) / MAX_PERCENTAGE;
    const ambassadorFeeAmountInCurrency =
      (depositAmountInCurrency * BigInt(ambassadorFee)) / MAX_PERCENTAGE;

    currenciesPlatformFees[currencyRand] +=
      (depositAmountInCurrency * BigInt(platformFee)) / MAX_PERCENTAGE;
    platformFeeAmount =
      (depositAmountDenominated * BigInt(platformFee)) / MAX_PERCENTAGE;
    currenciesGroupFees[currencyRand] +=
      (depositAmountInCurrency * BigInt(groupFee)) / MAX_PERCENTAGE;
    groupFeeAmount =
      (depositAmountDenominated * BigInt(groupFee)) / MAX_PERCENTAGE;
    ambassadorFeeAmount =
      (depositAmountDenominated * BigInt(ambassadorFee)) / MAX_PERCENTAGE;

    currenciesAmbassadorFees[currencyRand] =
      currenciesAmbassadorFees[currencyRand] +
      ambassadorFeeAmountInCurrency -
      platformFeeAmountInCurrency -
      groupFeeAmountInCurrency -
      ambassadorFeeAmountInCurrency;

    ambassadorWallets.push(ambassadorWallet);
    currencies.push(currency);
    ambassadorFees.push(ambassadorFeeAmountInCurrency);

    currenciesTotal[currencyRand] =
      currenciesTotal[currencyRand] +
      depositAmountInCurrency -
      platformFeeAmountInCurrency -
      groupFeeAmountInCurrency -
      ambassadorFeeAmountInCurrency;

    totalAmount =
      totalAmount +
      depositAmountDenominated -
      platformFeeAmount -
      groupFeeAmount -
      ambassadorFeeAmount;

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
  }

  await world.setCurrentBlockInfo({
    timestamp: TIMESTAMP_AFTER,
  });

  let result = await deployer.callContract({
    callee: raisePoolContract,
    gasLimit: 500_000_000,
    funcName: "release",
    funcArgs: [e.U64(TIMESTAMP_AFTER), e.TopBuffer(SIGNATURE_AFTER)],
  });

  expect(result.returnData[0]).toBe(Buffer.from("completed").toString("hex"));

  assertAccount(await world.getAccount(platformWallet), {
    kvs: [
      e.kvs.Esdts([{ id: CURRENCY1, amount: currenciesPlatformFees[0] }]),
      e.kvs.Esdts([{ id: CURRENCY2, amount: currenciesPlatformFees[1] }]),
      e.kvs.Esdts([{ id: CURRENCY3, amount: currenciesPlatformFees[2] }]),
    ],
  });

  assertAccount(await world.getAccount(groupWallet), {
    kvs: [
      e.kvs.Esdts([{ id: CURRENCY1, amount: currenciesGroupFees[0] }]),
      e.kvs.Esdts([{ id: CURRENCY2, amount: currenciesGroupFees[1] }]),
      e.kvs.Esdts([{ id: CURRENCY3, amount: currenciesGroupFees[2] }]),
    ],
  });

  for (let i = 0; i < numberOfDeposits; i++) {
    assertAccount(await world.getAccount(ambassadorWallets[i]), {
      kvs: [e.kvs.Esdts([{ id: currencies[i], amount: ambassadorFees[i] }])],
    });
    /*
    console.log(
      `Amount sent to Ambassador Id: ${String(i + 1).padStart(2, " ")}`,
    );
    */
  }

  assertAccount(await raisePoolContract.getAccount(), {
    balance: 0n,
    hasKvs: [
      e.kvs.Mapper("total_amount").Value(e.U(totalAmount)),
      e.kvs.Esdts([{ id: CURRENCY1, amount: currenciesTotal[0] }]),
      e.kvs.Esdts([{ id: CURRENCY2, amount: currenciesTotal[1] }]),
      e.kvs.Esdts([{ id: CURRENCY3, amount: currenciesTotal[2] }]),
    ],
  });
}, 200000);

test("Release in 2 calls no overcommitment", async () => {
  const numberOfDeposits = 200;

  platformWallet = await world.createWallet();
  groupWallet = await world.createWallet();

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
      e.U64(END_DATE),
      e.Addr(platformWallet),
      e.Addr(groupWallet),
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

  var totalAmount: bigint = BigInt(0);
  var platformFeeAmount: bigint = BigInt(0);
  var platformFeeAmountInCurrency: bigint = BigInt(0);
  var groupFeeAmount: bigint = BigInt(0);
  var groupFeeAmountInCurrency: bigint = BigInt(0);
  var ambassadorFeeAmount: bigint = BigInt(0);

  const currenciesArray = [CURRENCY1, CURRENCY2, CURRENCY3];
  const currenciesDecimals = [DECIMALS1, DECIMALS2, DECIMALS3];
  var currenciesTotal = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesPlatformFees = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesGroupFees = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesAmbassadorFees = [BigInt(0), BigInt(0), BigInt(0)];
  var ambassadorWallets: LSWallet[] = [];
  var currencies: string[] = [];
  var ambassadorFees: bigint[] = [];

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

    genericWallet = await world.createWallet({
      address: address,
      balance: 0,
      kvs: [
        e.kvs.Esdts([
          {
            id: currency,
            amount: BigInt(depositAmount) * BigInt(10 ** decimals),
          },
        ]),
      ],
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
        e.Addr(ambassadorAddress),
      ],
      esdts: [
        {
          id: currency,
          amount: BigInt(depositAmount) * BigInt(10 ** decimals),
        },
      ],
    });

    ambassadorWallet = await world.createWallet({
      address: ambassadorAddress,
      balance: 0n,
    });

    const depositAmountInCurrency =
      BigInt(depositAmount) * BigInt(10 ** decimals);
    const depositAmountDenominated = BigInt(depositAmount) * BigInt(10 ** 18);

    platformFeeAmountInCurrency =
      (BigInt(depositAmountInCurrency) * BigInt(platformFee)) / MAX_PERCENTAGE;
    groupFeeAmountInCurrency =
      (BigInt(depositAmountInCurrency) * BigInt(groupFee)) / MAX_PERCENTAGE;
    const ambassadorFeeAmountInCurrency =
      (depositAmountInCurrency * BigInt(ambassadorFee)) / MAX_PERCENTAGE;

    currenciesPlatformFees[currencyRand] +=
      (depositAmountInCurrency * BigInt(platformFee)) / MAX_PERCENTAGE;
    platformFeeAmount =
      (depositAmountDenominated * BigInt(platformFee)) / MAX_PERCENTAGE;
    currenciesGroupFees[currencyRand] +=
      (depositAmountInCurrency * BigInt(groupFee)) / MAX_PERCENTAGE;
    groupFeeAmount =
      (depositAmountDenominated * BigInt(groupFee)) / MAX_PERCENTAGE;
    ambassadorFeeAmount =
      (depositAmountDenominated * BigInt(ambassadorFee)) / MAX_PERCENTAGE;

    currenciesAmbassadorFees[currencyRand] =
      currenciesAmbassadorFees[currencyRand] +
      ambassadorFeeAmountInCurrency -
      platformFeeAmountInCurrency -
      groupFeeAmountInCurrency -
      ambassadorFeeAmountInCurrency;

    ambassadorWallets.push(ambassadorWallet);
    currencies.push(currency);
    ambassadorFees.push(ambassadorFeeAmountInCurrency);

    currenciesTotal[currencyRand] =
      currenciesTotal[currencyRand] +
      depositAmountInCurrency -
      platformFeeAmountInCurrency -
      groupFeeAmountInCurrency -
      ambassadorFeeAmountInCurrency;

    totalAmount =
      totalAmount +
      depositAmountDenominated -
      platformFeeAmount -
      groupFeeAmount -
      ambassadorFeeAmount;

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
  }

  await world.setCurrentBlockInfo({
    timestamp: TIMESTAMP_AFTER,
  });

  let result = await deployer.callContract({
    callee: raisePoolContract,
    gasLimit: 500_000_000,
    funcName: "release",
    funcArgs: [e.U64(TIMESTAMP_AFTER), e.TopBuffer(SIGNATURE_AFTER)],
  });

  expect(result.returnData[0]).toBe(Buffer.from("interrupted").toString("hex"));

  let result2 = await deployer.callContract({
    callee: raisePoolContract,
    gasLimit: 500_000_000,
    funcName: "release",
    funcArgs: [e.U64(TIMESTAMP_AFTER), e.TopBuffer(SIGNATURE_AFTER)],
  });

  expect(result2.returnData[0]).toBe(Buffer.from("completed").toString("hex"));

  assertAccount(await world.getAccount(platformWallet), {
    kvs: [
      e.kvs.Esdts([{ id: CURRENCY1, amount: currenciesPlatformFees[0] }]),
      e.kvs.Esdts([{ id: CURRENCY2, amount: currenciesPlatformFees[1] }]),
      e.kvs.Esdts([{ id: CURRENCY3, amount: currenciesPlatformFees[2] }]),
    ],
  });

  assertAccount(await world.getAccount(groupWallet), {
    kvs: [
      e.kvs.Esdts([{ id: CURRENCY1, amount: currenciesGroupFees[0] }]),
      e.kvs.Esdts([{ id: CURRENCY2, amount: currenciesGroupFees[1] }]),
      e.kvs.Esdts([{ id: CURRENCY3, amount: currenciesGroupFees[2] }]),
    ],
  });

  for (let i = 0; i < numberOfDeposits; i++) {
    assertAccount(await world.getAccount(ambassadorWallets[i]), {
      kvs: [e.kvs.Esdts([{ id: currencies[i], amount: ambassadorFees[i] }])],
    });
    /*
    console.log(
      `Amount sent to Ambassador Id: ${String(i + 1).padStart(2, " ")}`,
    );
    */
  }

  assertAccount(await raisePoolContract.getAccount(), {
    balance: 0n,
    hasKvs: [
      e.kvs.Mapper("total_amount").Value(e.U(totalAmount)),
      e.kvs.Esdts([{ id: CURRENCY1, amount: currenciesTotal[0] }]),
      e.kvs.Esdts([{ id: CURRENCY2, amount: currenciesTotal[1] }]),
      e.kvs.Esdts([{ id: CURRENCY3, amount: currenciesTotal[2] }]),
    ],
  });
}, 200000);

test("Release in 1 call with N overcommitment", async () => {
  const numberOfDeposits = 160;
  const refundLast = 40;

  platformWallet = await world.createWallet();
  groupWallet = await world.createWallet();

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
      e.U64(END_DATE),
      e.Addr(platformWallet),
      e.Addr(groupWallet),
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

  var totalAmount: bigint = BigInt(0);
  var platformFeeAmount: bigint = BigInt(0);
  var platformFeeAmountInCurrency: bigint = BigInt(0);
  var groupFeeAmount: bigint = BigInt(0);
  var groupFeeAmountInCurrency: bigint = BigInt(0);
  var ambassadorFeeAmount: bigint = BigInt(0);

  const currenciesArray = [CURRENCY1, CURRENCY2, CURRENCY3];
  const currenciesDecimals = [DECIMALS1, DECIMALS2, DECIMALS3];
  var currenciesTotal = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesPlatformFees = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesGroupFees = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesAmbassadorFees = [BigInt(0), BigInt(0), BigInt(0)];
  var ambassadorWallets: LSWallet[] = [];
  var currencies: string[] = [];
  var ambassadorFees: bigint[] = [];
  var refundAddresses: Encodable[] = [];

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

    genericWallet = await world.createWallet({
      address: address,
      balance: 0,
      kvs: [
        e.kvs.Esdts([
          {
            id: currency,
            amount: BigInt(depositAmount) * BigInt(10 ** decimals),
          },
        ]),
      ],
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
        e.Addr(ambassadorAddress),
      ],
      esdts: [
        {
          id: currency,
          amount: BigInt(depositAmount) * BigInt(10 ** decimals),
        },
      ],
    });

    ambassadorWallet = await world.createWallet({
      address: ambassadorAddress,
      balance: 0n,
    });

    if (i < numberOfDeposits - refundLast) {
      const depositAmountInCurrency =
        BigInt(depositAmount) * BigInt(10 ** decimals);
      const depositAmountDenominated = BigInt(depositAmount) * BigInt(10 ** 18);

      platformFeeAmountInCurrency =
        (BigInt(depositAmountInCurrency) * BigInt(platformFee)) /
        MAX_PERCENTAGE;
      groupFeeAmountInCurrency =
        (BigInt(depositAmountInCurrency) * BigInt(groupFee)) / MAX_PERCENTAGE;
      const ambassadorFeeAmountInCurrency =
        (depositAmountInCurrency * BigInt(ambassadorFee)) / MAX_PERCENTAGE;

      currenciesPlatformFees[currencyRand] +=
        (depositAmountInCurrency * BigInt(platformFee)) / MAX_PERCENTAGE;
      platformFeeAmount =
        (depositAmountDenominated * BigInt(platformFee)) / MAX_PERCENTAGE;
      currenciesGroupFees[currencyRand] +=
        (depositAmountInCurrency * BigInt(groupFee)) / MAX_PERCENTAGE;
      groupFeeAmount =
        (depositAmountDenominated * BigInt(groupFee)) / MAX_PERCENTAGE;
      ambassadorFeeAmount =
        (depositAmountDenominated * BigInt(ambassadorFee)) / MAX_PERCENTAGE;

      currenciesAmbassadorFees[currencyRand] =
        currenciesAmbassadorFees[currencyRand] +
        ambassadorFeeAmountInCurrency -
        platformFeeAmountInCurrency -
        groupFeeAmountInCurrency -
        ambassadorFeeAmountInCurrency;

      ambassadorWallets.push(ambassadorWallet);
      currencies.push(currency);
      ambassadorFees.push(ambassadorFeeAmountInCurrency);

      currenciesTotal[currencyRand] =
        currenciesTotal[currencyRand] +
        depositAmountInCurrency -
        platformFeeAmountInCurrency -
        groupFeeAmountInCurrency -
        ambassadorFeeAmountInCurrency;

      totalAmount =
        totalAmount +
        depositAmountDenominated -
        platformFeeAmount -
        groupFeeAmount -
        ambassadorFeeAmount;
    } else {
      refundAddresses.push(e.Addr(address));
    }

    // console.log(
    //   `Id: ${String(i + 1).padStart(2, " ")} | Deposit ${String(
    //     depositAmount,
    //   ).padStart(3, " ")} ${currency.padEnd(3, " ")}, platformFee ${String(
    //     platformFee,
    //   ).padStart(3, " ")}, groupFee ${String(groupFee).padStart(
    //     3,
    //     " ",
    //   )}, ambassadorFee ${String(ambassadorFee).padStart(3, " ")}`,
    // );
  }

  await world.setCurrentBlockInfo({
    timestamp: TIMESTAMP_AFTER,
  });

  let result = await deployer.callContract({
    callee: raisePoolContract,
    gasLimit: 500_000_000,
    funcName: "release",
    funcArgs: [
      e.U64(TIMESTAMP_AFTER),
      e.TopBuffer(SIGNATURE_AFTER),
      ...refundAddresses,
    ],
  });

  expect(result.returnData[0]).toBe(Buffer.from("completed").toString("hex"));

  assertAccount(await world.getAccount(platformWallet), {
    kvs: [
      e.kvs.Esdts([{ id: CURRENCY1, amount: currenciesPlatformFees[0] }]),
      e.kvs.Esdts([{ id: CURRENCY2, amount: currenciesPlatformFees[1] }]),
      e.kvs.Esdts([{ id: CURRENCY3, amount: currenciesPlatformFees[2] }]),
    ],
  });

  assertAccount(await world.getAccount(groupWallet), {
    kvs: [
      e.kvs.Esdts([{ id: CURRENCY1, amount: currenciesGroupFees[0] }]),
      e.kvs.Esdts([{ id: CURRENCY2, amount: currenciesGroupFees[1] }]),
      e.kvs.Esdts([{ id: CURRENCY3, amount: currenciesGroupFees[2] }]),
    ],
  });

  for (let i = 0; i < numberOfDeposits - refundLast; i++) {
    assertAccount(await world.getAccount(ambassadorWallets[i]), {
      kvs: [e.kvs.Esdts([{ id: currencies[i], amount: ambassadorFees[i] }])],
    });
  }

  assertAccount(await raisePoolContract.getAccount(), {
    balance: 0n,
    hasKvs: [
      e.kvs.Mapper("total_amount").Value(e.U(totalAmount)),
      e.kvs.Esdts([{ id: CURRENCY1, amount: currenciesTotal[0] }]),
      e.kvs.Esdts([{ id: CURRENCY2, amount: currenciesTotal[1] }]),
      e.kvs.Esdts([{ id: CURRENCY3, amount: currenciesTotal[2] }]),
    ],
  });
}, 200000);

test("Release in 2 calls with N overcommitment", async () => {
  const numberOfDeposits = 250;
  const refundLast = 150;

  platformWallet = await world.createWallet();
  groupWallet = await world.createWallet();

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
      e.U64(END_DATE),
      e.Addr(platformWallet),
      e.Addr(groupWallet),
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

  var totalAmount: bigint = BigInt(0);
  var platformFeeAmount: bigint = BigInt(0);
  var platformFeeAmountInCurrency: bigint = BigInt(0);
  var groupFeeAmount: bigint = BigInt(0);
  var groupFeeAmountInCurrency: bigint = BigInt(0);
  var ambassadorFeeAmount: bigint = BigInt(0);

  const currenciesArray = [CURRENCY1, CURRENCY2, CURRENCY3];
  const currenciesDecimals = [DECIMALS1, DECIMALS2, DECIMALS3];
  var currenciesTotal = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesPlatformFees = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesGroupFees = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesAmbassadorFees = [BigInt(0), BigInt(0), BigInt(0)];
  var ambassadorWallets: LSWallet[] = [];
  var currencies: string[] = [];
  var ambassadorFees: bigint[] = [];
  var refundAddresses: Encodable[] = [];

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

    genericWallet = await world.createWallet({
      address: address,
      balance: 0,
      kvs: [
        e.kvs.Esdts([
          {
            id: currency,
            amount: BigInt(depositAmount) * BigInt(10 ** decimals),
          },
        ]),
      ],
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
        e.Addr(ambassadorAddress),
      ],
      esdts: [
        {
          id: currency,
          amount: BigInt(depositAmount) * BigInt(10 ** decimals),
        },
      ],
    });

    ambassadorWallet = await world.createWallet({
      address: ambassadorAddress,
      balance: 0n,
    });

    if (i < numberOfDeposits - refundLast) {
      const depositAmountInCurrency =
        BigInt(depositAmount) * BigInt(10 ** decimals);
      const depositAmountDenominated = BigInt(depositAmount) * BigInt(10 ** 18);

      platformFeeAmountInCurrency =
        (BigInt(depositAmountInCurrency) * BigInt(platformFee)) /
        MAX_PERCENTAGE;
      groupFeeAmountInCurrency =
        (BigInt(depositAmountInCurrency) * BigInt(groupFee)) / MAX_PERCENTAGE;
      const ambassadorFeeAmountInCurrency =
        (depositAmountInCurrency * BigInt(ambassadorFee)) / MAX_PERCENTAGE;

      currenciesPlatformFees[currencyRand] +=
        (depositAmountInCurrency * BigInt(platformFee)) / MAX_PERCENTAGE;
      platformFeeAmount =
        (depositAmountDenominated * BigInt(platformFee)) / MAX_PERCENTAGE;
      currenciesGroupFees[currencyRand] +=
        (depositAmountInCurrency * BigInt(groupFee)) / MAX_PERCENTAGE;
      groupFeeAmount =
        (depositAmountDenominated * BigInt(groupFee)) / MAX_PERCENTAGE;
      ambassadorFeeAmount =
        (depositAmountDenominated * BigInt(ambassadorFee)) / MAX_PERCENTAGE;

      currenciesAmbassadorFees[currencyRand] =
        currenciesAmbassadorFees[currencyRand] +
        ambassadorFeeAmountInCurrency -
        platformFeeAmountInCurrency -
        groupFeeAmountInCurrency -
        ambassadorFeeAmountInCurrency;

      ambassadorWallets.push(ambassadorWallet);
      currencies.push(currency);
      ambassadorFees.push(ambassadorFeeAmountInCurrency);

      currenciesTotal[currencyRand] =
        currenciesTotal[currencyRand] +
        depositAmountInCurrency -
        platformFeeAmountInCurrency -
        groupFeeAmountInCurrency -
        ambassadorFeeAmountInCurrency;

      totalAmount =
        totalAmount +
        depositAmountDenominated -
        platformFeeAmount -
        groupFeeAmount -
        ambassadorFeeAmount;
    } else {
      refundAddresses.push(e.Addr(address));
    }

    // console.log(
    //   `Id: ${String(i + 1).padStart(2, " ")} | Deposit ${String(
    //     depositAmount,
    //   ).padStart(3, " ")} ${currency.padEnd(3, " ")}, platformFee ${String(
    //     platformFee,
    //   ).padStart(3, " ")}, groupFee ${String(groupFee).padStart(
    //     3,
    //     " ",
    //   )}, ambassadorFee ${String(ambassadorFee).padStart(3, " ")}`,
    // );
  }

  await world.setCurrentBlockInfo({
    timestamp: TIMESTAMP_AFTER,
  });

  let result = await deployer.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000_000,
    funcName: "release",
    funcArgs: [
      e.U64(TIMESTAMP_AFTER),
      e.TopBuffer(SIGNATURE_AFTER),
      ...refundAddresses,
    ],
  });

  expect(result.returnData[0]).toBe(Buffer.from("interrupted").toString("hex"));

  let result2 = await deployer.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000_000,
    funcName: "release",
    funcArgs: [
      e.U64(TIMESTAMP_AFTER),
      e.TopBuffer(SIGNATURE_AFTER),
      ...refundAddresses,
    ],
  });

  expect(result2.returnData[0]).toBe(Buffer.from("completed").toString("hex"));

  assertAccount(await world.getAccount(platformWallet), {
    kvs: [
      e.kvs.Esdts([{ id: CURRENCY1, amount: currenciesPlatformFees[0] }]),
      e.kvs.Esdts([{ id: CURRENCY2, amount: currenciesPlatformFees[1] }]),
      e.kvs.Esdts([{ id: CURRENCY3, amount: currenciesPlatformFees[2] }]),
    ],
  });

  assertAccount(await world.getAccount(groupWallet), {
    kvs: [
      e.kvs.Esdts([{ id: CURRENCY1, amount: currenciesGroupFees[0] }]),
      e.kvs.Esdts([{ id: CURRENCY2, amount: currenciesGroupFees[1] }]),
      e.kvs.Esdts([{ id: CURRENCY3, amount: currenciesGroupFees[2] }]),
    ],
  });

  for (let i = 0; i < numberOfDeposits - refundLast; i++) {
    assertAccount(await world.getAccount(ambassadorWallets[i]), {
      kvs: [e.kvs.Esdts([{ id: currencies[i], amount: ambassadorFees[i] }])],
    });
  }

  assertAccount(await raisePoolContract.getAccount(), {
    balance: 0n,
    hasKvs: [
      e.kvs.Mapper("total_amount").Value(e.U(totalAmount)),
      e.kvs.Esdts([{ id: CURRENCY1, amount: currenciesTotal[0] }]),
      e.kvs.Esdts([{ id: CURRENCY2, amount: currenciesTotal[1] }]),
      e.kvs.Esdts([{ id: CURRENCY3, amount: currenciesTotal[2] }]),
    ],
  });
}, 200000);
