multiversx_sc::imports!();
multiversx_sc::derive_imports!();

#[multiversx_sc::module]
pub trait StorageModule {
    #[view(getSourceContract)]
    #[storage_mapper("source_contract")]
    fn source_raise_contract(&self) -> SingleValueMapper<ManagedAddress>;

    #[view(getWalletDatabaseContract)]
    #[storage_mapper("wallet_database_address")]
    fn wallet_database_address(&self) -> SingleValueMapper<ManagedAddress>;

    #[view(getPaymentCurrencies)]
    #[storage_mapper("payment_currencies")]
    fn payment_currencies(&self) -> UnorderedSetMapper<TokenIdentifier>;

    #[view(getCurrencyDecimals)]
    #[storage_mapper("currency_decimals")]
    fn currency_decimals(&self, currency: &TokenIdentifier) -> SingleValueMapper<u32>;

    #[view(getContractCreationEnabled)]
    #[storage_mapper("raise_pool_enabled")]
    fn raise_pool_enabled(&self) -> SingleValueMapper<bool>;

    #[view(getAddressToDeployer)]
    #[storage_mapper("address_to_deployer")]
    fn address_to_deployer(
        &self,
        pool_address: &ManagedAddress,
    ) -> SingleValueMapper<ManagedAddress>;

    #[view(getPoolIdToAddress)]
    #[storage_mapper("pool_id_to_address")]
    fn pool_id_to_address(&self, pool_id: &ManagedBuffer) -> SingleValueMapper<ManagedAddress>;

    #[view(getSigner)]
    #[storage_mapper("signer")]
    fn signer(&self) -> SingleValueMapper<ManagedAddress>;

    #[view(getPoolIds)]
    #[storage_mapper("pool_ids")]
    fn pool_ids(&self) -> UnorderedSetMapper<ManagedBuffer>;
}
