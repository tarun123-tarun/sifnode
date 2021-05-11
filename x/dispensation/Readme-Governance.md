### Governance proposal to execute claims 

## Current flow 
- create claims through this api (on chain) 
  
On friday
- Run a query to get all claims / Keep reading the events emitted from create_claim
- This is list is an input for a function (This function is off-chain and not part of this module) which iterates over the list and creates a json which the dispensation module can use.
- Run a dispensation of type Liquidity Mining or Validator Subsidy .
- After running the above the transfers happen over the next few blocks (10 per block) . An external function (Not part of this module).Reads these events and resets user multipliers accordingly.

## Governance Flow

- Create claims through this api (on chain) . ( allow them to delete these claims as well ?)
- We raise a governance proposal to execute rewards distribution ( The way its being done right now for upgrades )
- Validators vote on this proposal .
- If we get 67% consent , all the above claims get locked. [We can add a maximum height at which the request expires.]
- Locked claims cannot be deleted , these claims would only deleted when the dispensation happens.

After proposal success 
- Keep reading the events emitted from create_claim .[A successful gov proposal will trigger an event ,which would be the cue for the external api to start collecting user rewards data]
- This is list is an input for a function (This function is off-chain and not part of this module) which iterates over the list and creates a json which the dispensation module can use.
- Run a dispensation of type Liquidity Mining or Validator Subsidy .
- After running the above the transfers happen over the next few blocks (10 per block) . An external function (Not part of this module).Reads these events and resets user multipliers accordingly.
