const {
    TransactionBuilder,
    Server,
    Networks,
    BASE_FEE,
    Keypair,
    Operation,
    Asset
} = require('stellar-sdk')

const server = new Server(HORIZON_URL)

module.exports = async (body) => {
    const {
        source,
        daoToml,
        proposalSecret,
        tallySecret,
        tallyContractSigners,
        proposalContractSigners,
        IpfsProposalAddr
    } = body

    console.log("source: ", source);

    const proposalKeypair = Keypair.fromSecret(proposalSecret);
    const proposalAccountId = proposalKeypair.publicKey();

    const tallyKeypair = Keypair.fromSecret(tallySecret);
    const tallyAccountId = tallyKeypair.publicKey();
    const tallyTurretSigners = tallyContractSigners.split(',').map(function(item) {
        return item.trim();
    });;

    if (tallyTurretSigners.length < 3) {
        throw {
            message: 'Not enough tally turret contract signers.'
        }
    }

    const proposalTurretSigners = proposalContractSigners.split(',').map(function(item) {
        return item.trim();
    });;

    if (proposalTurretSigners.length < 3) {
        throw {
            message: 'Not enough proposal turret contract signers.'
        }
    }

    if (tallyTurretSigners.length != proposalTurretSigners.length) {
        throw {
            message: 'Number of proposal turret contract signers and tally turret contract signers must be the same.'
        }
    }

    // test data
    const nrOfOptions = 4;

    // end test data

    const nrOfSigners = proposalTurretSigners.length;

    const fee = await getFee();

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

    for (const tallyTurretSigner of tallyTurretSigners) {
        transaction.addOperation(Operation.setOptions({
            source: proposalAccountId,
            signer: {
                ed25519PublicKey: tallyTurretSigner,
                weight: 1
            }
        }));

        transaction.addOperation(Operation.setOptions({
            source: tallyAccountId,
            signer: {
                ed25519PublicKey: tallyTurretSigner,
                weight: 1
            }
        }));
    }

    for (const proposalTurretSigner of proposalTurretSigners) {
        transaction.addOperation(Operation.setOptions({
            source: proposalAccountId,
            signer: {
                ed25519PublicKey: proposalTurretSigner,
                weight: 1
            }
        }));

        transaction.addOperation(Operation.setOptions({
            source: tallyAccountId,
            signer: {
                ed25519PublicKey: proposalTurretSigner,
                weight: 1
            }
        }));
    }

    transaction.addOperation(Operation.setOptions({
        source: proposalAccountId,
        masterWeight: 0,
        lowThreshold: nrOfSigners,
        medThreshold: nrOfSigners,
        highThreshold: nrOfSigners
    }));

    transaction.addOperation(Operation.setOptions({
        source: tallyAccountId,
        masterWeight: 0,
        lowThreshold: nrOfSigners,
        medThreshold: nrOfSigners,
        highThreshold: nrOfSigners
    }));

    transaction.addOperation(Operation.manageData({
        source: proposalAccountId,
        name: "status",
        value: "active"
    }));

    transaction.addOperation(Operation.manageData({
        source: proposalAccountId,
        name: "createTime",
        value: "" + Math.floor(Date.now() / 1000)
    }));

    const optionAssets = new Array(nrOfOptions);

    for (let i = 0; i < optionAssets.length; i++) {
        transaction.addOperation(Operation.changeTrust({
            source: tallyAccountId,
            asset: new Asset('OPTION' + i, proposalAccountId)
        }));
    }


    return transaction.setTimeout(0).build().toXDR('base64');

}

function getFee() {
    return server
        .feeStats()
        .then((feeStats) => feeStats?.fee_charged?.max || 100000)
        .catch(() => 100000)
};