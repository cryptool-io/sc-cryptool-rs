import { test, beforeEach, afterEach } from "vitest";
import { assertAccount, LSWorld, LSWallet, LSContract, e } from "xsuite";

import {
  TOKEN_ID,
  START_TIMESTAMP,
  END_TIMESTAMP,
  REWARDS,
  DEFAULT_WALLET_AMOUNT,
  DIVISION_SAFETY_CONSTANT,
  TIMESTAMP_BEFORE_START,
  REWARDS_START_BLOCK,
  TOKEN_ID_DUMMY,
  TIER_0,
  DEFAULT_STAKE_AMOUNT,
  START_TIMESTAMP_DUMMY,
  BLOCK_INCREMENT,
  REWARDS_PER_BLOCK,
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
});

afterEach(async () => {
  world.terminate();
});

test("Deploy", async () => {
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

  assertAccount(await contract.getAccount(), {
    balance: 0n,
    kvs: [
      e.kvs.Mapper("token_id").Value(e.Str(TOKEN_ID)),
      e.kvs.Mapper("permissions", e.Addr(deployer)).Value(e.U(7)),
      e.kvs.Mapper("start_timestamp").Value(e.U64(START_TIMESTAMP)),
      e.kvs.Mapper("end_timestamp").Value(e.U64(END_TIMESTAMP)),
      e.kvs
        .Mapper("wallet_database_address")
        .Value(e.Addr(walletDababaseContract)),
      e.kvs
        .Mapper("division_safety_constant")
        .Value(e.U(DIVISION_SAFETY_CONSTANT)),
    ],
  });
});

test("Deploy with before timestamp", async () => {
  await world.setCurrentBlockInfo({
    timestamp: REWARDS_START_BLOCK,
  });

  await deployer
    .deployContract({
      code: "file:stake-pool/output/stake-pool.wasm",
      codeMetadata: [],
      gasLimit: 10_000_000,
      codeArgs: [
        e.Str(TOKEN_ID),
        e.U64(TIMESTAMP_BEFORE_START),
        e.U64(END_TIMESTAMP),
        e.Addr(walletDababaseContract),
      ],
    })
    .assertFail({
      code: 4,
      message: "Start timestamp must be set in the future",
    });
});

test("Deploy with end timestamp before start timestamp", async () => {
  await deployer
    .deployContract({
      code: "file:stake-pool/output/stake-pool.wasm",
      codeMetadata: [],
      gasLimit: 10_000_000,
      codeArgs: [
        e.Str(TOKEN_ID),
        e.U64(START_TIMESTAMP),
        e.U64(TIMESTAMP_BEFORE_START),
        e.Addr(walletDababaseContract),
      ],
    })
    .assertFail({
      code: 4,
      message: "End timestamp must be greater than start timestamp",
    });
});

test("Add rewards by non ownser", async () => {
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

  await alice
    .callContract({
      callee: contract,
      gasLimit: 50_000_000,
      funcName: "addRewards",
      funcArgs: [e.U64(REWARDS_PER_BLOCK)],
      esdts: [{ id: TOKEN_ID, amount: DEFAULT_WALLET_AMOUNT }],
    })
    .assertFail({
      code: 4,
      message: "Permission denied",
    });
});

test("Add rewards with wrong token", async () => {
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

  await deployer
    .callContract({
      callee: contract,
      gasLimit: 50_000_000,
      funcName: "addRewards",
      funcArgs: [e.U64(REWARDS_START_BLOCK)],
      esdts: [{ id: TOKEN_ID_DUMMY, amount: DEFAULT_WALLET_AMOUNT }],
    })
    .assertFail({
      code: 4,
      message: "Invalid payment currency",
    });
});

test("Stake with state inactive", async () => {
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

  await alice
    .callContract({
      callee: contract,
      gasLimit: 50_000_000,
      funcName: "stake",
      funcArgs: [e.U8(TIER_0)],
      esdts: [{ id: TOKEN_ID, amount: DEFAULT_STAKE_AMOUNT }],
    })
    .assertFail({
      code: 4,
      message: "State is not active",
    });
});

