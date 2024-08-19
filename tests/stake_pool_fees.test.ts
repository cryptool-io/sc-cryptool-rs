import { test, beforeEach, afterEach } from "vitest";
import { assertAccount, LSWorld, LSWallet, LSContract, e } from "xsuite";

import {
  baseKvs,
  TOKEN_ID,
  START_TIMESTAMP,
  END_TIMESTAMP,
  REWARDS,
  DEFAULT_WALLET_AMOUNT,
  DIVISION_SAFETY_CONSTANT,
  REWARDS_START_BLOCK,
  TOKEN_ID_DUMMY,
  TIER_0,
  TIER_1,
  TIER_2,
  DEFAULT_STAKE_AMOUNT,
  REWARDS_PER_BLOCK,
  DEFAULT_UNSTAKE_AMOUNT,
  DEFAULT_LEFT_AMOUNT,
  SECONDS_PER_DAY,
} from "./helpers";

import { signerAddress } from "./signatures/common.ts";
import { aliceAddress, SIGNATURE_ALICE } from "./signatures/alice.ts";

let world: LSWorld;
let alice: LSWallet;
let deployer: LSWallet;
let signer: LSWallet;
let walletDababaseContract: LSContract;
let contract: LSContract;

beforeEach(async () => {
  world = await LSWorld.start();
  deployer = await world.createWallet({
    balance: 100_000,
    kvs: [
      e.kvs.Esdts([
        { id: TOKEN_ID, amount: REWARDS },
        { id: TOKEN_ID_DUMMY, amount: REWARDS },
      ]),
    ],
  });

  signer = await world.createWallet({
    balance: 100_000,
    address: signerAddress,
  });

  alice = await world.createWallet({
    balance: 100_000,
    address: aliceAddress,
    kvs: [
      e.kvs.Esdts([
        { id: TOKEN_ID, amount: DEFAULT_WALLET_AMOUNT },
        { id: TOKEN_ID_DUMMY, amount: DEFAULT_WALLET_AMOUNT },
      ]),
    ],
  });

  ({ contract: walletDababaseContract } = await deployer.deployContract({
    code: "file:wallet-database/output/wallet-database.wasm",
    codeMetadata: [],
    codeArgs: [e.Addr(signer)],
    gasLimit: 10_000_000,
  }));

  ({ contract } = await deployer.deployContract({
    code: "file:stake-pool/output/stake-pool.wasm",
    codeMetadata: [],
    gasLimit: 10_000_000,
    codeArgs: [
      e.Str(TOKEN_ID),
      e.U64(START_TIMESTAMP),
      e.U64(END_TIMESTAMP),
      e.Addr(walletDababaseContract),
    ],
  }));

  await world.setCurrentBlockInfo({
    timestamp: REWARDS_START_BLOCK,
  });

  await deployer.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "addRewards",
    funcArgs: [e.U(REWARDS_PER_BLOCK)],
    esdts: [{ id: TOKEN_ID, amount: REWARDS }],
  });

  await alice.callContract({
    callee: walletDababaseContract,
    gasLimit: 50_000_000,
    funcName: "registerWallet",
    funcArgs: [e.U64(REWARDS_START_BLOCK), e.TopBuffer(SIGNATURE_ALICE)],
  });

  await deployer.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "resume",
  });
});

afterEach(async () => {
  world.terminate();
});

