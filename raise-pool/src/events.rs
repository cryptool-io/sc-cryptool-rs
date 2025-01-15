multiversx_sc::imports!();
multiversx_sc::derive_imports!();

#[multiversx_sc::module]
pub trait EventsModule {
    #[event("depositEvent")]
    fn deposited_event(
        self,
        #[indexed] pool_id: ManagedBuffer,
        #[indexed] deposit_id: ManagedBuffer,
        #[indexed] caller: ManagedAddress,
        #[indexed] token: TokenIdentifier,
        #[indexed] amount: BigUint,
        #[indexed] platform_fee: BigUint,
        #[indexed] group_fee: BigUint,
        #[indexed] user_ambassador_fee: Option<BigUint>,
        #[indexed] user_ambassador: Option<ManagedAddress>,
        #[indexed] group_ambassador_fee: Option<BigUint>,
        #[indexed] group_ambassador: Option<ManagedAddress>,
    );

    #[event("changeTimestampEvent")]
    fn changed_timestamp_event(
        self,
        #[indexed] pool_id: ManagedBuffer,
        #[indexed] new_start_date: u64,
        #[indexed] new_end_date: u64,
        #[indexed] new_refund_deadline: u64,
    );
}
