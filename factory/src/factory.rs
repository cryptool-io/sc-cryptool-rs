#![no_std]

#[allow(unused_imports)]
use multiversx_sc::imports::*;
use raise_pool::ProxyTrait as _;

/// An empty contract. To be used as a template when starting a new contract from scratch.
#[multiversx_sc::contract]
pub trait Factory {
    #[init]
    fn init(&self) {
        self.raise_pool_enabled().set(false);
    }

    #[only_owner]
    #[endpoint(setSourceContract)]
    fn set_source_contract(&self, source_contract: ManagedAddress) {
        self.source_contract().set(source_contract);
    }

    fn validate_signature(&self, caller: &ManagedAddress, pool_id: &u64, signer: ManagedAddress, signature: ManagedBuffer) {
        let timestamp = self.blockchain().get_block_timestamp();

        let mut buffer = ManagedBuffer::new();
        buffer.append(&ManagedBuffer::new_from_bytes(&timestamp.to_be_bytes()));
        buffer.append(&ManagedBuffer::new_from_bytes(&pool_id.to_be_bytes()));
        buffer.append(&caller.as_managed_buffer());

        self.crypto()
            .verify_ed25519(signer.as_managed_buffer(), &buffer, &signature);
    }

    #[payable("EGLD")]
    #[endpoint(deployRaisePool)]
    fn deploy_raise_pool(
        &self,
        pool_id: u64,
        soft_cap: BigUint,
        hard_cap: BigUint,
        min_deposit: BigUint,
        max_deposit: BigUint,
        deposit_increments: BigUint,
        start_date: u64,
        end_date: u64,
        refund_enabled: bool,
        platform_fee_wallet: ManagedAddress,
        group_fee_wallet: ManagedAddress,
        signer: ManagedAddress,
        signature: ManagedBuffer,
        payment_currencies: MultiValueEncoded<MultiValue2<TokenIdentifier, u32>>,
    ) {
        let caller = self.blockchain().get_caller();
        self.validate_signature(&caller, &pool_id, signer, signature);

        let (raise_pool_contract_address, ()) = self
            .raise_pool_deploy_proxy()
            .init(
                soft_cap,
                hard_cap,
                min_deposit,
                max_deposit,
                deposit_increments,
                start_date,
                end_date,
                refund_enabled,
                platform_fee_wallet,
                group_fee_wallet,
                payment_currencies,
            )
            .deploy_from_source(
                &self.source_contract().get(),
                CodeMetadata::UPGRADEABLE | CodeMetadata::READABLE,
            );

        self.address_to_deployer(&raise_pool_contract_address)
            .set(caller);
        self.pool_id_to_address(&pool_id)
            .set(&raise_pool_contract_address);
    }

    #[upgrade]
    fn upgrade(&self) {}

    #[endpoint(setContractCreationEnabled)]
    fn set_raise_pool_enabled(&self, enabled: bool) {
        self.raise_pool_enabled().set(enabled);
    }

    #[proxy]
    fn raise_pool_deploy_proxy(&self) -> raise_pool::Proxy<Self::Api>;

    // Storage

    #[view(getSourceContract)]
    #[storage_mapper("source_contract")]
    fn source_contract(&self) -> SingleValueMapper<ManagedAddress>;

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
    fn pool_id_to_address(&self, pool_id: &u64) -> SingleValueMapper<ManagedAddress>;
}