test("Unstake from Tier One (60 days), between 31 and 60 days left", async () => {
  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "stake",
    funcArgs: [e.U8(TIER_0)],
    esdts: [{ id: TOKEN_ID, amount: DEFAULT_STAKE_AMOUNT }],
  });

  const block_increment = 10;
  const current_block = REWARDS_START_BLOCK + block_increment;

  await world.setCurrentBlockInfo({
    timestamp: current_block,
  });

  const total_fee_percentage = 190 + 190; // 1.9% deposit fee + 1.9% withdrawal fee

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "unstake",
    funcArgs: [e.U(DEFAULT_UNSTAKE_AMOUNT), e.U8(TIER_0)],
  });

  const fees =
    (DEFAULT_UNSTAKE_AMOUNT * BigInt(total_fee_percentage)) / BigInt(10000);
  const rewards_per_share =
    (BigInt(block_increment) *
      BigInt(REWARDS_PER_BLOCK) *
      DIVISION_SAFETY_CONSTANT) /
    DEFAULT_STAKE_AMOUNT;

  const wallet_pending_rewards =
    (BigInt(rewards_per_share) * BigInt(DEFAULT_STAKE_AMOUNT)) /
    BigInt(DIVISION_SAFETY_CONSTANT);

  assertAccount(await contract.getAccount(), {
    balance: 0n,
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U(7)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
      e.kvs.Mapper("last_update_block").Value(e.U(current_block)),
      e.kvs.Mapper("total_rewards").Value(e.U(REWARDS)),
      e.kvs.Mapper("total_amount_staked").Value(e.U(DEFAULT_LEFT_AMOUNT)),
      e.kvs
        .Mapper("wallet_pending_rewards", e.Addr(alice))
        .Value(e.U(wallet_pending_rewards)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(alice))
        .Value(e.U(rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(alice))
        .Value(e.U(DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(current_block)),
      e.kvs.Mapper("rewards_per_share").Value(e.U(rewards_per_share)),
      e.kvs.Mapper("total_fees").Value(e.U(fees)),
      e.kvs.Esdts([
        {
          id: TOKEN_ID,
          amount:
            REWARDS + DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT + fees,
        },
      ]),
    ],
  });
});

test("Unstake from Tier One (60 days), between 0 and 30 days left", async () => {
  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "stake",
    funcArgs: [e.U8(TIER_0)],
    esdts: [{ id: TOKEN_ID, amount: DEFAULT_STAKE_AMOUNT }],
  });

  const block_increment = 40 * SECONDS_PER_DAY;
  const current_block = REWARDS_START_BLOCK + block_increment;

  await world.setCurrentBlockInfo({
    timestamp: current_block,
  });

  const total_fee_percentage = 190 + 90; // 1.9% deposit fee + 0.9% withdrawal fee

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "unstake",
    funcArgs: [e.U(DEFAULT_UNSTAKE_AMOUNT), e.U8(TIER_0)],
  });

  const fees =
    (DEFAULT_UNSTAKE_AMOUNT * BigInt(total_fee_percentage)) / BigInt(10000);
  const rewards_per_share =
    (BigInt(block_increment) *
      BigInt(REWARDS_PER_BLOCK) *
      DIVISION_SAFETY_CONSTANT) /
    DEFAULT_STAKE_AMOUNT;

  const wallet_pending_rewards =
    (BigInt(rewards_per_share) * BigInt(DEFAULT_STAKE_AMOUNT)) /
    BigInt(DIVISION_SAFETY_CONSTANT);

  assertAccount(await contract.getAccount(), {
    balance: 0n,
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U(7)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
      e.kvs.Mapper("last_update_block").Value(e.U(current_block)),
      e.kvs.Mapper("total_rewards").Value(e.U(REWARDS)),
      e.kvs.Mapper("total_amount_staked").Value(e.U(DEFAULT_LEFT_AMOUNT)),
      e.kvs
        .Mapper("wallet_pending_rewards", e.Addr(alice))
        .Value(e.U(wallet_pending_rewards)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(alice))
        .Value(e.U(rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(alice))
        .Value(e.U(DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(alice), e.U8(TIER_0))
        .Value(e.U(current_block)),
      e.kvs.Mapper("rewards_per_share").Value(e.U(rewards_per_share)),
      e.kvs.Mapper("total_fees").Value(e.U(fees)),
      e.kvs.Esdts([
        {
          id: TOKEN_ID,
          amount:
            REWARDS + DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT + fees,
        },
      ]),
    ],
  });
});

