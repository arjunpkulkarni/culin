# CulinAI DB — dev access

## Connection values

| Field | Value |
|---|---|
| **Host** | `culinai-db.csn2c4yowuvc.us-east-1.rds.amazonaws.com` |
| **Port** | `5432` |
| **Database** | `culinAI_DB` |
| **User** | `culinAI_DB` |
| **Password** | ask Arjun (1Password / shared vault) |
| **SSL** | required (`sslmode=require`) |
| **AWS region** | `us-east-1` |
| **Security Group** | `sg-0b59a761379839c71` |
| **AWS account** | `581549954508` |

Connection string (fill in `<PASSWORD>`):

```
postgresql://culinAI_DB:<PASSWORD>@culinai-db.csn2c4yowuvc.us-east-1.rds.amazonaws.com:5432/culinAI_DB?sslmode=require
```

---

## Two ways to connect

### A) From a backend droplet (already whitelisted, no setup)

```bash
ssh root@157.245.93.241        # nutrition-engine
# or
ssh root@143.198.116.101       # recipe-gen / culin-backend

apt -y install postgresql-client
psql "postgresql://culinAI_DB:<PASSWORD>@culinai-db.csn2c4yowuvc.us-east-1.rds.amazonaws.com:5432/culinAI_DB?sslmode=require"
```

### B) From your laptop (one-time IP whitelist)

Get AWS CLI configured first (`aws sts get-caller-identity` should return your CulinAI ARN). Then:

```bash
# Whitelist your current public IP for port 5432
MY_IP=$(curl -s https://checkip.amazonaws.com)
aws ec2 authorize-security-group-ingress \
  --group-id sg-0b59a761379839c71 --region us-east-1 \
  --ip-permissions "IpProtocol=tcp,FromPort=5432,ToPort=5432,IpRanges=[{CidrIp=${MY_IP}/32,Description=$(whoami)-laptop}]"

# Install psql (macOS)
brew install libpq && brew link --force libpq

# Connect
psql "postgresql://culinAI_DB:<PASSWORD>@culinai-db.csn2c4yowuvc.us-east-1.rds.amazonaws.com:5432/culinAI_DB?sslmode=require"
```

When done for the day, **revoke**:

```bash
aws ec2 revoke-security-group-ingress \
  --group-id sg-0b59a761379839c71 --region us-east-1 \
  --ip-permissions "IpProtocol=tcp,FromPort=5432,ToPort=5432,IpRanges=[{CidrIp=${MY_IP}/32}]"
```

---

## Common psql commands

```
\dt              -- list tables
\d <table>       -- describe table
\du              -- list users
\l               -- list databases
\q               -- quit
\timing          -- show query timing
\x               -- toggle expanded display (nicer for wide rows)
```

---

## Common SQL ops

```sql
-- Add a table
CREATE TABLE meals (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  calories INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add an index
CREATE INDEX idx_meals_user ON meals(user_id);

-- Add / drop a column
ALTER TABLE users ADD COLUMN preferences JSONB DEFAULT '{}'::jsonb;
ALTER TABLE users DROP COLUMN deprecated_field;

-- Quick row count
SELECT count(*) FROM users;

-- See active connections
SELECT pid, usename, application_name, state, query_start
FROM pg_stat_activity ORDER BY query_start DESC;
```

**No migration tool is set up yet** — schema changes are hand-run via psql. Coordinate with the team before running `ALTER`/`DROP` on prod.

---

## Backups (manual snapshot before anything risky)

```bash
aws rds create-db-snapshot \
  --db-instance-identifier culinai-db \
  --db-snapshot-identifier manual-$(whoami)-$(date +%Y%m%d-%H%M) \
  --region us-east-1
```

Restore (if disaster): AWS Console → RDS → Snapshots → select → **Restore snapshot**.

---

## AWS access (for SG / snapshots / backups)

Don't use shared keys. Each dev gets their own IAM user:

1. Ask Arjun to create an IAM user for you under account `581549954508`.
2. You'll be added to the `admin` group (or a more limited one for devs).
3. AWS CLI: run `aws configure` with your **own** access key, never someone else's.
4. Verify: `aws sts get-caller-identity` should show your ARN.

If your laptop is lost/stolen, only your key gets revoked — not the team's.

---

## Rules

1. **Don't** commit any password / API key. Use `.env.local` (gitignored) and 1Password.
2. **Don't** leave `0.0.0.0/0` on port 5432 — IPs only.
3. **Don't** run schema changes without taking a snapshot first.
4. **Do** post in your team's eng channel before DDL on prod (`CREATE TABLE`, `ALTER`, `DROP`).
5. **Backends already whitelisted:**
   - `157.245.93.241/32` → nutrition-engine droplet
   - `143.198.116.101/32` → recipe-gen droplet
