# Raise Pool Smart Contract

The Cryptool Raise Pool SC is designed to facilitate the deployment of pools for raising stablecoins. It uses off-chain parameters from the database that handles the management of all the chains available for its five main endpoints: **deployRaisePool**, **deposit**, **refund**, **release**, and **retrieve**. All transactions will be signed by a signer wallet that will allow only valid database parameters to be used.

The logic is split into two smart contracts: the **raise pool**, which handles all the business logic, and the **factory**, which facilitates the deployment of new pools.

## Prerequisites

### Deploy a wallet database contract using:

- **init** (_signer: ManagedAddress_)
  - We need a wallet database contract to store the wallets that will be used to deposit funds in the raise pools. The signer wallet will be used to validate that wallets are going to be registered.

      **!!! Check _tests/examples/01.initWalletDatabaseCall.ts_ for an example.**

### Deploy a distribution contract using:
- **init** (_platform_fee_wallet: ManagedAddress, signer: ManagedAddress_)
  - For distribution purposes a general distribution contract can be deployed, using 2 wallets as parameters, one as platform fee where all the fees will be sent to and a signer wallet

### Deploy a dummy raise pool SC using:

- **init** (_owner: ManagedAddress,
        pool_id: ManagedBuffer,
        soft_cap: BigUint,
        hard_cap: BigUint,
        min_deposit: BigUint,
        max_deposit: BigUint,
        deposit_increments: BigUint,
        start_date: u64,
        end_date: u64,
        refund_enabled: bool,
        refund_deadline: u64,
        platform_fee_wallet: ManagedAddress,
        group_fee_wallet: ManagedAddress,
        signer: ManagedAddress,
        wallet_database_address: ManagedAddress,
        payment_currencies: MultiValueEncoded<MultiValue2<TokenIdentifier, u32>>_)

  - To use the Factory deployer, a dummy raise pool contract needs to be deployed on-chain first. The parameters used for this are not important (they only need to pass the required sanity logic). The Factory wrapper will then be able to take the deployed bytecode, pass in production parameters, and deploy raise pools into production.

      **!!! Check _tests/examples/02.initDummyRaisePoolCall.ts_ for an example.**

## Owner Callable Endpoints on Production Factory SC:

- **init** (_source_raise_contract: ManagedAddress,
        wallet_database_address: ManagedAddress,
        signer: ManagedAddress,
        payment_currencies: MultiValueEncoded<MultiValue2<TokenIdentifier, u32>>_)

  - Deploy a Factory smart contract with the dummy raise pool as a source contract, the wallet database address, the backend wallet that will be used to validate database data as signer and the accepted currencies for creating the raise pools and their respective decimals.

      **!!! Check _tests/examples/03.initFactoryCall.ts_ for an example.**

- **deployRaisePool** (_pool_id: ManagedBuffer,
        soft_cap: BigUint,
        hard_cap: BigUint,
        min_deposit: BigUint,
        max_deposit: BigUint,
        deposit_increments: BigUint,
        start_date: u64,
        end_date: u64,
        refund_enabled: bool,
        refund_deadline: u64,
        platform_fee_wallet: ManagedAddress,
        group_fee_wallet: ManagedAddress,
        signature: ManagedBuffer,
        timestamp: u64,
        payment_network_id: ManagedBuffer,
        currencies: MultiValueEncoded<TokenIdentifier>_)

  - This endpoint, called on the factory, deploys a new raise pool. Notice the parameters are virtually identical to the dummy deploy except for the owner, which the Factory sets as the caller and the currencies which don't need to have their decimals specified as this was done in the Factory deploy step.
  - Signature data format: signed(timestamp + pool_id + caller).

      **!!! Check _tests/examples/04.deployRaisePoolCall.ts_ for an example.**

## Owner Callable Endpoints on Production Raise Pool SC:

- **refund** (_timestamp: u64, signature: ManagedBuffer_) -> _OperationCompletionStatus_

  - This endpoint refunds the deposited amounts to users if the Soft Cap is not exceeded once the End Date is exceeded.
  - If there are more transactions than the blockchain limit, the function returns _interrupted_, so this endpoint needs to be called again. Otherwise, it returns _completed_.
  - Signature data format: signed(timestamp + pool_id + caller).

