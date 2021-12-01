const {
    TransactionBuilder,
    Server,
    Networks,
    BASE_FEE,
    Operation,
    Asset
} = require('stellar-sdk')

const server = new Server(HORIZON_URL)

module.exports = (body) => {
    const {
        proposalAccount,
        optionIndex
    } = body
    console.log("proposalAccount: ", proposalAccount);

    return 'todo';

}