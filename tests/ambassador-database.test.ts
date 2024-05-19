import { test, beforeEach, afterEach } from "vitest";
import { assertAccount, e, SContract, SWallet, SWorld } from "xsuite";
import {
  DEFAULT_REFERRAL_PERCENTAGE,
  ESDT_TOKEN1,
  ESDT_TOKEN2,
  ESDT_TOKEN1_AMOUNT,
  ESDT_TOKEN2_AMOUNT,
  TOTAL_TOKEN_AMOUNT,
  NEW_REFERRAL_PERCENTEAGE,
  REFERRAL_CODE1,
  REFERRAL_CODE2,
  EGLD_AMOUNT,
  MAX_PERCENTAGE,
  baseKvs,
} from "./helpers";

let world: SWorld;
let deployer: SWallet;
let alice: SWallet;
let bob: SWallet;
let contract: SContract;
let caller: SContract;

beforeEach(async () => {
  world = await SWorld.start();
  deployer = await world.createWallet();

  ({ contract: contract } = await deployer.deployContract({
    code: "file:ambassador-database/output/ambassador-database.wasm",
    codeMetadata: ["payableBySc"],
    gasLimit: 10_000_000,
    codeArgs: [e.U64(DEFAULT_REFERRAL_PERCENTAGE)],
  }));

  alice = await world.createWallet();
});

afterEach(async () => {
  world.terminate();
});

test("Deploy contract", async () => {
  await contract.setAccount({
    ...(await contract.getAccount()),
    owner: deployer,
    codeMetadata: ["payable"],
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U64(7)),
    ],
  });

  assertAccount(await contract.getAccountWithKvs(), {
    balance: 0n,
    kvs: [
      e.kvs
        .Mapper("default_referral_percentage")
        .Value(e.U64(DEFAULT_REFERRAL_PERCENTAGE)),
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U64(7)),
    ],
  });
});

test("Inactive state", async () => {
  await deployer
    .callContract({
      callee: contract,
      gasLimit: 50_000_000,
      funcName: "registerReferralCode",
      funcArgs: [e.Str(REFERRAL_CODE1)],
    })
    .assertFail({ code: 4, message: "State is not active" });
});

test("Register referral code", async () => {
  await deployer.callContract({
    callee: contract,
    gasLimit: 5_000_000,
    funcName: "resume",
  });

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "registerReferralCode",
    funcArgs: [e.Str(REFERRAL_CODE1)],
  });

  assertAccount(await contract.getAccountWithKvs(), {
    balance: 0n,
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("state").Value(e.U64(1)),
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U64(7)),
      e.kvs
        .Mapper("user_referral_code", e.Addr(alice))
        .Value(e.Str(REFERRAL_CODE1)),
      e.kvs
        .Mapper("referral_code_user", e.Str(REFERRAL_CODE1))
        .Value(e.Addr(alice)),
      e.kvs
        .Mapper("referral_code_percentage", e.Str(REFERRAL_CODE1))
        .Value(e.U64(DEFAULT_REFERRAL_PERCENTAGE)),
      e.kvs.Mapper("referral_codes").UnorderedSet([e.Str(REFERRAL_CODE1)]),
    ],
  });
});

test("Set new referral percentage", async () => {
  await deployer.callContract({
    callee: contract,
    gasLimit: 5_000_000,
    funcName: "resume",
  });

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "registerReferralCode",
    funcArgs: [e.Str(REFERRAL_CODE1)],
  });

  await deployer.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "setReferralPercentage",
    funcArgs: [e.Str(REFERRAL_CODE1), e.U64(NEW_REFERRAL_PERCENTEAGE)],
  });

  assertAccount(await contract.getAccountWithKvs(), {
    balance: 0n,
    hasKvs: [
      e.kvs
        .Mapper("referral_code_percentage", e.Str(REFERRAL_CODE1))
        .Value(e.U64(NEW_REFERRAL_PERCENTEAGE)),
      e.kvs.Mapper("referral_codes").UnorderedSet([e.Str(REFERRAL_CODE1)]),
    ],
  });
});

test("Set new referral percentage unregistered referral", async () => {
  await deployer.callContract({
    callee: contract,
    gasLimit: 5_000_000,
    funcName: "resume",
  });

  await deployer
    .callContract({
      callee: contract,
      gasLimit: 50_000_000,
      funcName: "setReferralPercentage",
      funcArgs: [e.Str(REFERRAL_CODE1), e.U64(NEW_REFERRAL_PERCENTEAGE)],
    })
    .assertFail({ code: 4, message: "Referral is not registered" });
});

