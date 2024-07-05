#![no_std]

#[allow(unused_imports)]
use multiversx_sc::imports::*;
use permissions_module::Permissions;
use raise_pool::ProxyTrait as _;
mod events;

pub const DEFAULT_DECIMALS: u32 = 18;
pub const ALLOWED_TIMESTAMP_DELAY: u64 = 90;

#[multiversx_sc::contract]
pub trait Factory:
    permissions_module::PermissionsModule + pausable::PausableModule + events::EventsModule
{
    #[init]
    fn init(
        &self,
        source_contract: ManagedAddress,
        signer: ManagedAddress,
        payment_currencies: MultiValueEncoded<MultiValue2<TokenIdentifier, u32>>,
    ) {
        let all_permissions = Permissions::OWNER | Permissions::ADMIN | Permissions::PAUSE;
        self.set_permissions(self.blockchain().get_caller(), all_permissions);
        self.raise_pool_enabled().set(false);
        self.source_contract().set(source_contract);
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
        currencies: MultiValueEncoded<TokenIdentifier>,
    ) {
        let caller = self.blockchain().get_caller();
        self.validate_signature(timestamp, &pool_id, &caller, signature);
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

        let (raise_pool_contract_address, ()) = self
            .raise_pool_proxy()
            .init(
                &caller,
                pool_id,
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
                &raise_pool_currencies,
            )
            .deploy_from_source(
                &self.source_contract().get(),
                CodeMetadata::UPGRADEABLE | CodeMetadata::READABLE,
            );

        self.address_to_deployer(&raise_pool_contract_address)
            .set(caller);
        self.pool_id_to_address(&pool_id)
            .set(&raise_pool_contract_address);

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
    fn enable_raise_pool(&self, pool_id: u32) {
        require!(
            !self.pool_id_to_address(&pool_id).is_empty(),
            "Pool not deployed"
        );
        self.require_caller_has_owner_permissions();
        self.tx()
            .to(self.pool_id_to_address(&pool_id).get())
            .raw_call("enableRaisePool")
            .async_call_and_exit();
    }

    #[proxy]
    fn raise_pool_proxy(&self) -> raise_pool::Proxy<Self::Api>;

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

    // Storage

    #[view(getSourceContract)]
    #[storage_mapper("source_contract")]
    fn source_contract(&self) -> SingleValueMapper<ManagedAddress>;

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
    fn pool_id_to_address(&self, pool_id: &u32) -> SingleValueMapper<ManagedAddress>;

    #[view(getSigner)]
    #[storage_mapper("signer")]
    fn signer(&self) -> SingleValueMapper<ManagedAddress>;
}
