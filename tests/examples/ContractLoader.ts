import { SmartContract, AbiRegistry, Address } from "@multiversx/sdk-core";
import * as fs from "fs";

export class ContractLoader {
  private readonly abiPath: string;
  private contract: SmartContract | undefined = undefined;

  constructor(abiPath: string) {
    this.abiPath = abiPath;
  }

  private async load(contractAddress: string): Promise<SmartContract> {
    try {
      const jsonContent: string = await fs.promises.readFile(this.abiPath, {
        encoding: "utf8",
      });
      const json = JSON.parse(jsonContent);

      const abiRegistry = AbiRegistry.create(json);

      return new SmartContract({
        address: new Address(contractAddress),
        abi: abiRegistry,
      });
    } catch (error) {
      throw new Error("Error when creating contract from abi");
    }
  }

  async getContract(contractAddress: string): Promise<SmartContract> {
    if (!this.contract) {
      this.contract = await this.load(contractAddress);
    }

    return this.contract;
  }
}
