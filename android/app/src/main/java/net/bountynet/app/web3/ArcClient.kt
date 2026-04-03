package net.bountynet.app.web3

import org.web3j.protocol.Web3j
import org.web3j.protocol.http.HttpService

object ArcClient {
    private const val ARC_RPC = "https://rpc.testnet.arc.network"

    val web3j: Web3j by lazy {
        Web3j.build(HttpService(ARC_RPC))
    }

    suspend fun getBlockNumber(): Long {
        return web3j.ethBlockNumber().send().blockNumber.toLong()
    }
}
