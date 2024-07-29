multiversx_sc::imports!();
multiversx_sc::derive_imports!();

use crate::helpers;
use helpers::Tier;

#[multiversx_sc::module]
pub trait StorageModule {
    #[view(getTokenId)]
    #[storage_mapper("token_id")]
    fn token_id(&self) -> SingleValueMapper<TokenIdentifier>;

    #[view(getStartTimestamp)]
    #[storage_mapper("start_timestamp")]
    fn start_timestamp(&self) -> SingleValueMapper<u64>;

    #[view(getEndTimestamp)]
    #[storage_mapper("end_timestamp")]
    fn end_timestamp(&self) -> SingleValueMapper<u64>;

    #[view(getWallatDatabaseAddress)]
    #[storage_mapper("wallet_database_address")]
    fn wallet_database_address(&self) -> SingleValueMapper<ManagedAddress>;

    #[view(getTotalRewards)]
    #[storage_mapper("total_rewards")]
    fn total_rewards(&self) -> SingleValueMapper<BigUint>;

    #[view(getTotalFees)]
    #[storage_mapper("total_fees")]
    fn total_fees(&self) -> SingleValueMapper<BigUint>;

    #[view(getRewardsPerBlock)]
    #[storage_mapper("rewards_per_block")]
    fn rewards_per_block(&self) -> SingleValueMapper<BigUint>;

    #[view(getTotalAmountStaked)]
    #[storage_mapper("total_amount_staked")]
    fn total_amount_staked(&self) -> SingleValueMapper<BigUint>;

    #[view(getWalletAmountStaked)]
    #[storage_mapper("wallet_amount_staked")]
    fn wallet_amount_staked(&self, wallet: &ManagedAddress) -> SingleValueMapper<BigUint>;

    #[view(getWalletPerTierAmountStaked)]
    #[storage_mapper("wallet_per_tier_amount_staked")]
    fn wallet_per_tier_amount_staked(
        &self,
        wallet: &ManagedAddress,
        tier: &Tier,
    ) -> SingleValueMapper<BigUint>;

    #[view(getWalletPerTierUpdatedBlock)]
    #[storage_mapper("wallet_per_tier_update_block")]
    fn wallet_per_tier_update_block(
        &self,
        wallet: &ManagedAddress,
        tier: &Tier,
    ) -> SingleValueMapper<u64>;

    #[view(getWalletLastRewardPerShare)]
    #[storage_mapper("wallet_rewards_per_share")]
    fn wallet_rewards_per_share(&self, wallet: &ManagedAddress) -> SingleValueMapper<BigUint>;

    #[view(getWalletPendingRewards)]
    #[storage_mapper("wallet_pending_rewards")]
    fn wallet_pending_rewards(&self, wallet: &ManagedAddress) -> SingleValueMapper<BigUint>;

    #[view(getRewadsPerShare)]
    #[storage_mapper("rewards_per_share")]
    fn rewards_per_share(&self) -> SingleValueMapper<BigUint>;

    #[view(getLastUpdateBlock)]
    #[storage_mapper("last_update_block")]
    fn last_update_block(&self) -> SingleValueMapper<u64>;

    #[view(getDivisionSafetyConstant)]
    #[storage_mapper("division_safety_constant")]
    fn division_safety_constant(&self) -> SingleValueMapper<BigUint>;

    #[view(isProduceRewardsEnabled)]
    #[storage_mapper("produce_rewards_enabled")]
    fn produce_rewards_enabled(&self) -> SingleValueMapper<bool>;
}
