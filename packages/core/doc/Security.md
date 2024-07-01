SRE Security System uses ACLs to determine resource accesses
The ACLHelper provides handy classes and functions to request, check and grant access.

Connectors that require access privileges should extend SecureConnector class
this class provides a function that generates an access token for internal access requests

implemented connector should verify the token before giving access
every access token is for a unique usage

# SRE Security conepts

ACL : an ACL object (TACL type) defines a list of roles with their respective accesses
an access role can be one of the following : Public, Agent, User, Team

...

(WIP)
