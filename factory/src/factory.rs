#![no_std]

#[allow(unused_imports)]
use multiversx_sc::imports::*;
use permissions_module::Permissions;
use raise_pool::helper::ProxyTrait as _;
use raise_pool::ProxyTrait as _;
mod events;
mod storage;

pub const DEFAULT_DECIMALS: u32 = 18;
pub const ALLOWED_TIMESTAMP_DELAY: u64 = 90;

#[multiversx_sc::contract]
pub trait Factory:
    permissions_module::PermissionsModule
    + pausable::PausableModule
    + events::EventsModule
    + crate::storage::StorageModule
{
    #[init]
    fn init(
        &self,
        source_raise_contract: ManagedAddress,
        wallet_database_address: ManagedAddress,
        signer: ManagedAddress,
        payment_currencies: MultiValueEncoded<MultiValue2<TokenIdentifier, u32>>,
    ) {
        let all_permissions = Permissions::OWNER | Permissions::ADMIN | Permissions::PAUSE;
        self.set_permissions(self.blockchain().get_caller(), all_permissions);
        self.raise_pool_enabled().set(false);
        self.source_raise_contract().set(source_raise_contract);
        self.wallet_database_address().set(wallet_database_address);
        self.signer().set(signer);
        for payment_currency in payment_currencies {
            let (currency, decimals) = payment_currency.into_tuple();
            require!(
                decimals <= DEFAULT_DECIMALS,
                "Maximum decimals number is 18"
            );
            self.payment_currencies().insert(currency.clone());
            self.currency_decimals(&currency).set(decimals);
        }
    }

    #[upgrade]
    fn upgrade(&self) {}

    #[endpoint(deployRaisePool)]
    fn deploy_raise_pool(
        &self,
        pool_id: ManagedBuffer,
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
        currencies: MultiValueEncoded<TokenIdentifier>,
    ) {
        let caller = self.blockchain().get_caller();
        self.validate_signature(timestamp, &pool_id, &caller, signature);
        require!(
            !self.pool_ids().contains(&pool_id),
            "Pool ID already exists"
        );
        require!(
            timestamp <= self.blockchain().get_block_timestamp(),
            "Timestamp provided by backend set in the future"
        );
        require!(
            self.blockchain().get_block_timestamp() - timestamp < ALLOWED_TIMESTAMP_DELAY,
            "Deploy took too long"
        );
        let mut raise_pool_currencies = MultiValueEncoded::new();
        for currency in currencies {
            require!(
                self.payment_currencies().contains(&currency),
                "One of the currencies is not whitelisted"
            );
            let decimals = self.currency_decimals(&currency).get();
            let mv2 = MultiValue2((currency, decimals));
            raise_pool_currencies.push(mv2);
        }

        let signer = self.signer().get();
        let wallet_database_address = self.wallet_database_address().get();

        let (raise_pool_contract_address, ()) = self
            .raise_pool_proxy()
            .init(
                &caller,
                pool_id.clone(),
                &soft_cap,
                &hard_cap,
                &min_deposit,
                &max_deposit,
                &deposit_increments,
                start_date,
                end_date,
                refund_enabled,
                &platform_fee_wallet,
                &group_fee_wallet,
                signer,
                wallet_database_address,
                &raise_pool_currencies,
            )
            .deploy_from_source(
                &self.source_raise_contract().get(),
                CodeMetadata::UPGRADEABLE | CodeMetadata::READABLE,
            );

        self.address_to_deployer(&raise_pool_contract_address)
            .set(caller);
        self.pool_id_to_address(&pool_id)
            .set(&raise_pool_contract_address);
        self.pool_ids().insert(pool_id.clone());
        self.raise_pool_deployed_event(
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
            raise_pool_currencies,
        );
    }

    #[endpoint(enableRaisePool)]
    fn enable_raise_pool(
        &self,
        timestamp: u64,
        pool_id: ManagedBuffer,
        signature: ManagedBuffer,
        value: bool,
    ) {
        require!(
            !self.pool_id_to_address(&pool_id).is_empty(),
            "Pool not deployed"
        );
        self.require_caller_has_owner_permissions();
        let caller = self.blockchain().get_caller();
        self.validate_signature(timestamp, &pool_id, &caller, signature);
        self.raise_pool_address_proxy(self.pool_id_to_address(&pool_id).get())
            .enable_raise_pool(value)
            .execute_on_dest_context::<()>();
    }

    fn validate_signature(
        &self,
        timestamp: u64,
        pool_id: &ManagedBuffer,
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

    #[proxy]
    fn raise_pool_proxy(&self) -> raise_pool::Proxy<Self::Api>;

    #[proxy]
    fn raise_pool_address_proxy(
        &self,
        callee_sc_address: ManagedAddress,
    ) -> raise_pool::Proxy<Self::Api>;
}
