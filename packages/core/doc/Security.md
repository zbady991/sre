SRE Security System uses ACLs to determine resource accesses
The ACLHelper provides handy classes and functions to request, check and grant access.

Connectors that require access privileges should extend SecureConnector class
this class provides a function that generates an access token for internal access requests

implemented connector should verify the token before giving access
every access token is for a unique usage

# SRE Security conepts

## Access Control List (ACL Object)

ACL : an ACL object (IACL interface) defines a list of roles with their respective accesses
an access role can be one of the following : Public, Agent, User, Team.

The ACL class should be used for all managed access right within SmythOS.

a typical ACL Object looks like this

```json
{
    hashAlgorithm:<hash_algo>,
    entries: {
        agent: {
            "agent-xyz":["owner"],
            "agent-abc":["read", "write"]
        },
        team: {
            "team-xyz": ["read"]
        },
        user: {
            "user-123":["read"],
            "user-456":["read", "write"]
        }
    }
}
```

In the above structure, agent, team and user represent the **Access Roles**, "read", "write", "owner" define **Access Levels**.

There is one more access level called "none" which is set by default when resetting a role access
There is also one more access role called public when used the only allowed id is 'public'
e.g

```json
{
    hashAlgorithm:<hash_algo>,
    entries: {
        agent: {
            "agent-xyz":["owner"],
        },
        public: {
            "public":["read"],
        }
    }
}
```

The hashAlgorithm is used for ACL serialization in order to "hide" the agent, team and user IDs when storing them in an external storage .

ACL class comes with helper function to help you generate the above json format

e.g

```javascript

//Syntax #1
new ACL()
   .addAccess('agent', 'agent-abc', ['read', 'write']);
   .addAccess('team', 'team-abc', "read")
   .addPublicAccess('read') //note that public access should be added using addPublicAccess()

//Syntax #2 (using types, this one is prefered)
new ACL().addAccess(TAccessRole.Agent, "agent-abc", [TAccessLevel.Read, TAccessLevel.Write])
    .addAccess(TAccessRole.Team, "team-abc", TAccessLevel.Read)
    .addPublicAccess(TAccessLevel.Read)

//Both syntaxes generate the following json ACL object
{
    //xxh3 being the default hash algorithm used for ACLs
    hashAlgorithm:'xxh3',
    entries: {
        agent: {
            "agent-abc":["read", "write"],
        },
        team: {
            "team-abc":["read"],
        },
        public: {
            "public":["read"],
        }
    }
}

```

## Access Candidate

The **AccessCandidate** object is used to make an access request when trying to perform an operation on a resource.
The AccessCandidate structure is this

```javascript
//Type Definition
interface IAccessCandidate {
    role: TAccessRole;
    id: string;
}
//e.g
{
    role:"agent",
    id:"agent-abc"
}

```

in SmythOS security context a candidate can represent an agent, a user, a team or "public"

## Access Request

The **AccessRequest** object is used to check a candidate access to a given resource.
The object is defined as follow

```javascript
//Type Definition
interface IAccessRequest {
    id: string; //unique request ID
    resourceId: string; //the resource we're trying to access
    candidate: IAccessCandidate; //the candidate object
    level: TAccessLevel | TAccessLevel[]; //the requested access level
}
```

The ACL class provides checkExactAccess() method that verifies an access request and grand or deny it.

> **Note** : checkExactAccess() as its name suggest will check the exact access right. For example, if the access request requires read access for a given user, and that user is an owner, checkExactAccess() will not grant the access, for this we will use specific implementations that will check variants of the original request in order to handle higher level accesses.

## Using AccessCandidate, AccessRequest and ACL.checkExactAccess()

AccessCandidate and AccessRequest provide helper functions to simplify generating requests

```javascript
//Creating an AccessCandidate Object
const agentCandidate = AccessCandidate.agent('agent-abc'); //this creates a Candidate object for role "agent" with id "agent-abc"

const userCandidate = AccessCandidate.user('user-1234');

//Creating an AccessRequest Object requesting read access for candidate "agent-abc"
//syntax #1
const agentWriteRequest = new AccessRequest(agentCandidate).setLevel(TAccessLevel.Write).resource('my-file-id123456');

//syntax #2
const agentWriteRequest = agentCandidate.writeRequest.resource('my-file-id123456');

//an access request can also clone another existing request
//e.g here we clone the above request and change the access level
const agentReadRequest = AccessRequest.clone(agentRequest).setLevel(TAccessLevel.Read);

//e.g here we clone the request and we change the candidate
const userWriteRequest = AccessRequest.clone(agentRequest).setCandidate(userCandidate);

//here we create an ACL and we'll check the different requests above
const acl = new ACL().addAccess(TAccessRole.agent, 'agent-abc', TAccessLevel.Write);

acl.checkExactAccess(agentWriteRequest); //true
acl.checkExactAccess(agentReadRequest); //false  ==> requested level is Write but ACL only accepts Read
acl.checkExactAccess(userWriteRequest); //false  ==> wrong candidate)
```

(WIP)