test("Register two referral codes and modify one", async () => {
  await deployer.callContract({
    callee: contract,
    gasLimit: 5_000_000,
    funcName: "resume",
  });

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "registerReferralCode",
    funcArgs: [e.Str(REFERRAL_CODE1)],
  });

  bob = await world.createWallet();

  await bob.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "registerReferralCode",
    funcArgs: [e.Str(REFERRAL_CODE2)],
  });

  await deployer.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "setReferralPercentage",
    funcArgs: [e.Str(REFERRAL_CODE2), e.U64(NEW_REFERRAL_PERCENTEAGE)],
  });

  assertAccount(await contract.getAccountWithKvs(), {
    balance: 0n,
    hasKvs: [
      e.kvs
        .Mapper("referral_code_percentage", e.Str(REFERRAL_CODE1))
        .Value(e.U64(DEFAULT_REFERRAL_PERCENTAGE)),
      e.kvs
        .Mapper("referral_code_percentage", e.Str(REFERRAL_CODE2))
        .Value(e.U64(NEW_REFERRAL_PERCENTEAGE)),
      e.kvs
        .Mapper("referral_codes")
        .UnorderedSet([e.Str(REFERRAL_CODE1), e.Str(REFERRAL_CODE2)]),
    ],
  });
});

test("Double register referral code", async () => {
  await deployer.callContract({
    callee: contract,
    gasLimit: 5_000_000,
    funcName: "resume",
  });

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "registerReferralCode",
    funcArgs: [e.Str(REFERRAL_CODE1)],
  });

  await alice
    .callContract({
      callee: contract,
      gasLimit: 50_000_000,
      funcName: "registerReferralCode",
      funcArgs: [e.Str(REFERRAL_CODE1)],
    })
    .assertFail({ code: 4, message: "Referral is already registered" });
});

test("Remove referral code", async () => {
  await deployer.callContract({
    callee: contract,
    gasLimit: 5_000_000,
    funcName: "resume",
  });

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "registerReferralCode",
    funcArgs: [e.Str(REFERRAL_CODE1)],
  });

  await deployer.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "removeReferralCode",
    funcArgs: [e.Str(REFERRAL_CODE1)],
  });

  assertAccount(await contract.getAccountWithKvs(), {
    balance: 0n,
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U64(7)),
      e.kvs.Mapper("state").Value(e.U64(1)),
    ],
  });
});

test("Remove unregistered referral code", async () => {
  await deployer.callContract({
    callee: contract,
    gasLimit: 5_000_000,
    funcName: "resume",
  });

  await deployer
    .callContract({
      callee: contract,
      gasLimit: 50_000_000,
      funcName: "removeReferralCode",
      funcArgs: [e.Str(REFERRAL_CODE1)],
    })
    .assertFail({ code: 4, message: "Referral is not registered" });
});

test("Remove referral code by address with no privileges", async () => {
  await deployer.callContract({
    callee: contract,
    gasLimit: 5_000_000,
    funcName: "resume",
  });

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "registerReferralCode",
    funcArgs: [e.Str(REFERRAL_CODE1)],
  });

  await alice
    .callContract({
      callee: contract,
      gasLimit: 50_000_000,
      funcName: "removeReferralCode",
      funcArgs: [e.Str(REFERRAL_CODE1)],
    })
    .assertFail({ code: 4, message: "Permission denied" });
});

test("Apply referral code from non sc address", async () => {
  await deployer.callContract({
    callee: contract,
    gasLimit: 5_000_000,
    funcName: "resume",
  });

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "registerReferralCode",
    funcArgs: [e.Str(REFERRAL_CODE1)],
  });

  await alice
    .callContract({
      callee: contract,
      gasLimit: 50_000_000,
      funcName: "applyReferralCode",
      funcArgs: [e.Str(REFERRAL_CODE1)],
    })
    .assertFail({
      code: 4,
      message: "Only smart contracts can apply referral codes",
    });
});