test("Stake with unregistered wallet", async () => {
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
    funcName: "resume",
  });

  await alice
    .callContract({
      callee: contract,
      gasLimit: 50_000_000,
      funcName: "stake",
      funcArgs: [e.U8(TIER_0)],
      esdts: [{ id: TOKEN_ID, amount: DEFAULT_STAKE_AMOUNT }],
    })
    .assertFail({
      code: 4,
      message: "Wallet not registered",
    });
});

test("Stake with wrong token", async () => {
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

  await alice
    .callContract({
      callee: contract,
      gasLimit: 50_000_000,
      funcName: "stake",
      funcArgs: [e.U8(TIER_0)],
      esdts: [{ id: TOKEN_ID_DUMMY, amount: DEFAULT_STAKE_AMOUNT }],
    })
    .assertFail({
      code: 4,
      message: "Invalid payment currency",
    });
});

test("Stake with wrong block number", async () => {
  ({ contract } = await deployer.deployContract({
    code: "file:stake-pool/output/stake-pool.wasm",
    codeMetadata: [],
    gasLimit: 10_000_000,
    codeArgs: [
      e.Str(TOKEN_ID),
      e.U64(START_TIMESTAMP_DUMMY),
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
    funcArgs: [e.U64(REWARDS_PER_BLOCK)],
    esdts: [{ id: TOKEN_ID, amount: DEFAULT_WALLET_AMOUNT }],
  });

  await world.setCurrentBlockInfo({
    timestamp: 0,
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

  await alice
    .callContract({
      callee: contract,
      gasLimit: 50_000_000,
      funcName: "stake",
      funcArgs: [e.U8(TIER_0)],
      esdts: [{ id: TOKEN_ID, amount: DEFAULT_STAKE_AMOUNT }],
    })
    .assertFail({
      code: 4,
      message: "Staking has not started yet or invalid block timestamp",
    });
});

test("Unstake", async () => {
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

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "stake",
    funcArgs: [e.U8(TIER_0)],
    esdts: [{ id: TOKEN_ID, amount: DEFAULT_STAKE_AMOUNT }],
  });

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "unstake",
    funcArgs: [e.U(DEFAULT_STAKE_AMOUNT), e.U8(TIER_0)],
  });
});

test("Unstake too much", async () => {
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

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "stake",
    funcArgs: [e.U8(TIER_0)],
    esdts: [{ id: TOKEN_ID, amount: DEFAULT_STAKE_AMOUNT }],
  });

  await alice
    .callContract({
      callee: contract,
      gasLimit: 50_000_000,
      funcName: "unstake",
      funcArgs: [e.U(DEFAULT_STAKE_AMOUNT + BigInt(1)), e.U8(TIER_0)],
    })
    .assertFail({
      code: 4,
      message: "Not enough to unstake",
    });
});

test("Claim rewards while nothing staked", async () => {
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

  await alice
    .callContract({
      callee: contract,
      gasLimit: 50_000_000,
      funcName: "claimRewards",
    })
    .assertFail({
      code: 4,
      message: "No rewards accumulated yet",
    });
});

test("Claim with not enough rewards in sc", async () => {
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
    funcArgs: [e.U64(REWARDS_PER_BLOCK)],
    esdts: [{ id: TOKEN_ID, amount: REWARDS_PER_BLOCK }],
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

  await alice.callContract({
    callee: contract,
    gasLimit: 50_000_000,
    funcName: "stake",
    funcArgs: [e.U8(TIER_0)],
    esdts: [{ id: TOKEN_ID, amount: DEFAULT_STAKE_AMOUNT }],
  });

  await world.setCurrentBlockInfo({
    timestamp: REWARDS_START_BLOCK + 2 * BLOCK_INCREMENT,
  });

  await alice
    .callContract({
      callee: contract,
      gasLimit: 50_000_000,
      funcName: "claimRewards",
    })
    .assertFail({
      code: 4,
      message: "Not enough token amount to pay rewards",
    });
});