test("Unstake from Tier Two (90 days), between 31 and 90 days left", async () => {
  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "stake",
    funcArgs: [e.U8(TIER_1)],
    esdts: [{ id: TOKEN_ID, amount: DEFAULT_STAKE_AMOUNT }],
  });

  const block_increment = 10;
  const current_block = REWARDS_START_BLOCK + block_increment;

  await world.setCurrentBlockInfo({
    timestamp: current_block,
  });

  const total_fee_percentage = 90 + 190; // 0.9% deposit fee + 1.9% withdrawal fee

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "unstake",
    funcArgs: [e.U(DEFAULT_UNSTAKE_AMOUNT), e.U8(TIER_1)],
  });

  const fees =
    (DEFAULT_UNSTAKE_AMOUNT * BigInt(total_fee_percentage)) / BigInt(10000);
  const rewards_per_share =
    (BigInt(block_increment) *
      BigInt(REWARDS_PER_BLOCK) *
      DIVISION_SAFETY_CONSTANT) /
    DEFAULT_STAKE_AMOUNT;

  const wallet_pending_rewards =
    (BigInt(rewards_per_share) * BigInt(DEFAULT_STAKE_AMOUNT)) /
    BigInt(DIVISION_SAFETY_CONSTANT);

  assertAccount(await contract.getAccount(), {
    balance: 0n,
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U(7)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
      e.kvs.Mapper("last_update_block").Value(e.U(current_block)),
      e.kvs.Mapper("total_rewards").Value(e.U(REWARDS)),
      e.kvs.Mapper("total_amount_staked").Value(e.U(DEFAULT_LEFT_AMOUNT)),
      e.kvs
        .Mapper("wallet_pending_rewards", e.Addr(alice))
        .Value(e.U(wallet_pending_rewards)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(alice))
        .Value(e.U(rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(alice))
        .Value(e.U(DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(alice), e.U8(TIER_1))
        .Value(e.U(DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(alice), e.U8(TIER_1))
        .Value(e.U(current_block)),
      e.kvs.Mapper("rewards_per_share").Value(e.U(rewards_per_share)),
      e.kvs.Mapper("total_fees").Value(e.U(fees)),
      e.kvs.Esdts([
        {
          id: TOKEN_ID,
          amount:
            REWARDS + DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT + fees,
        },
      ]),
    ],
  });
});

test("Unstake from Tier Two (90 days), between 0 and 30 days left", async () => {
  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "stake",
    funcArgs: [e.U8(TIER_1)],
    esdts: [{ id: TOKEN_ID, amount: DEFAULT_STAKE_AMOUNT }],
  });

  const block_increment = 70 * SECONDS_PER_DAY;
  const current_block = REWARDS_START_BLOCK + block_increment;

  await world.setCurrentBlockInfo({
    timestamp: current_block,
  });

  const total_fee_percentage = 90 + 90; // 0.9% deposit fee + 0.9% withdrawal fee

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "unstake",
    funcArgs: [e.U(DEFAULT_UNSTAKE_AMOUNT), e.U8(TIER_1)],
  });

  const fees =
    (DEFAULT_UNSTAKE_AMOUNT * BigInt(total_fee_percentage)) / BigInt(10000);
  const rewards_per_share =
    (BigInt(block_increment) *
      BigInt(REWARDS_PER_BLOCK) *
      DIVISION_SAFETY_CONSTANT) /
    DEFAULT_STAKE_AMOUNT;

  const wallet_pending_rewards =
    (BigInt(rewards_per_share) * BigInt(DEFAULT_STAKE_AMOUNT)) /
    BigInt(DIVISION_SAFETY_CONSTANT);

  assertAccount(await contract.getAccount(), {
    balance: 0n,
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U(7)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
      e.kvs.Mapper("last_update_block").Value(e.U(current_block)),
      e.kvs.Mapper("total_rewards").Value(e.U(REWARDS)),
      e.kvs.Mapper("total_amount_staked").Value(e.U(DEFAULT_LEFT_AMOUNT)),
      e.kvs
        .Mapper("wallet_pending_rewards", e.Addr(alice))
        .Value(e.U(wallet_pending_rewards)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(alice))
        .Value(e.U(rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(alice))
        .Value(e.U(DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(alice), e.U8(TIER_1))
        .Value(e.U(DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(alice), e.U8(TIER_1))
        .Value(e.U(current_block)),
      e.kvs.Mapper("rewards_per_share").Value(e.U(rewards_per_share)),
      e.kvs.Mapper("total_fees").Value(e.U(fees)),
      e.kvs.Esdts([
        {
          id: TOKEN_ID,
          amount:
            REWARDS + DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT + fees,
        },
      ]),
    ],
  });
});

