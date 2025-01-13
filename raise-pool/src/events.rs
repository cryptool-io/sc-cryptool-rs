multiversx_sc::imports!();
multiversx_sc::derive_imports!();

#[multiversx_sc::module]
pub trait EventsModule {
    #[event("depositEvent")]
    fn deposited_event(
        self,
        #[indexed] pool_id: ManagedBuffer,
        #[indexed] deposit_id: ManagedBuffer,
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
