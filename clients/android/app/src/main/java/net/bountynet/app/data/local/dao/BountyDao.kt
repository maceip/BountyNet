package net.bountynet.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow
import net.bountynet.app.data.local.entity.CachedBountyEntity

@Dao
interface BountyDao {
    @Query("SELECT * FROM cached_bounties ORDER BY updated_at_epoch_ms DESC")
    fun observeAll(): Flow<List<CachedBountyEntity>>

    @Query("SELECT * FROM cached_bounties ORDER BY updated_at_epoch_ms DESC")
    suspend fun getAll(): List<CachedBountyEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(items: List<CachedBountyEntity>)

    @Query("DELETE FROM cached_bounties")
    suspend fun clear()
}
