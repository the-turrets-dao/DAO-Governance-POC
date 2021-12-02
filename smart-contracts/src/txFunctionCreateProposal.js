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
    const daoPublicKey = "GACRU2RTTFSLDDFGLLDIBLQQG66W52QZPJ3SWVC45YTE5H6K2II4H4CD";
    // end test data

    const fee = await getFee();

    const sourceAccount = await server.loadAccount(source);

    let transaction = new TransactionBuilder(sourceAccount, {
        fee,
        networkPassphrase: Networks[STELLAR_NETWORK]
    });

    // create proposal account
    transaction.addOperation(Operation.createAccount({
        destination: proposalAccountId,
        startingBalance: '1'
    }));

    // create tally account
    transaction.addOperation(Operation.createAccount({
        destination: tallyAccountId,
        startingBalance: '1'
    }));

    // add signers to proposal and tally account: 
    // signers are: proposal turret signers + tally turret signers + dao public key
    // for the tally account also the proposal account should be a signer
    const thresholdsValue = proposalTurretSigners.length * 2;

    for (const tallyTurretSigner of tallyTurretSigners) {

        transaction.addOperation(Operation.setOptions({
            source: proposalAccountId,
            signer: {
                ed25519PublicKey: tallyTurretSigner,
                weight: 2
            }
        }));

        transaction.addOperation(Operation.setOptions({
            source: tallyAccountId,
            signer: {
                ed25519PublicKey: tallyTurretSigner,
                weight: 2
            }
        }));
    }

    for (const proposalTurretSigner of proposalTurretSigners) {

        transaction.addOperation(Operation.setOptions({
            source: proposalAccountId,
            signer: {
                ed25519PublicKey: proposalTurretSigner,
                weight: 2
            }
        }));

        transaction.addOperation(Operation.setOptions({
            source: tallyAccountId,
            signer: {
                ed25519PublicKey: proposalTurretSigner,
                weight: 2
            }
        }));
    }

    // add proposal account as a "zero" signer to the tally account
    transaction.addOperation(Operation.setOptions({
        source: tallyAccountId,
        signer: {
            ed25519PublicKey: proposalAccountId,
            weight: 1
        }
    }));

    // add dao public key as a "zero" signer to the tally account
    // also remove the master key as a signer
    transaction.addOperation(Operation.setOptions({
        source: tallyAccountId,
        signer: {
            ed25519PublicKey: daoPublicKey,
            weight: 1
        },
        masterWeight: 0,
        lowThreshold: thresholdsValue,
        medThreshold: thresholdsValue,
        highThreshold: thresholdsValue
    }));

    // add dao public key as a "zero" signer to the proposal account
    // also remove the master key as a signer
    transaction.addOperation(Operation.setOptions({
        source: proposalAccountId,
        signer: {
            ed25519PublicKey: daoPublicKey,
            weight: 1
        },
        masterWeight: 0,
        lowThreshold: thresholdsValue,
        medThreshold: thresholdsValue,
        highThreshold: thresholdsValue
    }));

    // let tally account trust vote assets issued by proposal account
    const optionAssets = new Array(nrOfOptions);

    for (let i = 0; i < optionAssets.length; i++) {
        transaction.addOperation(Operation.changeTrust({
            source: tallyAccountId,
            asset: new Asset('OPTION' + i, proposalAccountId)
        }));
    }

    // set status of the proposal account
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

    return transaction.setTimeout(0).build().toXDR('base64');

}

function getFee() {
    return server
        .feeStats()
        .then((feeStats) => feeStats?.fee_charged?.max || 100000)
        .catch(() => 100000)
};