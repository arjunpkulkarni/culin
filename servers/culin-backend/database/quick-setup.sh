#!/bin/bash

# Quick RDS Setup Script
# Run this from AWS CloudShell or an EC2 instance in the same VPC

echo "🚀 CulinAI RDS Quick Setup"
echo ""

# Prompt for password if not set
if [ -z "$RDS_PASSWORD" ]; then
    read -sp "Enter RDS password: " RDS_PASSWORD
    echo ""
fi

# Connection details
RDSHOST="culinai-db.csn2c4yowuvc.us-east-1.rds.amazonaws.com"
RDSPORT="5432"
RDSDB="culinAI_DB"
RDSUSER="culinAI_DB"

echo "📊 Creating user_profiles table..."

# Execute SQL
PGPASSWORD=$RDS_PASSWORD psql \
    "host=$RDSHOST port=$RDSPORT dbname=$RDSDB user=$RDSUSER sslmode=require" \
    <<'SQL'

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    date_of_birth DATE,
    height INTEGER,
    weight INTEGER,
    sex VARCHAR(10),
    goals JSONB,
    health_conditions JSONB,
    dietary_restrictions JSONB,
    target_calories INTEGER,
    target_protein INTEGER,
    target_carbs INTEGER,
    target_fat INTEGER,
    photo_url TEXT,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_created ON user_profiles(created_at);
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding ON user_profiles(onboarding_completed);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

SELECT 'Table created successfully!' as status;

SQL

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Setup complete!"
    echo ""
    echo "Next steps:"
    echo "1. Add RDS_PASSWORD to your .env.local"
    echo "2. Restart your dev server: npm run dev"
    echo "3. Sign up a user to test!"
else
    echo ""
    echo "❌ Setup failed"
fi
