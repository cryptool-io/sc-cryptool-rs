# Raise Pool Smart Contract

The Cryptool Raise Pool SC is designed to facilitate the deployment of pools for raising stablecoins. It uses off-chain parameters from the database that handles the management of all the chains available for its five main endpoints: **deployRaisePool**, **deposit**, **refund**, **release**, and **retrieve**. All transactions will be signed by a signer wallet that will allow only valid database parameters to be used.

The logic is split into two smart contracts: the **raise pool**, which handles all the business logic, and the **factory**, which facilitates the deployment of new pools.

## Prerequisites: Deploy a dummy raise pool SC using:

- **init** (*owner: ManagedAddress, pool_id: u32, soft_cap: BigUint, hard_cap: BigUint, min_deposit: BigUint, max_deposit: BigUint, deposit_increments: BigUint, start_date: u64, end_date: u64, refund_enabled: bool, platform_fee_wallet: ManagedAddress, group_fee_wallet: ManagedAddress, signer: ManagedAddress, payment_currencies: MultiValueEncoded<MultiValue2<TokenIdentifier, u32>>*)

    - To use the Factory deployer, a dummy raise pool contract needs to be deployed on-chain first. The parameters used for this are not important (they only need to pass the required sanity logic). The Factory wrapper will then be able to take the deployed bytecode, pass in production parameters, and deploy raise pools into production.

## Owner Callable Endpoints on Production Factory SC:

- **init** (*source_contract: ManagedAddress, signer: ManagedAddress, payment_currencies: MultiValueEncoded<MultiValue2<TokenIdentifier, u32>>*)

    - Deploy a Factory smart contract with the dummy raise pool as a source contract, the backend wallet that will be used to validate database data as signer and the accepted currencies for creating the raise pools and their respective decimals.

- **deployRaisePool** (*pool_id: u32, soft_cap: BigUint, hard_cap: BigUint, min_deposit: BigUint, max_deposit: BigUint, deposit_increments: BigUint, start_date: u64, end_date: u64, refund_enabled: bool, platform_fee_wallet: ManagedAddress, group_fee_wallet: ManagedAddress, signature: ManagedBuffer, timestamp: u64, currencies: MultiValueEncoded<TokenIdentifier>*)

    - This endpoint, called on the factory, deploys a new raise pool. Notice the parameters are virtually identical to the dummy deploy except for the owner, which the Factory sets as the caller and the currencies which don't need to have their decimals specified as this was done in the Factory deploy step.

## Owner Callable Endpoints on Production Raise Pool SC:

- **refund** (*timestamp: u64, signature: ManagedBuffer*) -> *OperationCompletionStatus*

    - This endpoint refunds the deposited amounts to users if the Soft Cap is not exceeded once the End Date is exceeded.
    - If there are more transactions than the blockchain limit, the function returns *interrupted*, so this endpoint needs to be called again. Otherwise, it returns *completed*.
    - Signature data format: timestamp + pool_id + deployer_address.

- **release** (*timestamp: u64, signature: ManagedBuffer, overcommitted: MultiValueEncoded<MultiValue3<ManagedAddress, TokenIdentifier, BigUint>>*) -> *OperationCompletionStatus*

    - Once the End Date is exceeded, calling the release endpoint sends fees to the Platform, Group, and Ambassador Wallets (and potentially to Overcommitter Wallets if applicable).
    - If there are more transactions than the blockchain limit, the function returns *interrupted*, so this endpoint needs to be called again. Otherwise, it returns *completed*. Please keep in mind that if the function returns *interrupted*, the next call needs to have the exact same parameters (so even if the function reaches the *overcommited* step and returns *interrupted*, the next call needs to have the original overcommited list as parameter)
    - Signature data format: timestamp + pool_id + deployer_address.

- **retrieve** (*timestamp: u64, signature: ManagedBuffer*)

    - Once the *release* has been completed, calling this endpoint sends the remaining deposited funds to the owner wallet.
    - Signature data format: timestamp + pool_id + deployer_address.

## User Callable Endpoints on Production Raise Pool SC:

- **registerWallet** (*user_signature: ManagedBuffer, signer_signature: ManagedBuffer*)

    - The user needs to register their wallet before being able to deposit.
    - Two signature data formats are used:
        - user_signature: user address
        - signer_signature: signature address.

- **removeWallet** (*signer_signature: ManagedBuffer*)

    - The user also has the possibility to remove their signature from the whitelisted addresses.
    - Signature data format: user address.

- **deposit** (*timestamp: u64, signature: ManagedBuffer, platform_fee_percentage: BigUint, group_fee_percentage: BigUint, ambassador: OptionalValue<MultiValue2<BigUint, ManagedAddress>>*)

    - This is the main endpoint of the pool, used to deposit tokens in the pool.
    - If no ambassador is provided, the signature data format is:
        - timestamp + pool_id + deployer_address + platform_fee_percentage + group_fee_percentage.
    - If an ambassador is provided, the signature data format is:
        - timestamp + pool_id + deployer_address + platform_fee_percentage + group_fee_percentage + ambassador_fee + ambassador_address.

## Testing using xSuite:

Please add three PEM keys named "deployer", "bob", and "carol" in the wallets folders in order to test the smart contracts in this project.