- **release** (_timestamp: u64, signature: ManagedBuffer, overcommitted: MultiValueEncoded<ManagedAddress>_) -> _OperationCompletionStatus_

  - Calling the release endpoint sends fees to the Platform, Group, and Ambassador Wallets (and potentially to Overcommitter Wallets if applicable).
  - If there are more transactions than the blockchain limit, the function returns _interrupted_, so this endpoint needs to be called again. Otherwise, it returns _completed_. Please keep in mind that if the function returns _interrupted_, the next call needs to have the exact same parameters (so even if the function reaches the _overcommited_ step and returns _interrupted_, the next call needs to have the original overcommited list as parameter)
  - Overcommited wallets are refunded in full (identical to the adminRefund endpoint)
  - Signature data format: signed(timestamp + pool_id + caller).

- **retrieve** (_timestamp: u64, signature: ManagedBuffer_)

  - Once the _release_ has been completed, calling this endpoint sends the remaining deposited funds to the owner wallet.
  - Signature data format: signed(timestamp + pool_id + caller).

- **userRefund**(_timestamp: u64, signature: ManagedBuffer, token: TokenIdentifier_ )

    - This enpdpoint allows the user to refund  all of his deposited funds in the respective token.
    - Only available if the refund is enabled and the refund deadline has not passed.
    - The platform and ambassador fees are kept, only the group fees are returned
    - Signature data format: signed(timestamp + pool_id + caller + token).

- **adminRefund** (_timestamp: u64, signature: ManagedBuffer, addresses: MultiValueEncoded<ManagedAddress>_)

    - This enpdpoint allows the admin to fully refund all token amounts to respective wallets
    - The full deposited amount is returned to the user and all storages that were updated due to the deposit are cleared
    - Signature data format: signed(timestamp + pool_id + caller).

- **setPlatformFeeWallet** (_timestamp: u64, signature: ManagedBuffer, wallet: ManagedAddress_)
    - Change the platform fee wallet address to a new one
    - Signature data format: signed(timestamp + pool_id + caller).

- **enableRaisePool** (_value: bool, timestamp: u64, signature: ManagedBuffer_)
    - Switch the raise pool on or off depending on the boolean value sent
    - Signature data format: signed(timestamp + pool_id + caller).

- **setTimestamps** (_timestamp: u64,
        signature: ManagedBuffer,
        new_start_date: u64,
        new_end_date: u64,
        new_refund_deadline: u64_)
    - Set new start, end and refund deadline timestamps on the pool
    - Signature data format: signed(timestamp + pool_id + caller).

- **setRefundEnabled** (_timestamp: u64, signature: ManagedBuffer, value: bool_)
    - Switch the refund on or off depending on the boolean value sent
    - Signature data format: signed(timestamp + pool_id + caller).

## Owner Callable Endpoints on Production Distribution SC:

- **distribute** (_pool_id: ManagedBuffer, batch_id: u32, timestamp: u64, signature: ManagedBuffer, distribute_data: MultiValueEncoded<MultiValue2<ManagedAddress, BigUint>>_,
    )
    - This enpdpoint allows the admin to distribute tokens to the respective addresses
    - The addresses that receive the funds should be registered in the wallet database
    - The sum of the amounts that will be sent to the addresses should sum to the total payment made to this endpoint
    - Signature data format: signed(timestamp + pool_id + batch_id + admin_address).


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

- **deposit** (_timestamp: u64,
        signature: ManagedBuffer,
        platform_fee: BigUint,
        group_fee: BigUint,
        deposit_id: ManagedBuffer,
        ambassadors: MultiValueEncoded<MultiValue2<BigUint, ManagedAddress>>_)
  - This is the main endpoint of the pool, used to deposit tokens in the pool.
  - All fees are calculated as token amounts, so the app needs to convert the fees to the token's decimals before calling the endpoint.
  - If no ambassador is provided, the signature data format is:
    - signed(timestamp + pool_id + caller_address + platform_fee + group_fee).
  - If an ambassador is provided, the signature data format is:
    - signed(timestamp + pool_id + caller_address + platform_fee + group_fee + ambassador_fee + ambassador_address).
  - If 2 ambassadors are provided, the signature data format is:
    - signed(timestamp + pool_id + caller_address + platform_fee + group_fee + ambassador_fee1 + ambassador_address1 + ambassador_fee2 + ambassador_address2).
      **!!! Check _tests/examples/06.depositCallNoAmbassador_ for an example.**

      **!!! Check _tests/examples/07.depositCallWithAmbassador_ for an example.**
