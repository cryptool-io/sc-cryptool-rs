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
}
