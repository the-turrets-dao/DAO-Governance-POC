# POC DAO Governance smart contracts


`> npm install`

`> npm run build`

`if ([webpack-cli] Error: error:0308010C:digital envelope ...) {`
	
	`> export NODE_OPTIONS=--openssl-legacy-provider`

`}`

`> node test-create-proposal.js`

`> node test-close-proposal.js`

`> node test-tally-proposal.js`

`> node test-execute-proposal.js`



## simple test

after running `> npm install` + `> npm run build`:

### create proposal

1. generate a new proposal account (public key + secret seed) in stellar laboratory
2. edit test-create-proposal.js - set generated secret seed of the proposal account as value for the proposalSecret parameter
3. generate a new nonce account in stellar laboratoy. fund it with friendbot and then add the 5 turret signers, set master weight to 0 and all thresholds to 3
4. edit test-create-proposal.js - set the nonce account id as value for the nonceAccountId parameter
5. execute node test-create-proposal.js
6. sign the resulting transaction xdr in stellar laboratory with: seed of proposal account + seed of source account + 3 turret signers seeds (seeds can be found in test-create-proposal.js as test data)
7. send the signed transaction

### vote

1. purchase OPTIONx tokens with test accounts (test data can be found in test-create-proposal.js)

### close proposal

1. edit test-close-proposal.js - set value for proposalAccountId parameter
2. execute node test-create-proposal.js
3. sign the resulting transaction xdr in stellar laboratory with: seed of source account + 3 turret signers seeds (seeds can be found in test-create-proposal.js as test data)
4. send the signed transaction

### tally proposal

1. edit test-tally-proposal.js - set value for proposalAccountId parameter
2. execute node test-tally-proposal.js
3. sign the resulting transaction xdr in stellar laboratory with: seed of source account + 3 turret signers seeds (seeds can be found in test-create-proposal.js as test data)
4. send the signed transaction

### execute proposal
1. edit test-execute-proposal.js - set value for proposalAccountId parameter
2. execute node test-execute-proposal.js3. sign the resulting transaction xdr in stellar laboratory with: 3 turret signers seeds (seeds can be found in test-create-proposal.js as test data)
4. send the signed transaction

## more complex test

use your own dao.toml, proposal data and accounts to test.

## Turret servers running the contract

- https://stellar-turrets-testnet.soneso.workers.dev/tx-functions/695b4a8cc86241b4e9a52422fbe1c4b28c85dbf69ff919ee8f9f6792b6e48564
- https://stellar-turrets-testnet.turretsdao.workers.dev/tx-functions/695b4a8cc86241b4e9a52422fbe1c4b28c85dbf69ff919ee8f9f6792b6e48564