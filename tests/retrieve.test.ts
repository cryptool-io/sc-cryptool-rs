import { test, beforeEach, afterEach, expect } from "vitest";
import { BytesLike, e } from "xsuite";

import { assertAccount, LSWorld, LSWallet, LSContract } from "xsuite";

import {
  POOL_ID,
  TIMESTAMP,
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
  TIMESTAMP_AFTER,
  LOW_SOFT_CAP,
  HIGH_HARD_CAP,
  DEPOSIT_ID,
  PAYMENT_NETWORK_ID,
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

test("Retrieve with wrong signature", async () => {
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

  await world.setCurrentBlockInfo({
    timestamp: DEPOSIT_TIMESTAMP,
  });

  const currenciesArray = [CURRENCY1, CURRENCY2, CURRENCY3];
  const currenciesDecimals = [DECIMALS1, DECIMALS2, DECIMALS3];

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
      ambassadorAddress,
    } = generateDataAndSignature(1, depositAmount);

    genericWallet = await world.createWallet({
      address: address,
      balance: 0,
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
        e.Addr(ambassadorAddress),
      ],
      esdts: [{ id: currency, amount: depositAmount }],
    });

    ambassadorWallet = await world.createWallet({
      address: ambassadorAddress,
      balance: 0n,
    });
  }

  await world.setCurrentBlockInfo({
    timestamp: TIMESTAMP_AFTER,
  });

  await deployer.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "release",
    funcArgs: [e.U64(TIMESTAMP_AFTER), e.TopBuffer(SIGNATURE_AFTER)],
  });

  await deployer
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "retrieve",
      funcArgs: [e.U64(TIMESTAMP_AFTER), e.TopBuffer(SIGNATURE_DUMMY)],
    })
    .assertFail({ code: 10, message: "invalid signature" });
});

test("Retrieve by non owner", async () => {
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

  await world.setCurrentBlockInfo({
    timestamp: DEPOSIT_TIMESTAMP,
  });

  const currenciesArray = [CURRENCY1, CURRENCY2, CURRENCY3];
  const currenciesDecimals = [DECIMALS1, DECIMALS2, DECIMALS3];

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
      ambassadorAddress,
    } = generateDataAndSignature(1, depositAmount);

    genericWallet = await world.createWallet({
      address: address,
      balance: 0,
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
        e.Addr(ambassadorAddress),
      ],
      esdts: [{ id: currency, amount: depositAmount }],
    });

    ambassadorWallet = await world.createWallet({
      address: ambassadorAddress,
      balance: 0n,
    });
  }

  await world.setCurrentBlockInfo({
    timestamp: TIMESTAMP_AFTER,
  });

  await deployer.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "release",
    funcArgs: [e.U64(TIMESTAMP_AFTER), e.TopBuffer(SIGNATURE_AFTER)],
  });

  bob = await world.createWallet({ address: bobAddress });

  await bob
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "retrieve",
      funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_BOB_REFUND)],
    })
    .assertFail({ code: 4, message: "Only owner can call this function" });
});

test("Retrieve with too much delay", async () => {
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

  await world.setCurrentBlockInfo({
    timestamp: DEPOSIT_TIMESTAMP,
  });

  const currenciesArray = [CURRENCY1, CURRENCY2, CURRENCY3];
  const currenciesDecimals = [DECIMALS1, DECIMALS2, DECIMALS3];

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
      ambassadorAddress,
    } = generateDataAndSignature(1, depositAmount);

    genericWallet = await world.createWallet({
      address: address,
      balance: 0,
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
        e.Addr(ambassadorAddress),
      ],
      esdts: [{ id: currency, amount: depositAmount }],
    });

    ambassadorWallet = await world.createWallet({
      address: ambassadorAddress,
      balance: 0n,
    });
  }

  await world.setCurrentBlockInfo({
    timestamp: TIMESTAMP_AFTER,
  });

  await deployer.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "release",
    funcArgs: [e.U64(TIMESTAMP_AFTER), e.TopBuffer(SIGNATURE_AFTER)],
  });

  await deployer
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "retrieve",
      funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_DEPLOYER)],
    })
    .assertFail({ code: 4, message: "Function call took too long" });
});

test("Retrieve before release", async () => {
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

  await world.setCurrentBlockInfo({
    timestamp: DEPOSIT_TIMESTAMP,
  });

  const currenciesArray = [CURRENCY1, CURRENCY2, CURRENCY3];
  const currenciesDecimals = [DECIMALS1, DECIMALS2, DECIMALS3];

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
      ambassadorAddress,
    } = generateDataAndSignature(1, depositAmount);

    genericWallet = await world.createWallet({
      address: address,
      balance: 0,
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
        e.Addr(ambassadorAddress),
      ],
      esdts: [{ id: currency, amount: depositAmount }],
    });

    ambassadorWallet = await world.createWallet({
      address: ambassadorAddress,
      balance: 0n,
    });
  }

  await world.setCurrentBlockInfo({
    timestamp: TIMESTAMP_AFTER,
  });

  await deployer
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "retrieve",
      funcArgs: [e.U64(TIMESTAMP_AFTER), e.TopBuffer(SIGNATURE_AFTER)],
    })
    .assertFail({ code: 4, message: "Release needs to be called first" });
});

test("Retrieve", async () => {
  const numberOfDeposits = 40;

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
    } = generateDataAndSignature(1, depositAmount);

    genericWallet = await world.createWallet({
      address: address,
      balance: 0,
      kvs: [
        e.kvs.Esdts([
          {
            id: currency,
            amount: depositAmount,
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
          amount: depositAmount,
        },
      ],
    });

    ambassadorWallet = await world.createWallet({
      address: ambassadorAddress,
      balance: 0n,
    });

    const depositAmountDenominated =
      depositAmount * BigInt(10 ** (18 - decimals));

    currenciesPlatformFees[currencyRand] += platformFee;
    platformFeeAmount = platformFee * BigInt(10 ** (18 - decimals));
    currenciesGroupFees[currencyRand] += groupFee;
    groupFeeAmount = groupFee * BigInt(10 ** (18 - decimals));
    ambassadorFeeAmount = ambassadorFee * BigInt(10 ** (18 - decimals));

    currenciesAmbassadorFees[currencyRand] =
      currenciesAmbassadorFees[currencyRand] +
      ambassadorFee -
      platformFee -
      groupFee -
      ambassadorFee;

    ambassadorWallets.push(ambassadorWallet);
    currencies.push(currency);
    ambassadorFees.push(ambassadorFee);

    currenciesTotal[currencyRand] =
      currenciesTotal[currencyRand] +
      depositAmount -
      platformFee -
      groupFee -
      ambassadorFee;

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

  await deployer.callContract({
    callee: raisePoolContract,
    gasLimit: 50_000_000,
    funcName: "retrieve",
    funcArgs: [e.U64(TIMESTAMP_AFTER), e.TopBuffer(SIGNATURE_AFTER)],
  });

  assertAccount(await deployer.getAccount(), {
    balance: 0n,
    hasKvs: [
      e.kvs.Esdts([{ id: CURRENCY1, amount: currenciesTotal[0] }]),
      e.kvs.Esdts([{ id: CURRENCY2, amount: currenciesTotal[1] }]),
      e.kvs.Esdts([{ id: CURRENCY3, amount: currenciesTotal[2] }]),
    ],
  });
}, 200000);
