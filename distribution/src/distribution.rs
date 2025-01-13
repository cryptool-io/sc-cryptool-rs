#![no_std]

#[allow(unused_imports)]
use multiversx_sc::imports::*;

pub const ALLOWED_TIMESTAMP_DELAY: u64 = 90;

#[multiversx_sc::contract]
pub trait Distribution {
    #[init]
    fn init(&self, platform_fee_wallet: ManagedAddress, signer: ManagedAddress) {
        self.platform_fee_wallet().set(&platform_fee_wallet);
        self.signer().set(&signer);
    }

    #[upgrade]
    fn upgrade(&self) {}

    #[payable("*")]
    #[endpoint(distribute)]
    fn distribute(
        &self,
        pool_id: ManagedBuffer,
        batch_id: u32,
        timestamp: u64,
        signature: ManagedBuffer,
        distribute_data: MultiValueEncoded<MultiValue2<ManagedAddress, BigUint>>,
    ) {
        self.validate_batch(&pool_id, &batch_id);
        require!(
            timestamp <= self.blockchain().get_block_timestamp(),
            "Invalid timestamp",
        );
        require!(
            self.blockchain().get_block_timestamp() - timestamp < ALLOWED_TIMESTAMP_DELAY,
            "Deposit took too long"
        );
        self.validate_distibute_call(
            &pool_id,
            &batch_id,
            timestamp,
            signature,
            self.signer().get(),
        );

        let payments = self.call_value().all_esdt_transfers();
        require!(
            payments.len() == 2,
            "Two payments are expected, one for EGLD and one for ESDT"
        );
        let mut payments_iter = payments.iter();
        let egld_payment = payments_iter.next();
        let esdt_payment = payments_iter.next();

        let (egld_token, _, egld_amount) = egld_payment.unwrap().into_tuple();
        require!(
            egld_token.ticker() == ManagedBuffer::from("EGLD"),
            "First token should be EGLD"
        );
        self.send()
            .direct_egld(&self.platform_fee_wallet().get(), &egld_amount);

        let (token, _, _) = esdt_payment.unwrap().into_tuple();
        for record in distribute_data {
            let (address, amount) = record.into_tuple();
            self.send().direct_esdt(&address, &token, 0, &amount);
        }

        self.successful_distribution_event(pool_id, batch_id);
    }

    fn validate_distibute_call(
        &self,
        pool_id: &ManagedBuffer,
        batch_id: &u32,
        timestamp: u64,
        signature: ManagedBuffer,
        signer: ManagedAddress,
    ) {
        let caller = self.blockchain().get_caller();
        let mut buffer = ManagedBuffer::new();
        let result = timestamp.dep_encode(&mut buffer);
        require!(result.is_ok(), "Could not encode");
        let result = pool_id.dep_encode(&mut buffer);
        require!(result.is_ok(), "Could not encode");
        let result = batch_id.dep_encode(&mut buffer);
        require!(result.is_ok(), "Could not encode");
        buffer.append(caller.as_managed_buffer());

        self.crypto()
            .verify_ed25519(signer.as_managed_buffer(), &buffer, &signature);
    }

    fn validate_batch(&self, pool_id: &ManagedBuffer, batch_id: &u32) {
        require!(
            self.batch_id(pool_id).get() == *batch_id,
            "Invalid batch id"
        );
        self.batch_id(pool_id).update(|current| *current += 1);
    }

    #[event("successfulDistribution")]
    fn successful_distribution_event(
        &self,
        #[indexed] pool_id: ManagedBuffer,
        #[indexed] batch_id: u32,
    );

    #[view(getSigner)]
    #[storage_mapper("signer")]
    fn signer(&self) -> SingleValueMapper<ManagedAddress>;

    #[view(getPlatfromFeeWallet)]
    #[storage_mapper("platform_fee_wallet")]
    fn platform_fee_wallet(&self) -> SingleValueMapper<ManagedAddress>;

    #[view(getBatchId)]
    #[storage_mapper("batch_id")]
    fn batch_id(&self, pool_id: &ManagedBuffer) -> SingleValueMapper<u32>;
}
