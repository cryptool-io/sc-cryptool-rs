import { Code } from "@multiversx/sdk-core";
import { ApiNetworkProvider } from "@multiversx/sdk-network-providers";
const apiNetworkProvider = new ApiNetworkProvider(
  "https://devnet-api.multiversx.com",
);
import { promises } from "fs";
import axios from "axios";

import {
  SmartContractTransactionsFactory,
  TransactionsFactoryConfig,
  Account,
  Address,
} from "@multiversx/sdk-core";

import { getTransactionPayload } from "./03.initFactoryPayload";
import { privateKeyDeployer, deployerAddressBech32 } from "./signedData";

const deployerAsAddress = Address.fromBech32(deployerAddressBech32);
const deployerAsAccount = new Account(deployerAsAddress);

const walletDatabaseConfig = new TransactionsFactoryConfig({ chainID: "D" });
let walletDatabase = new SmartContractTransactionsFactory({
  config: walletDatabaseConfig,
});

async function callInitWalletDatabase() {
  const codeBuffer = await promises.readFile(
    "../../factory/output/factory.wasm",
  );

  const code = Code.fromBuffer(codeBuffer);
  const transactionPayload = getTransactionPayload();

  const deployTransaction = walletDatabase.createTransactionForDeploy({
    sender: deployerAsAddress,
    bytecode: code.valueOf(),
    gasLimit: 100000000n,
    arguments: transactionPayload,
  });

  const deployerOnNetwork =
    await apiNetworkProvider.getAccount(deployerAsAddress);
  deployerAsAccount.update(deployerOnNetwork);

  deployTransaction.nonce = BigInt(
    deployerAsAccount.getNonceThenIncrement().valueOf(),
  );

  const signature = privateKeyDeployer.sign(
    deployTransaction.serializeForSigning(),
  );
  deployTransaction.applySignature(signature);

  const data = await axios.post(
    "https://devnet-api.multiversx.com/transactions",
    deployTransaction.toSendable(),
  );
  console.log(data);
  // Address is available in explorer after searching for txHash, in the SCDeploy Event in the Logs tab
  // For example: erd1qqqqqqqqqqqqqpgq4px4kmh4zvhnejhfnducdv6kmya6d7kp7wpqcqq6j0
}

callInitWalletDatabase().catch(console.error);
