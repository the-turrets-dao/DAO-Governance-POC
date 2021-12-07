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

1. generate a new account (public key + secret seed) in stellar laboratory
2. edit test-create-proposal.js - set generated secret seed value for the proposalSecret parameter
3. execute node test-create-proposal.js
4. sign the resulting transaction xdr in stellar laboratory with: seed of proposal account + seed of source account + 3 turret signers seeds (seeds can be found in test-create-proposal.js as test data)
5. send the signed transaction

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