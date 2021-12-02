const {
    TransactionBuilder,
    Server,
    Networks,
    BASE_FEE,
    Operation,
    Asset
} = require('stellar-sdk')

const server = new Server(HORIZON_URL)

module.exports = async (body) => {
    const {
    	voterAccountId,
        proposalAccountId,
        optionIndex
    } = body
    console.log("voterAccountId:", voterAccountId);
    console.log("proposalAccountId: ", proposalAccountId);
    console.log("optionIndex: ", optionIndex);

    const fee = await getFee();

    const voterAccount = await server.loadAccount(voterAccountId);
    const proposalAccount = await server.loadAccount(proposalAccountId);

    let transaction = new TransactionBuilder(voterAccountId, {
        fee,
        networkPassphrase: Networks[STELLAR_NETWORK]
    });
    

    return 'todo';

}


function getFee() {
    return server
        .feeStats()
        .then((feeStats) => feeStats?.fee_charged?.max || 100000)
        .catch(() => 100000)
};