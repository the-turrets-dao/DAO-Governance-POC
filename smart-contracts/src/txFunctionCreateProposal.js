const {
    TransactionBuilder,
    Server,
    Networks,
    BASE_FEE,
    Keypair,
    Operation
} = require('stellar-sdk')

const server = new Server(HORIZON_URL)

module.exports = async (body) => {
    const {
        source,
        daoToml,
        proposalSecret,
        tallySecret,
        tallyContractSigners,
        IpfsProposalAddr
    } = body

    console.log("source: ", source);

    const proposalKeypair = Keypair.fromSecret(proposalSecret);
    const tallyKeypair = Keypair.fromSecret(tallySecret);
    const proposalAccountId = proposalKeypair.publicKey();
    const tallyAccountId = tallyKeypair.publicKey();

    console.log("proposalAccountId: ", proposalAccountId);
    console.log("tallyAccountId: ", tallyAccountId);

    const fee = await getFee();
    console.log("fee: ", fee);

    const sourceAccount = await server.loadAccount(source);

    let transaction = new TransactionBuilder(sourceAccount, {
        fee,
        networkPassphrase: Networks[STELLAR_NETWORK]
    });

    transaction.addOperation(Operation.createAccount({
        destination: proposalAccountId,
        startingBalance: '1'
    }));

    transaction.addOperation(Operation.createAccount({
        destination: tallyAccountId,
        startingBalance: '1'
    }));

    return transaction.setTimeout(0).build().toXDR('base64');

}

function getFee() {
    return server
        .feeStats()
        .then((feeStats) => feeStats?.fee_charged?.max || 100000)
        .catch(() => 100000)
};