test("Unstake from Tier Three (180 days), between 91 and 180 days left", async () => {
  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "stake",
    funcArgs: [e.U8(TIER_2)],
    esdts: [{ id: TOKEN_ID, amount: DEFAULT_STAKE_AMOUNT }],
  });

  const block_increment = 10;
  const current_block = REWARDS_START_BLOCK + block_increment;

  await world.setCurrentBlockInfo({
    timestamp: current_block,
  });

  const total_fee_percentage = 0 + 290; // 0% deposit fee + 2.9% withdrawal fee

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "unstake",
    funcArgs: [e.U(DEFAULT_UNSTAKE_AMOUNT), e.U8(TIER_2)],
  });

  const fees =
    (DEFAULT_UNSTAKE_AMOUNT * BigInt(total_fee_percentage)) / BigInt(10000);
  const rewards_per_share =
    (BigInt(block_increment) *
      BigInt(REWARDS_PER_BLOCK) *
      DIVISION_SAFETY_CONSTANT) /
    DEFAULT_STAKE_AMOUNT;

  const wallet_pending_rewards =
    (BigInt(rewards_per_share) * BigInt(DEFAULT_STAKE_AMOUNT)) /
    BigInt(DIVISION_SAFETY_CONSTANT);

  assertAccount(await contract.getAccount(), {
    balance: 0n,
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U(7)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
      e.kvs.Mapper("last_update_block").Value(e.U(current_block)),
      e.kvs.Mapper("total_rewards").Value(e.U(REWARDS)),
      e.kvs.Mapper("total_amount_staked").Value(e.U(DEFAULT_LEFT_AMOUNT)),
      e.kvs
        .Mapper("wallet_pending_rewards", e.Addr(alice))
        .Value(e.U(wallet_pending_rewards)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(alice))
        .Value(e.U(rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(alice))
        .Value(e.U(DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(alice), e.U8(TIER_2))
        .Value(e.U(DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(alice), e.U8(TIER_2))
        .Value(e.U(current_block)),
      e.kvs.Mapper("rewards_per_share").Value(e.U(rewards_per_share)),
      e.kvs.Mapper("total_fees").Value(e.U(fees)),
      e.kvs.Esdts([
        {
          id: TOKEN_ID,
          amount:
            REWARDS + DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT + fees,
        },
      ]),
    ],
  });
});

