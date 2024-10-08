# Raise Pool Smart Contract

The Cryptool Raise Pool SC is designed to facilitate the deployment of pools for raising stablecoins. It uses off-chain parameters from the database that handles the management of all the chains available for its five main endpoints: **deployRaisePool**, **deposit**, **refund**, **release**, and **retrieve**. All transactions will be signed by a signer wallet that will allow only valid database parameters to be used.

The logic is split into two smart contracts: the **raise pool**, which handles all the business logic, and the **factory**, which facilitates the deployment of new pools.

## Prerequisites

### Deploy a wallet database contract using:

- **init** (&self, signer: ManagedAddress)
  - We need a wallet database contract to store the wallets that will be used to deposit funds in the raise pools. The signer wallet will be used to validate that wallets are going to be registered.

      **!!! Check _tests/examples/01.initWalletDatabaseCall.ts_ for an example.**

### Deploy a dummy raise pool SC using:

- **init** (_owner: ManagedAddress, pool_id: u32, soft_cap: BigUint, hard_cap: BigUint, min_deposit: BigUint, max_deposit: BigUint, deposit_increments: BigUint, start_date: u64, end_date: u64, refund_enabled: bool, platform_fee_wallet: ManagedAddress, group_fee_wallet: ManagedAddress, signer: ManagedAddress, wallet_database_address: ManagedAddress, payment_currencies: MultiValueEncoded<MultiValue2<TokenIdentifier, u32>>_)

  - To use the Factory deployer, a dummy raise pool contract needs to be deployed on-chain first. The parameters used for this are not important (they only need to pass the required sanity logic). The Factory wrapper will then be able to take the deployed bytecode, pass in production parameters, and deploy raise pools into production.

      **!!! Check _tests/examples/02.initDummyRaisePoolCall.ts_ for an example.**

## Owner Callable Endpoints on Production Factory SC:

- **init** (_source_raise_contract: ManagedAddress, wallet_database_address: ManagedAddress, signer: ManagedAddress, payment_currencies: MultiValueEncoded<MultiValue2<TokenIdentifier, u32>>_)

  - Deploy a Factory smart contract with the dummy raise pool as a source contract, the wallet database address, the backend wallet that will be used to validate database data as signer and the accepted currencies for creating the raise pools and their respective decimals.

      **!!! Check _tests/examples/03.initFactoryCall.ts_ for an example.**

- **deployRaisePool** (_pool_id: u32, soft_cap: BigUint, hard_cap: BigUint, min_deposit: BigUint, max_deposit: BigUint, deposit_increments: BigUint, start_date: u64, end_date: u64, refund_enabled: bool, platform_fee_wallet: ManagedAddress, group_fee_wallet: ManagedAddress, signature: ManagedBuffer, timestamp: u64, currencies: MultiValueEncoded<TokenIdentifier>_)

  - This endpoint, called on the factory, deploys a new raise pool. Notice the parameters are virtually identical to the dummy deploy except for the owner, which the Factory sets as the caller and the currencies which don't need to have their decimals specified as this was done in the Factory deploy step.
  - Signature data format: signed(timestamp + pool_id + deployer_address).

      **!!! Check _tests/examples/04.deployRaisePoolCall.ts_ for an example.**

- **enableRaisePool** (_timestamp: u64, pool_id: ManagedBuffer, signature: ManagedBuffer, value: bool,_)

  - This endpoint, called on the factory, eanbles or disables the pool.
  - Signature data format: signed(timestamp + pool_id + deployer_address).

## Owner Callable Endpoints on Production Raise Pool SC:

- **refund** (_timestamp: u64, signature: ManagedBuffer_) -> _OperationCompletionStatus_

  - This endpoint refunds the deposited amounts to users if the Soft Cap is not exceeded once the End Date is exceeded.
  - If there are more transactions than the blockchain limit, the function returns _interrupted_, so this endpoint needs to be called again. Otherwise, it returns _completed_.
  - Signature data format: signed(timestamp + pool_id + deployer_address).

- **release** (_timestamp: u64, signature: ManagedBuffer, overcommitted: MultiValueEncoded<MultiValue3<ManagedAddress, TokenIdentifier, BigUint>>_) -> _OperationCompletionStatus_

  - Once the End Date is exceeded, calling the release endpoint sends fees to the Platform, Group, and Ambassador Wallets (and potentially to Overcommitter Wallets if applicable).
  - If there are more transactions than the blockchain limit, the function returns _interrupted_, so this endpoint needs to be called again. Otherwise, it returns _completed_. Please keep in mind that if the function returns _interrupted_, the next call needs to have the exact same parameters (so even if the function reaches the _overcommited_ step and returns _interrupted_, the next call needs to have the original overcommited list as parameter)
  - Signature data format: signed(timestamp + pool_id + deployer_address).

- **retrieve** (_timestamp: u64, signature: ManagedBuffer_)

  - Once the _release_ has been completed, calling this endpoint sends the remaining deposited funds to the owner wallet.
  - Signature data format: signed(timestamp + pool_id + deployer_address).

- **topUp** (_timestamp: u64, signature: ManagedBuffer_)

  - This enpdpoint allows the owner to top up the pool with a token. The token is registered on the first call, any subsequent calls will be able to top up the pool with the same token.
  - Signature data format: signed(timestamp + pool_id + deployer_address).

- **distribute** (_timestamp: u64, signature: ManagedBuffer, distribute_data: MultiValueEncoded<MultiValue2<ManagedAddress, BigUint>>_)

    - This endpoint allows the owner to distribute tokens to the selected distribution wallets.
    - Signature data format: signed(timestamp + pool_id + deployer_address).

## User Callable Endpoints on Production Wallet Database SC:

- **registerWallet** (_timestamp: u64, user_signature: ManagedBuffer_)

  - The user needs to register his wallet before being able to deposit.
  - The signature data format is:
    - user_signature: signed(timestamp + user_address)

      **!!! Check _tests/examples/05.registerWalletCall.ts_ for an example.**

- **removeWallet** (_timestamp: u64, user_signature: ManagedBuffer_)

  - The user also has the possibility to remove their signature from the whitelisted addresses.
  - The signature data format is:
    - user_signature: signed(timestamp + user_address)

## General View Endpoints on Production Wallet Database SC:

- **isRegistered** (_address: ManagedAddress_) -> bool

  - Calling this endpoint checks whether or not a wallet is registered

## User Callable Endpoints on Production Raise Pool SC:

- **deposit** (_timestamp: u64, signature: ManagedBuffer, platform_fee_percentage: BigUint, group_fee_percentage: BigUint, ambassador: OptionalValue<MultiValue2<BigUint, ManagedAddress>>_)

  - This is the main endpoint of the pool, used to deposit tokens in the pool.
  - If no ambassador is provided, the signature data format is:
    - signed(timestamp + pool_id + caller_address + platform_fee_percentage + group_fee_percentage).
  - If an ambassador is provided, the signature data format is:
    - signed(timestamp + pool_id + caller_address + platform_fee_percentage + group_fee_percentage + ambassador_fee + ambassador_address).

      **!!! Check _tests/examples/06.depositCallNoAmbassador_ for an example.**

      **!!! Check _tests/examples/07.depositCallWithAmbassador_ for an example.**
