package net.bountynet.app.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import net.bountynet.app.data.local.dao.BountyDao
import net.bountynet.app.data.local.entity.CachedBountyEntity

@Database(
    entities = [CachedBountyEntity::class],
    version = 1,
    exportSchema = false,
)
abstract class BountyNetDatabase : RoomDatabase() {
    abstract fun bountyDao(): BountyDao

    companion object {
        fun build(context: Context): BountyNetDatabase =
            Room.databaseBuilder(context, BountyNetDatabase::class.java, "bountynet.db")
                .fallbackToDestructiveMigration(dropAllTables = true)
                .build()
    }
}