test("Unstake from Tier Three (180 days), between 31 and 90 days left", async () => {
  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "stake",
    funcArgs: [e.U8(TIER_2)],
    esdts: [{ id: TOKEN_ID, amount: DEFAULT_STAKE_AMOUNT }],
  });

  const block_increment = 100 * SECONDS_PER_DAY;
  const current_block = REWARDS_START_BLOCK + block_increment;

  await world.setCurrentBlockInfo({
    timestamp: current_block,
  });

  const total_fee_percentage = 0 + 190; // 0% deposit fee + 1.9% withdrawal fee

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "unstake",
    funcArgs: [e.U(DEFAULT_UNSTAKE_AMOUNT), e.U8(TIER_2)],
  });

  const fees =
    (DEFAULT_UNSTAKE_AMOUNT * BigInt(total_fee_percentage)) / BigInt(10000);
  const rewards_per_share =
    (BigInt(block_increment) *
      BigInt(REWARDS_PER_BLOCK) *
      DIVISION_SAFETY_CONSTANT) /
    DEFAULT_STAKE_AMOUNT;

  const wallet_pending_rewards =
    (BigInt(rewards_per_share) * BigInt(DEFAULT_STAKE_AMOUNT)) /
    BigInt(DIVISION_SAFETY_CONSTANT);

  assertAccount(await contract.getAccount(), {
    balance: 0n,
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U(7)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
      e.kvs.Mapper("last_update_block").Value(e.U(current_block)),
      e.kvs.Mapper("total_rewards").Value(e.U(REWARDS)),
      e.kvs.Mapper("total_amount_staked").Value(e.U(DEFAULT_LEFT_AMOUNT)),
      e.kvs
        .Mapper("wallet_pending_rewards", e.Addr(alice))
        .Value(e.U(wallet_pending_rewards)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(alice))
        .Value(e.U(rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(alice))
        .Value(e.U(DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(alice), e.U8(TIER_2))
        .Value(e.U(DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(alice), e.U8(TIER_2))
        .Value(e.U(current_block)),
      e.kvs.Mapper("rewards_per_share").Value(e.U(rewards_per_share)),
      e.kvs.Mapper("total_fees").Value(e.U(fees)),
      e.kvs.Esdts([
        {
          id: TOKEN_ID,
          amount:
            REWARDS + DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT + fees,
        },
      ]),
    ],
  });
});

test("Unstake from Tier Three (180 days), between 0 and 30 days left", async () => {
  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "stake",
    funcArgs: [e.U8(TIER_2)],
    esdts: [{ id: TOKEN_ID, amount: DEFAULT_STAKE_AMOUNT }],
  });

  const block_increment = 160 * SECONDS_PER_DAY;
  const current_block = REWARDS_START_BLOCK + block_increment;

  await world.setCurrentBlockInfo({
    timestamp: current_block,
  });

  const total_fee_percentage = 0 + 90; // 0% deposit fee + 0.9% withdrawal fee

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "unstake",
    funcArgs: [e.U(DEFAULT_UNSTAKE_AMOUNT), e.U8(TIER_2)],
  });

  const fees =
    (DEFAULT_UNSTAKE_AMOUNT * BigInt(total_fee_percentage)) / BigInt(10000);
  const rewards_per_share =
    (BigInt(block_increment) *
      BigInt(REWARDS_PER_BLOCK) *
      DIVISION_SAFETY_CONSTANT) /
    DEFAULT_STAKE_AMOUNT;

  const wallet_pending_rewards =
    (BigInt(rewards_per_share) * BigInt(DEFAULT_STAKE_AMOUNT)) /
    BigInt(DIVISION_SAFETY_CONSTANT);

  assertAccount(await contract.getAccount(), {
    balance: 0n,
    kvs: [
      ...baseKvs,
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U(7)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
      e.kvs.Mapper("last_update_block").Value(e.U(current_block)),
      e.kvs.Mapper("total_rewards").Value(e.U(REWARDS)),
      e.kvs.Mapper("total_amount_staked").Value(e.U(DEFAULT_LEFT_AMOUNT)),
      e.kvs
        .Mapper("wallet_pending_rewards", e.Addr(alice))
        .Value(e.U(wallet_pending_rewards)),
      e.kvs
        .Mapper("wallet_rewards_per_share", e.Addr(alice))
        .Value(e.U(rewards_per_share)),
      e.kvs
        .Mapper("wallet_amount_staked", e.Addr(alice))
        .Value(e.U(DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_amount_staked", e.Addr(alice), e.U8(TIER_2))
        .Value(e.U(DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT)),
      e.kvs
        .Mapper("wallet_per_tier_update_block", e.Addr(alice), e.U8(TIER_2))
        .Value(e.U(current_block)),
      e.kvs.Mapper("rewards_per_share").Value(e.U(rewards_per_share)),
      e.kvs.Mapper("total_fees").Value(e.U(fees)),
      e.kvs.Esdts([
        {
          id: TOKEN_ID,
          amount:
            REWARDS + DEFAULT_STAKE_AMOUNT - DEFAULT_UNSTAKE_AMOUNT + fees,
        },
      ]),
    ],
  });
});
