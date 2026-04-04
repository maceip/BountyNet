package net.bountynet.app.`data`.local.dao

import androidx.room.EntityInsertAdapter
import androidx.room.RoomDatabase
import androidx.room.coroutines.createFlow
import androidx.room.util.getColumnIndexOrThrow
import androidx.room.util.performSuspending
import androidx.sqlite.SQLiteStatement
import javax.`annotation`.processing.Generated
import kotlin.Int
import kotlin.Long
import kotlin.String
import kotlin.Suppress
import kotlin.Unit
import kotlin.collections.List
import kotlin.collections.MutableList
import kotlin.collections.mutableListOf
import kotlin.reflect.KClass
import kotlinx.coroutines.flow.Flow
import net.bountynet.app.`data`.local.entity.CachedBountyEntity

@Generated(value = ["androidx.room.RoomProcessor"])
@Suppress(names = ["UNCHECKED_CAST", "DEPRECATION", "REDUNDANT_PROJECTION", "REMOVAL"])
public class BountyDao_Impl(
  __db: RoomDatabase,
) : BountyDao {
  private val __db: RoomDatabase

  private val __insertAdapterOfCachedBountyEntity: EntityInsertAdapter<CachedBountyEntity>
  init {
    this.__db = __db
    this.__insertAdapterOfCachedBountyEntity = object : EntityInsertAdapter<CachedBountyEntity>() {
      protected override fun createQuery(): String =
          "INSERT OR REPLACE INTO `cached_bounties` (`id`,`title`,`summary`,`updated_at_epoch_ms`) VALUES (?,?,?,?)"

      protected override fun bind(statement: SQLiteStatement, entity: CachedBountyEntity) {
        statement.bindText(1, entity.id)
        statement.bindText(2, entity.title)
        val _tmpSummary: String? = entity.summary
        if (_tmpSummary == null) {
          statement.bindNull(3)
        } else {
          statement.bindText(3, _tmpSummary)
        }
        statement.bindLong(4, entity.updatedAtEpochMs)
      }
    }
  }

  public override suspend fun upsertAll(items: List<CachedBountyEntity>): Unit =
      performSuspending(__db, false, true) { _connection ->
    __insertAdapterOfCachedBountyEntity.insert(_connection, items)
  }

  public override fun observeAll(): Flow<List<CachedBountyEntity>> {
    val _sql: String = "SELECT * FROM cached_bounties ORDER BY updated_at_epoch_ms DESC"
    return createFlow(__db, false, arrayOf("cached_bounties")) { _connection ->
      val _stmt: SQLiteStatement = _connection.prepare(_sql)
      try {
        val _columnIndexOfId: Int = getColumnIndexOrThrow(_stmt, "id")
        val _columnIndexOfTitle: Int = getColumnIndexOrThrow(_stmt, "title")
        val _columnIndexOfSummary: Int = getColumnIndexOrThrow(_stmt, "summary")
        val _columnIndexOfUpdatedAtEpochMs: Int = getColumnIndexOrThrow(_stmt,
            "updated_at_epoch_ms")
        val _result: MutableList<CachedBountyEntity> = mutableListOf()
        while (_stmt.step()) {
          val _item: CachedBountyEntity
          val _tmpId: String
          _tmpId = _stmt.getText(_columnIndexOfId)
          val _tmpTitle: String
          _tmpTitle = _stmt.getText(_columnIndexOfTitle)
          val _tmpSummary: String?
          if (_stmt.isNull(_columnIndexOfSummary)) {
            _tmpSummary = null
          } else {
            _tmpSummary = _stmt.getText(_columnIndexOfSummary)
          }
          val _tmpUpdatedAtEpochMs: Long
          _tmpUpdatedAtEpochMs = _stmt.getLong(_columnIndexOfUpdatedAtEpochMs)
          _item = CachedBountyEntity(_tmpId,_tmpTitle,_tmpSummary,_tmpUpdatedAtEpochMs)
          _result.add(_item)
        }
        _result
      } finally {
        _stmt.close()
      }
    }
  }

  public override suspend fun getAll(): List<CachedBountyEntity> {
    val _sql: String = "SELECT * FROM cached_bounties ORDER BY updated_at_epoch_ms DESC"
    return performSuspending(__db, true, false) { _connection ->
      val _stmt: SQLiteStatement = _connection.prepare(_sql)
      try {
        val _columnIndexOfId: Int = getColumnIndexOrThrow(_stmt, "id")
        val _columnIndexOfTitle: Int = getColumnIndexOrThrow(_stmt, "title")
        val _columnIndexOfSummary: Int = getColumnIndexOrThrow(_stmt, "summary")
        val _columnIndexOfUpdatedAtEpochMs: Int = getColumnIndexOrThrow(_stmt,
            "updated_at_epoch_ms")
        val _result: MutableList<CachedBountyEntity> = mutableListOf()
        while (_stmt.step()) {
          val _item: CachedBountyEntity
          val _tmpId: String
          _tmpId = _stmt.getText(_columnIndexOfId)
          val _tmpTitle: String
          _tmpTitle = _stmt.getText(_columnIndexOfTitle)
          val _tmpSummary: String?
          if (_stmt.isNull(_columnIndexOfSummary)) {
            _tmpSummary = null
          } else {
            _tmpSummary = _stmt.getText(_columnIndexOfSummary)
          }
          val _tmpUpdatedAtEpochMs: Long
          _tmpUpdatedAtEpochMs = _stmt.getLong(_columnIndexOfUpdatedAtEpochMs)
          _item = CachedBountyEntity(_tmpId,_tmpTitle,_tmpSummary,_tmpUpdatedAtEpochMs)
          _result.add(_item)
        }
        _result
      } finally {
        _stmt.close()
      }
    }
  }

  public override suspend fun clear() {
    val _sql: String = "DELETE FROM cached_bounties"
    return performSuspending(__db, false, true) { _connection ->
      val _stmt: SQLiteStatement = _connection.prepare(_sql)
      try {
        _stmt.step()
      } finally {
        _stmt.close()
      }
    }
  }

  public companion object {
    public fun getRequiredConverters(): List<KClass<*>> = emptyList()
  }
}