test("Apply referral code with egld", async () => {
  ({ contract: caller } = await deployer.deployContract({
    code: "file:tests/caller-cryptool.wasm",
    codeMetadata: [],
    gasLimit: 10_000_000,
  }));

  await caller.setAccount({
    ...(await caller.getAccount()),
    owner: deployer,
    balance: EGLD_AMOUNT,
  });

  await deployer.callContract({
    callee: contract,
    gasLimit: 5_000_000,
    funcName: "resume",
  });

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "registerReferralCode",
    funcArgs: [e.Str(REFERRAL_CODE1)],
  });

  await alice.callContract({
    callee: caller,
    gasLimit: 50_000_000,
    funcName: "applyReferralCodeEgld",
    funcArgs: [e.Addr(contract), e.Str(REFERRAL_CODE1), e.U64(EGLD_AMOUNT)],
  });

  const contractAccount = await contract.getAccountWithKvs();
  assertAccount(contractAccount, {
    balance: (EGLD_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
    hasKvs: [
      e.kvs
        .Mapper("referral_earned_egld_amount", e.Str(REFERRAL_CODE1))
        .Value(
          e.U((EGLD_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE),
        ),
    ],
  });

  const callerAccount = await caller.getAccountWithKvs();
  assertAccount(callerAccount, {
    balance:
      EGLD_AMOUNT -
      (EGLD_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
  });
});

test("Apply referral code with esdt ", async () => {
  ({ contract: caller } = await deployer.deployContract({
    code: "file:tests/caller-cryptool.wasm",
    codeMetadata: [],
    gasLimit: 10_000_000,
  }));

  await caller.setAccount({
    ...(await caller.getAccount()),
    owner: deployer,
    kvs: e.kvs.Esdts([{ id: ESDT_TOKEN1, amount: TOTAL_TOKEN_AMOUNT }]),
  });

  await deployer.callContract({
    callee: contract,
    gasLimit: 5_000_000,
    funcName: "resume",
  });

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "registerReferralCode",
    funcArgs: [e.Str(REFERRAL_CODE1)],
  });

  await alice.callContract({
    callee: caller,
    gasLimit: 50_000_000,
    funcName: "applyReferralCodeEsdt",
    funcArgs: [
      e.Addr(contract),
      e.Str(REFERRAL_CODE1),
      e.Str(ESDT_TOKEN1),
      e.U64(ESDT_TOKEN1_AMOUNT),
    ],
  });

  const contractAccount = await contract.getAccountWithKvs();
  assertAccount(contractAccount, {
    hasKvs: [
      e.kvs.Esdts([
        {
          id: ESDT_TOKEN1,
          amount:
            (ESDT_TOKEN1_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
        },
      ]),
      e.kvs
        .Mapper(
          "referral_earned_esdt_amount",
          e.Str(REFERRAL_CODE1),
          e.Str(ESDT_TOKEN1),
        )
        .Value(
          e.U(
            (ESDT_TOKEN1_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
          ),
        ),
      e.kvs
        .Mapper("referral_earned_tokens", e.Str(REFERRAL_CODE1))
        .UnorderedSet([e.Str(ESDT_TOKEN1)]),
    ],
  });

  const callerAccount = await caller.getAccountWithKvs();
  assertAccount(callerAccount, {
    hasKvs: [
      e.kvs.Esdts([
        {
          id: ESDT_TOKEN1,
          amount:
            TOTAL_TOKEN_AMOUNT -
            (ESDT_TOKEN1_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
        },
      ]),
    ],
  });
});

test("Apply referral code with egld and esdt ", async () => {
  ({ contract: caller } = await deployer.deployContract({
    code: "file:tests/caller-cryptool.wasm",
    codeMetadata: [],
    gasLimit: 10_000_000,
  }));

  await caller.setAccount({
    ...(await caller.getAccount()),
    owner: deployer,
    balance: EGLD_AMOUNT,
    kvs: e.kvs.Esdts([{ id: ESDT_TOKEN1, amount: TOTAL_TOKEN_AMOUNT }]),
  });

  await deployer.callContract({
    callee: contract,
    gasLimit: 5_000_000,
    funcName: "resume",
  });

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "registerReferralCode",
    funcArgs: [e.Str(REFERRAL_CODE1)],
  });

  await alice.callContract({
    callee: caller,
    gasLimit: 50_000_000,
    funcName: "applyReferralCodeEgld",
    funcArgs: [e.Addr(contract), e.Str(REFERRAL_CODE1), e.U64(EGLD_AMOUNT)],
  });

  await alice.callContract({
    callee: caller,
    gasLimit: 50_000_000,
    funcName: "applyReferralCodeEsdt",
    funcArgs: [
      e.Addr(contract),
      e.Str(REFERRAL_CODE1),
      e.Str(ESDT_TOKEN1),
      e.U64(ESDT_TOKEN1_AMOUNT),
    ],
  });

  const contractAccount = await contract.getAccountWithKvs();
  assertAccount(contractAccount, {
    balance: (EGLD_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
    hasKvs: [
      e.kvs
        .Mapper("referral_earned_egld_amount", e.Str(REFERRAL_CODE1))
        .Value(
          e.U((EGLD_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE),
        ),
      e.kvs.Esdts([
        {
          id: ESDT_TOKEN1,
          amount:
            (ESDT_TOKEN1_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
        },
      ]),
      e.kvs
        .Mapper(
          "referral_earned_esdt_amount",
          e.Str(REFERRAL_CODE1),
          e.Str(ESDT_TOKEN1),
        )
        .Value(
          e.U(
            (ESDT_TOKEN1_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
          ),
        ),
      e.kvs
        .Mapper("referral_earned_tokens", e.Str(REFERRAL_CODE1))
        .UnorderedSet([e.Str(ESDT_TOKEN1)]),
    ],
  });

  const callerAccount = await caller.getAccountWithKvs();
  assertAccount(callerAccount, {
    balance:
      EGLD_AMOUNT -
      (EGLD_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
    hasKvs: [
      e.kvs.Esdts([
        {
          id: ESDT_TOKEN1,
          amount:
            TOTAL_TOKEN_AMOUNT -
            (ESDT_TOKEN1_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
        },
      ]),
    ],
  });
});

test("Apply referral code with egld and two esdts", async () => {
  ({ contract: caller } = await deployer.deployContract({
    code: "file:tests/caller-cryptool.wasm",
    codeMetadata: [],
    gasLimit: 10_000_000,
  }));

  await caller.setAccount({
    ...(await caller.getAccount()),
    owner: deployer,
    balance: EGLD_AMOUNT,
    kvs: e.kvs.Esdts([
      { id: ESDT_TOKEN1, amount: TOTAL_TOKEN_AMOUNT },
      { id: ESDT_TOKEN2, amount: TOTAL_TOKEN_AMOUNT },
    ]),
  });

  await deployer.callContract({
    callee: contract,
    gasLimit: 5_000_000,
    funcName: "resume",
  });

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "registerReferralCode",
    funcArgs: [e.Str(REFERRAL_CODE1)],
  });

  await alice.callContract({
    callee: caller,
    gasLimit: 50_000_000,
    funcName: "applyReferralCodeEgld",
    funcArgs: [e.Addr(contract), e.Str(REFERRAL_CODE1), e.U64(EGLD_AMOUNT)],
  });

  await alice.callContract({
    callee: caller,
    gasLimit: 50_000_000,
    funcName: "applyReferralCodeEsdt",
    funcArgs: [
      e.Addr(contract),
      e.Str(REFERRAL_CODE1),
      e.Str(ESDT_TOKEN1),
      e.U64(ESDT_TOKEN1_AMOUNT),
    ],
  });

  await alice.callContract({
    callee: caller,
    gasLimit: 50_000_000,
    funcName: "applyReferralCodeEsdt",
    funcArgs: [
      e.Addr(contract),
      e.Str(REFERRAL_CODE1),
      e.Str(ESDT_TOKEN2),
      e.U64(ESDT_TOKEN2_AMOUNT),
    ],
  });

  const contractAccount = await contract.getAccountWithKvs();
  assertAccount(contractAccount, {
    balance: (EGLD_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
    hasKvs: [
      e.kvs
        .Mapper("referral_earned_egld_amount", e.Str(REFERRAL_CODE1))
        .Value(
          e.U((EGLD_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE),
        ),
      e.kvs.Esdts([
        {
          id: ESDT_TOKEN1,
          amount:
            (ESDT_TOKEN1_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
        },
      ]),
      e.kvs.Esdts([
        {
          id: ESDT_TOKEN2,
          amount:
            (ESDT_TOKEN2_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
        },
      ]),
      e.kvs
        .Mapper(
          "referral_earned_esdt_amount",
          e.Str(REFERRAL_CODE1),
          e.Str(ESDT_TOKEN1),
        )
        .Value(
          e.U(
            (ESDT_TOKEN1_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
          ),
        ),
      e.kvs
        .Mapper(
          "referral_earned_esdt_amount",
          e.Str(REFERRAL_CODE1),
          e.Str(ESDT_TOKEN2),
        )
        .Value(
          e.U(
            (ESDT_TOKEN2_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
          ),
        ),
      e.kvs
        .Mapper("referral_earned_tokens", e.Str(REFERRAL_CODE1))
        .UnorderedSet([e.Str(ESDT_TOKEN1), e.Str(ESDT_TOKEN2)]),
    ],
  });

  const callerAccount = await caller.getAccountWithKvs();
  assertAccount(callerAccount, {
    balance:
      EGLD_AMOUNT -
      (EGLD_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
    hasKvs: [
      e.kvs.Esdts([
        {
          id: ESDT_TOKEN1,
          amount:
            TOTAL_TOKEN_AMOUNT -
            (ESDT_TOKEN1_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
        },
      ]),
      e.kvs.Esdts([
        {
          id: ESDT_TOKEN2,
          amount:
            TOTAL_TOKEN_AMOUNT -
            (ESDT_TOKEN2_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
        },
      ]),
    ],
  });
});

test("Claim referral earning", async () => {
  await contract.setAccount({
    ...(await contract.getAccount()),
    owner: deployer,
    balance: (EGLD_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
    codeMetadata: ["payable"],
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U64(7)),
      e.kvs.Mapper("state").Value(e.U64(1)),
      e.kvs
        .Mapper("referral_earned_egld_amount", e.Str(REFERRAL_CODE1))
        .Value(
          e.U((EGLD_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE),
        ),
      e.kvs.Esdts([
        {
          id: ESDT_TOKEN1,
          amount:
            (ESDT_TOKEN1_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
        },
      ]),
      e.kvs.Esdts([
        {
          id: ESDT_TOKEN2,
          amount:
            (ESDT_TOKEN2_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
        },
      ]),
      e.kvs
        .Mapper(
          "referral_earned_esdt_amount",
          e.Str(REFERRAL_CODE1),
          e.Str(ESDT_TOKEN1),
        )
        .Value(
          e.U(
            (ESDT_TOKEN1_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
          ),
        ),
      e.kvs
        .Mapper(
          "referral_earned_esdt_amount",
          e.Str(REFERRAL_CODE1),
          e.Str(ESDT_TOKEN2),
        )
        .Value(
          e.U(
            (ESDT_TOKEN2_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
          ),
        ),
      e.kvs
        .Mapper("referral_earned_tokens", e.Str(REFERRAL_CODE1))
        .UnorderedSet([e.Str(ESDT_TOKEN1), e.Str(ESDT_TOKEN2)]),
      e.kvs
        .Mapper("user_referral_code", e.Addr(alice))
        .Value(e.Str(REFERRAL_CODE1)),
      e.kvs
        .Mapper("referral_code_user", e.Str(REFERRAL_CODE1))
        .Value(e.Addr(alice)),
      e.kvs
        .Mapper("referral_code_percentage", e.Str(REFERRAL_CODE1))
        .Value(e.U64(DEFAULT_REFERRAL_PERCENTAGE)),
      e.kvs
        .Mapper("referral_codes")
        .UnorderedSet([e.Str(REFERRAL_CODE1), e.Str(ESDT_TOKEN2)]),
    ],
  });

  await deployer.callContract({
    callee: contract,
    gasLimit: 5_000_000,
    funcName: "resume",
  });

  await alice.callContract({
    callee: contract,
    gasLimit: 5_000_000,
    funcName: "claimReferralEarning",
  });

  const aliceAccount = await alice.getAccountWithKvs();
  assertAccount(aliceAccount, {
    balance: (EGLD_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
    kvs: [
      e.kvs.Esdts([
        {
          id: ESDT_TOKEN1,
          amount:
            (ESDT_TOKEN1_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
        },
      ]),
      e.kvs.Esdts([
        {
          id: ESDT_TOKEN2,
          amount:
            (ESDT_TOKEN2_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
        },
      ]),
    ],
  });

  assertAccount(await contract.getAccountWithKvs(), {
    balance: 0n,
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U64(7)),
      e.kvs.Mapper("state").Value(e.U64(1)),
      e.kvs
        .Mapper("user_referral_code", e.Addr(alice))
        .Value(e.Str(REFERRAL_CODE1)),
      e.kvs
        .Mapper("referral_code_user", e.Str(REFERRAL_CODE1))
        .Value(e.Addr(alice)),
      e.kvs
        .Mapper("referral_code_percentage", e.Str(REFERRAL_CODE1))
        .Value(e.U64(DEFAULT_REFERRAL_PERCENTAGE)),
      e.kvs
        .Mapper("referral_codes")
        .UnorderedSet([e.Str(REFERRAL_CODE1), e.Str(ESDT_TOKEN2)]),
    ],
  });
});

test("Claim referral earning unregistered referral", async () => {
  await deployer.callContract({
    callee: contract,
    gasLimit: 5_000_000,
    funcName: "resume",
  });

  await alice
    .callContract({
      callee: contract,
      gasLimit: 5_000_000,
      funcName: "claimReferralEarning",
    })
    .assertFail({
      code: 4,
      message: "Address does not have a referral code associated",
    });
});

test("Remove referral code with earning", async () => {
  await contract.setAccount({
    ...(await contract.getAccount()),
    owner: deployer,
    balance: (EGLD_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
    codeMetadata: ["payable"],
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U64(7)),
      e.kvs.Mapper("state").Value(e.U64(1)),
      e.kvs
        .Mapper("referral_earned_egld_amount", e.Str(REFERRAL_CODE1))
        .Value(
          e.U((EGLD_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE),
        ),
      e.kvs.Esdts([
        {
          id: ESDT_TOKEN1,
          amount:
            (ESDT_TOKEN1_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
        },
      ]),
      e.kvs.Esdts([
        {
          id: ESDT_TOKEN2,
          amount:
            (ESDT_TOKEN2_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
        },
      ]),
      e.kvs
        .Mapper(
          "referral_earned_esdt_amount",
          e.Str(REFERRAL_CODE1),
          e.Str(ESDT_TOKEN1),
        )
        .Value(
          e.U(
            (ESDT_TOKEN1_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
          ),
        ),
      e.kvs
        .Mapper(
          "referral_earned_esdt_amount",
          e.Str(REFERRAL_CODE1),
          e.Str(ESDT_TOKEN2),
        )
        .Value(
          e.U(
            (ESDT_TOKEN2_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
          ),
        ),
      e.kvs
        .Mapper("referral_earned_tokens", e.Str(REFERRAL_CODE1))
        .UnorderedSet([e.Str(ESDT_TOKEN1), e.Str(ESDT_TOKEN2)]),
      e.kvs
        .Mapper("user_referral_code", e.Addr(alice))
        .Value(e.Str(REFERRAL_CODE1)),
      e.kvs
        .Mapper("referral_code_user", e.Str(REFERRAL_CODE1))
        .Value(e.Addr(alice)),
      e.kvs
        .Mapper("referral_code_percentage", e.Str(REFERRAL_CODE1))
        .Value(e.U64(DEFAULT_REFERRAL_PERCENTAGE)),
      e.kvs
        .Mapper("referral_codes")
        .UnorderedSet([e.Str(REFERRAL_CODE1), e.Str(ESDT_TOKEN2)]),
    ],
  });

  await deployer.callContract({
    callee: contract,
    gasLimit: 5_000_000,
    funcName: "resume",
  });

  await deployer.callContract({
    callee: contract,
    gasLimit: 5_000_000,
    funcName: "removeReferralCode",
    funcArgs: [e.Str(REFERRAL_CODE1)],
  });

  const aliceAccount = await alice.getAccountWithKvs();
  assertAccount(aliceAccount, {
    balance: (EGLD_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
    kvs: [
      e.kvs.Esdts([
        {
          id: ESDT_TOKEN1,
          amount:
            (ESDT_TOKEN1_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
        },
      ]),
      e.kvs.Esdts([
        {
          id: ESDT_TOKEN2,
          amount:
            (ESDT_TOKEN2_AMOUNT * DEFAULT_REFERRAL_PERCENTAGE) / MAX_PERCENTAGE,
        },
      ]),
    ],
  });

  assertAccount(await contract.getAccountWithKvs(), {
    balance: 0n,
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U64(7)),
      e.kvs.Mapper("state").Value(e.U64(1)),
      e.kvs.Mapper("referral_codes").UnorderedSet([e.Str(ESDT_TOKEN2)]),
    ],
  });
});
