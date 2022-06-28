# Totem Token

This repo contains main 2 contracts.

1. TotemToken: ERC 20 with a bridge role that allows to mint an burn tokens, and an upgrade mechanism for the bridge address that introduces a grace period to enable users to unexpose themselves in case they disagree with the update.
2. TotemCrowdsale: ICO that enables to buy with stable coins authorized by the owner, and to choose a vesting period with a specific amount of unlocking times.

The code is thorougly commented.

## Environment

Truffle has been used for that project. It is recommended that you make any truffle command call with `npx truffle` to use the correct truffle version.

Make sure you rename `.env.example` to `.env` and fill its fields.

## Install packages

```
npm i
```

## Run tests

```
npm test
```

Remove migrations files if issues arise (specifically 2_crowdsale.js).

## Gas consumption report

Uncomment the reporter line in the truffle-config.js file to get report on gas consumption after tests

## Get test coverage

```
npm run coverage
```

## Verify contracts

```
npx truffle run verify <CONTRACT NAME> --network <NETWORK NAME>
```

```
./scripts/verify.sh
```

## Static security check

```
slither --truffle-version truffle@5.2.4 .
```
