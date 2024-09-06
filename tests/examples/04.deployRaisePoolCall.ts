import { ContractLoader } from "./ContractLoader";
import { getTransactionPayload } from "./04.deployRaisePoolPayload";
import { privateKeyDeployer, deployerAddressBech32 } from "./signedData";
import { Address, Account } from "@multiversx/sdk-core";
import { ApiNetworkProvider } from "@multiversx/sdk-network-providers";
const apiNetworkProvider = new ApiNetworkProvider(
  "https://devnet-api.multiversx.com",
);
import axios from "axios";

const FACTORY_CONTRACT_ADDRESS =
  "erd1qqqqqqqqqqqqqpgq4px4kmh4zvhnejhfnducdv6kmya6d7kp7wpqcqq6j0";

async function callDeployRaisePool() {
  const transactionPayload = getTransactionPayload();

  const contractLoader = new ContractLoader(
    "../../factory/output/factory.abi.json",
  );
  const contract = await contractLoader.getContract(FACTORY_CONTRACT_ADDRESS);

  const deployerAsAddress = Address.fromBech32(deployerAddressBech32);
  const deployerAsAccount = new Account(deployerAsAddress);

  const deployerOnNetwork =
    await apiNetworkProvider.getAccount(deployerAsAddress);
  deployerAsAccount.update(deployerOnNetwork);

  const nonce = deployerAsAccount.getNonceThenIncrement().valueOf();

  const transaction = contract.methods
    .deployRaisePool(transactionPayload)
    .withGasLimit(50_000_000)
    .withChainID("D")
    .withSender(new Address(deployerAddressBech32))
    .withNonce(nonce)
    .buildTransaction();

  const signature = privateKeyDeployer.sign(transaction.serializeForSigning());

  transaction.applySignature(signature);
  const data = await axios.post(
    "https://devnet-api.multiversx.com/transactions",
    transaction.toSendable(),
  );
  console.log(data);
  // Address is available in explorer after searching for txHash, in the SCDeploy Event in the Logs tab
  // For example: erd1qqqqqqqqqqqqqpgqyt6u26apdyfcefjugyt365v8dg392yfv7wpqzctdmk
}

callDeployRaisePool().catch(console.error);
