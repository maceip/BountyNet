package net.bountynet.app.`data`.local

import androidx.room.InvalidationTracker
import androidx.room.RoomOpenDelegate
import androidx.room.migration.AutoMigrationSpec
import androidx.room.migration.Migration
import androidx.room.util.TableInfo
import androidx.room.util.TableInfo.Companion.read
import androidx.room.util.dropFtsSyncTriggers
import androidx.sqlite.SQLiteConnection
import androidx.sqlite.execSQL
import javax.`annotation`.processing.Generated
import kotlin.Lazy
import kotlin.String
import kotlin.Suppress
import kotlin.collections.List
import kotlin.collections.Map
import kotlin.collections.MutableList
import kotlin.collections.MutableMap
import kotlin.collections.MutableSet
import kotlin.collections.Set
import kotlin.collections.mutableListOf
import kotlin.collections.mutableMapOf
import kotlin.collections.mutableSetOf
import kotlin.reflect.KClass
import net.bountynet.app.`data`.local.dao.BountyDao
import net.bountynet.app.`data`.local.dao.BountyDao_Impl

@Generated(value = ["androidx.room.RoomProcessor"])
@Suppress(names = ["UNCHECKED_CAST", "DEPRECATION", "REDUNDANT_PROJECTION", "REMOVAL"])
public class BountyNetDatabase_Impl : BountyNetDatabase() {
  private val _bountyDao: Lazy<BountyDao> = lazy {
    BountyDao_Impl(this)
  }

  protected override fun createOpenDelegate(): RoomOpenDelegate {
    val _openDelegate: RoomOpenDelegate = object : RoomOpenDelegate(1,
        "1688e86e9d6e1607cf708c29bb6b4c67", "1da8e256bd00d2387eda702dbccac2b3") {
      public override fun createAllTables(connection: SQLiteConnection) {
        connection.execSQL("CREATE TABLE IF NOT EXISTS `cached_bounties` (`id` TEXT NOT NULL, `title` TEXT NOT NULL, `summary` TEXT, `updated_at_epoch_ms` INTEGER NOT NULL, PRIMARY KEY(`id`))")
        connection.execSQL("CREATE TABLE IF NOT EXISTS room_master_table (id INTEGER PRIMARY KEY,identity_hash TEXT)")
        connection.execSQL("INSERT OR REPLACE INTO room_master_table (id,identity_hash) VALUES(42, '1688e86e9d6e1607cf708c29bb6b4c67')")
      }

      public override fun dropAllTables(connection: SQLiteConnection) {
        connection.execSQL("DROP TABLE IF EXISTS `cached_bounties`")
      }

      public override fun onCreate(connection: SQLiteConnection) {
      }

      public override fun onOpen(connection: SQLiteConnection) {
        internalInitInvalidationTracker(connection)
      }

      public override fun onPreMigrate(connection: SQLiteConnection) {
        dropFtsSyncTriggers(connection)
      }

      public override fun onPostMigrate(connection: SQLiteConnection) {
      }

      public override fun onValidateSchema(connection: SQLiteConnection):
          RoomOpenDelegate.ValidationResult {
        val _columnsCachedBounties: MutableMap<String, TableInfo.Column> = mutableMapOf()
        _columnsCachedBounties.put("id", TableInfo.Column("id", "TEXT", true, 1, null,
            TableInfo.CREATED_FROM_ENTITY))
        _columnsCachedBounties.put("title", TableInfo.Column("title", "TEXT", true, 0, null,
            TableInfo.CREATED_FROM_ENTITY))
        _columnsCachedBounties.put("summary", TableInfo.Column("summary", "TEXT", false, 0, null,
            TableInfo.CREATED_FROM_ENTITY))
        _columnsCachedBounties.put("updated_at_epoch_ms", TableInfo.Column("updated_at_epoch_ms",
            "INTEGER", true, 0, null, TableInfo.CREATED_FROM_ENTITY))
        val _foreignKeysCachedBounties: MutableSet<TableInfo.ForeignKey> = mutableSetOf()
        val _indicesCachedBounties: MutableSet<TableInfo.Index> = mutableSetOf()
        val _infoCachedBounties: TableInfo = TableInfo("cached_bounties", _columnsCachedBounties,
            _foreignKeysCachedBounties, _indicesCachedBounties)
        val _existingCachedBounties: TableInfo = read(connection, "cached_bounties")
        if (!_infoCachedBounties.equals(_existingCachedBounties)) {
          return RoomOpenDelegate.ValidationResult(false, """
              |cached_bounties(net.bountynet.app.data.local.entity.CachedBountyEntity).
              | Expected:
              |""".trimMargin() + _infoCachedBounties + """
              |
              | Found:
              |""".trimMargin() + _existingCachedBounties)
        }
        return RoomOpenDelegate.ValidationResult(true, null)
      }
    }
    return _openDelegate
  }

  protected override fun createInvalidationTracker(): InvalidationTracker {
    val _shadowTablesMap: MutableMap<String, String> = mutableMapOf()
    val _viewTables: MutableMap<String, Set<String>> = mutableMapOf()
    return InvalidationTracker(this, _shadowTablesMap, _viewTables, "cached_bounties")
  }

  public override fun clearAllTables() {
    super.performClear(false, "cached_bounties")
  }

  protected override fun getRequiredTypeConverterClasses(): Map<KClass<*>, List<KClass<*>>> {
    val _typeConvertersMap: MutableMap<KClass<*>, List<KClass<*>>> = mutableMapOf()
    _typeConvertersMap.put(BountyDao::class, BountyDao_Impl.getRequiredConverters())
    return _typeConvertersMap
  }

  public override fun getRequiredAutoMigrationSpecClasses(): Set<KClass<out AutoMigrationSpec>> {
    val _autoMigrationSpecsSet: MutableSet<KClass<out AutoMigrationSpec>> = mutableSetOf()
    return _autoMigrationSpecsSet
  }

  public override
      fun createAutoMigrations(autoMigrationSpecs: Map<KClass<out AutoMigrationSpec>, AutoMigrationSpec>):
      List<Migration> {
    val _autoMigrations: MutableList<Migration> = mutableListOf()
    return _autoMigrations
  }

  public override fun bountyDao(): BountyDao = _bountyDao.value
}
