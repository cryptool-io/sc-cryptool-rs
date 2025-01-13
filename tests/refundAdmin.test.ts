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
  DEPOSIT_TIMESTAMP,
  HIGH_HARD_CAP,
  TIMESTAMP_WITH_DELAY,
  REFUND_NOT_ENABLED,
  LOW_SOFT_CAP,
  TIMESTAMP_AFTER,
  PAYMENT_NETWORK_ID,
  DEPOSIT_ID,
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

test("Refund admin with wrong signature", async () => {
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
        e.Addr(ambassadorAddress),
      ],
      esdts: [{ id: currency, amount: depositAmount }],
    });
  }

  await deployer
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "adminRefund",
      funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_DUMMY)],
    })
    .assertFail({ code: 10, message: "invalid signature" });
});

test("Refund admin by non owner", async () => {
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
        e.Addr(ambassadorAddress),
      ],
      esdts: [{ id: currency, amount: depositAmount }],
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
      funcName: "adminRefund",
      funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_BOB_REFUND)],
    })
    .assertFail({ code: 4, message: "Only owner can call this function" });
});

test("Refund admin with too much delay", async () => {
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
        e.Addr(ambassadorAddress),
      ],
      esdts: [{ id: currency, amount: depositAmount }],
    });
  }

  await world.setCurrentBlockInfo({
    timestamp: TIMESTAMP_WITH_DELAY,
  });

  await deployer
    .callContract({
      callee: raisePoolContract,
      gasLimit: 50_000_000,
      funcName: "adminRefund",
      funcArgs: [e.U64(TIMESTAMP), e.TopBuffer(SIGNATURE_DEPLOYER)],
    })
    .assertFail({ code: 4, message: "Function call took too long" });
});

test("Refund last N deposits", async () => {
  const numberOfDeposits = 50;
  const refundLast = 20;

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

  const baseKvs = [
    e.kvs.Mapper("soft_cap").Value(e.I(HIGH_SOFT_CAP)),
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
  var refundAddresses: Encodable[] = [];
  var totalAmbassadorsAmount: bigint = BigInt(0);

  const currenciesArray = [CURRENCY1, CURRENCY2, CURRENCY3];
  const currenciesDecimals = [DECIMALS1, DECIMALS2, DECIMALS3];
  var currenciesTotal = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesPlatformFees = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesGroupFees = [BigInt(0), BigInt(0), BigInt(0)];
  var currenciesAmbassadorFees = [BigInt(0), BigInt(0), BigInt(0)];
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
    const ambassadorBool = getRandomInt(0, 1);
    const {
      address,
      whitelistSignature,
      depositSignature,
      platformFee,
      groupFee,
      ambassadorFee,
      ambassadorAddress,
    } = generateDataAndSignature(ambassadorBool, depositAmount);

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

    if (i < numberOfDeposits - refundLast) {
      const depositAmountDenominated =
        BigInt(depositAmount) * BigInt(10 ** (18 - decimals));
      const platformFeeDenominated =
        platformFee * BigInt(10 ** (18 - decimals));
      const groupFeeDenominated = groupFee * BigInt(10 ** (18 - decimals));
      const ambassadorFeeDenominated =
        ambassadorFee * BigInt(10 ** (18 - decimals));

      totalAmbassadorsAmount += ambassadorFeeDenominated;
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
          .Mapper(
            "address_platform_fee",
            e.Addr(genericWallet),
            e.Str(currency),
          )
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

      if (ambassadorBool == 1) {
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
            .Mapper("address_to_ambassadors", e.Addr(genericWallet))
            .UnorderedSet([e.Addr(ambassadorAddress)]),
        );

        currenciesAmbassadorFees[currencyRand] += ambassadorFee;
        ambassadorsRefferalFees.push([BigInt(0), BigInt(0), BigInt(0)]);
        ambassadorsRefferalFees[ambIdx][currencyRand] = ambassadorFee;
        ambIdx += 1;
        ambassadors.push(e.Addr(ambassadorAddress));
      }
    } else {
      refundAddresses.push(e.Addr(address));
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

  await deployer.callContract({
    callee: raisePoolContract,
    gasLimit: 500_000_000,
    funcName: "adminRefund",
    funcArgs: [
      e.U64(TIMESTAMP),
      e.TopBuffer(SIGNATURE_DEPLOYER),
      ...refundAddresses,
    ],
  });

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
