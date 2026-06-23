---
name: FleetWatch bcrypt seeding
description: How to correctly generate bcrypt hashes for seeding users in this project
---

Never use pre-computed hashes from documentation examples (e.g. Laravel's `$2b$10$92IXU...` which is "password" not "123456"). They will fail silently in the DB and cause `bcrypt.compare` to return false.

**Why:** The seed code_execution sandbox can't directly import bcrypt (native addon). Pre-computed hashes from online examples are for different passwords.

**How to apply:** Always generate the hash at seed time using:
```
pnpm --filter @workspace/api-server exec node -e "const bcrypt = require('bcrypt'); bcrypt.hash('yourpassword', 10).then(h => console.log(h));"
```
Then paste the output into the SQL UPDATE/INSERT.
