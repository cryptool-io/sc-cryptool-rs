#![no_std]

#[allow(unused_imports)]
use multiversx_sc::imports::*;
use permissions_module::Permissions;
use raise_pool::ProxyTrait as _;
mod events;

/// An empty contract. To be used as a template when starting a new contract from scratch.
#[multiversx_sc::contract]
pub trait Factory: permissions_module::PermissionsModule + pausable::PausableModule + events::EventsModule {
    #[init]
    fn init(&self, source_contract: ManagedAddress, signer: ManagedAddress) {
        let all_permissions = Permissions::OWNER | Permissions::ADMIN | Permissions::PAUSE;
        self.set_permissions(self.blockchain().get_caller(), all_permissions);
        self.raise_pool_enabled().set(false);
        self.source_contract().set(source_contract);
        self.signer().set(signer);
    }

    #[upgrade]
    fn upgrade(&self) {}

    fn validate_signature(
        &self,
        timestamp: u64,
        pool_id: &u32,
        caller: &ManagedAddress,
        signature: ManagedBuffer,
    ) {
        let mut buffer = ManagedBuffer::new();
        let signer = self.signer().get();
        let result = timestamp.dep_encode(&mut buffer);
        require!(result.is_ok(), "Could not encode");
        let result = pool_id.dep_encode(&mut buffer);
        require!(result.is_ok(), "Could not encode");
        buffer.append(&caller.as_managed_buffer());
        self.crypto()
            .verify_ed25519(signer.as_managed_buffer(), &buffer, &signature);
    }

    #[payable("EGLD")]
    #[endpoint(deployRaisePool)]
    fn deploy_raise_pool(
        &self,
        pool_id: u32,
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
        signature: ManagedBuffer,
        timestamp: u64,
        payment_currencies: MultiValueEncoded<MultiValue2<TokenIdentifier, u32>>,
    ) {
        let caller = self.blockchain().get_caller();
        self.validate_signature(timestamp, &pool_id, &caller, signature);
        require!(
            self.blockchain().get_block_timestamp() - (timestamp as u64) < 60,
            "Deploy took too long"
        );
        let signer = self.signer().get();

        let (raise_pool_contract_address, ()) = self
            .raise_pool_proxy()
            .init(
                soft_cap.clone(),
                hard_cap.clone(),
                min_deposit.clone(),
                max_deposit.clone(),
                deposit_increments.clone(),
                start_date,
                end_date,
                refund_enabled,
                platform_fee_wallet.clone(),
                group_fee_wallet.clone(),
                signer,
                payment_currencies.clone(),
            )
            .deploy_from_source(
                &self.source_contract().get(),
                CodeMetadata::UPGRADEABLE | CodeMetadata::READABLE,
            );

        self.address_to_deployer(&raise_pool_contract_address)
            .set(caller);
        self.pool_id_to_address(&pool_id)
            .set(&raise_pool_contract_address);

        self.raise_pool_deployed(
            pool_id,
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
            timestamp,
            payment_currencies,
        );
           
    }

    #[endpoint(setRaisePoolEnabled)]
    fn set_raise_pool_enabled(&self) {
        self.require_caller_has_owner_permissions();
        let _ = self.raise_pool_proxy().enable_pool();
        self.raise_pool_enabled().set(true);
    }

    #[proxy]
    fn raise_pool_proxy(&self) -> raise_pool::Proxy<Self::Api>;

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
    fn pool_id_to_address(&self, pool_id: &u32) -> SingleValueMapper<ManagedAddress>;

    #[view(getSigner)]
    #[storage_mapper("signer")]
    fn signer(&self) -> SingleValueMapper<ManagedAddress>;
}
