import { ContractLoader } from "./ContractLoader";
import { getTransactionPayload } from "./05.registerWalletPayload";
import { privateKeyBob, bobAddressBech32 } from "./signedData";
import { Address, Account } from "@multiversx/sdk-core";
import axios from "axios";
import { ApiNetworkProvider } from "@multiversx/sdk-network-providers";
const apiNetworkProvider = new ApiNetworkProvider(
  "https://devnet-api.multiversx.com",
);

const WALLET_DATABASE_CONTRACT_ADDRESS =
  "erd1qqqqqqqqqqqqqpgqn04pywlasvqywexpxd8833hagtv35yu47wpqkc5fh4";

async function callDeployRaisePool() {
  const transactionPayload = getTransactionPayload();

  const contractLoader = new ContractLoader(
    "../../wallet-database/output/wallet-database.abi.json",
  );
  const contract = await contractLoader.getContract(
    WALLET_DATABASE_CONTRACT_ADDRESS,
  );

  const bobAsAddress = Address.fromBech32(bobAddressBech32);
  const bobAsAccount = new Account(bobAsAddress);

  const deployerOnNetwork = await apiNetworkProvider.getAccount(bobAsAddress);
  bobAsAccount.update(deployerOnNetwork);

  const nonce = bobAsAccount.getNonceThenIncrement().valueOf();

  const transaction = contract.methods
    .registerWallet(transactionPayload)
    .withGasLimit(50_000_000)
    .withChainID("D")
    .withSender(new Address(bobAddressBech32))
    .withNonce(nonce)
    .buildTransaction();

  const signature = privateKeyBob.sign(transaction.serializeForSigning());
  transaction.applySignature(signature);

  const data = await axios.post(
    "https://devnet-api.multiversx.com/transactions",
    transaction.toSendable(),
  );
  console.log(data);
}

callDeployRaisePool().catch(console.error);
