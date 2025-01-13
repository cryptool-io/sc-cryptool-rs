// Code generated by the multiversx-sc build system. DO NOT EDIT.

////////////////////////////////////////////////////
////////////////// AUTO-GENERATED //////////////////
////////////////////////////////////////////////////

// Init:                                 1
// Upgrade:                              1
// Endpoints:                           19
// Async Callback (empty):               1
// Total number of exported functions:  22

#![no_std]

multiversx_sc_wasm_adapter::allocator!();
multiversx_sc_wasm_adapter::panic_handler!();

multiversx_sc_wasm_adapter::endpoints! {
    factory
    (
        init => init
        upgrade => upgrade
        deployRaisePool => deploy_raise_pool
        addAdmin => add_admin_endpoint
        removeAdmin => remove_admin_endpoint
        updateOwnerOrAdmin => update_owner_or_admin_endpoint
        getPermissions => permissions
        addToPauseWhitelist => add_to_pause_whitelist
        removeFromPauseWhitelist => remove_from_pause_whitelist
        pause => pause
        resume => resume
        getState => state
        getSourceContract => source_raise_contract
        getWalletDatabaseContract => wallet_database_address
        getPaymentCurrencies => payment_currencies
        getCurrencyDecimals => currency_decimals
        getContractCreationEnabled => raise_pool_enabled
        getAddressToDeployer => address_to_deployer
        getPoolIdToAddress => pool_id_to_address
        getSigner => signer
        getPoolIds => pool_ids
    )
}

multiversx_sc_wasm_adapter::async_callback_empty! {}
