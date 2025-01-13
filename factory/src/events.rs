multiversx_sc::imports!();
multiversx_sc::derive_imports!();

#[multiversx_sc::module]
pub trait EventsModule {
    #[event("raisePoolDeployedEvent")]
    fn raise_pool_deployed_event(
        self,
        #[indexed] pool_id: ManagedBuffer,
        #[indexed] soft_cap: BigUint,
        #[indexed] hard_cap: BigUint,
        #[indexed] min_deposit: BigUint,
        #[indexed] max_deposit: BigUint,
        #[indexed] deposit_increments: BigUint,
        #[indexed] start_date: u64,
        #[indexed] end_date: u64,
        #[indexed] refund_enabled: bool,
        #[indexed] platform_fee_wallet: ManagedAddress,
        #[indexed] group_fee_wallet: ManagedAddress,
        #[indexed] timestamp: u64,
        #[indexed] payment_network_id: ManagedBuffer,
        #[indexed] payment_currencies: MultiValueEncoded<MultiValue2<TokenIdentifier, u32>>,
    );
}
