#!/bin/bash

# Setup script to create user_profiles table in RDS
# Run this script after setting your RDS password

echo "🗄️  Setting up CulinAI user_profiles table in RDS..."
echo ""

# RDS Connection Details
export RDSHOST="culinai-db.csn2c4yowuvc.us-east-1.rds.amazonaws.com"
export RDSPORT="5432"
export RDSDB="culinAI_DB"
export RDSUSER="culinAI_DB"

# Check if password is provided
if [ -z "$RDS_PASSWORD" ]; then
    echo "⚠️  RDS_PASSWORD environment variable not set"
    echo "Please run: export RDS_PASSWORD='your-password'"
    echo "Or pass it directly: RDS_PASSWORD='your-password' ./database/setup.sh"
    exit 1
fi

echo "📡 Connecting to RDS at $RDSHOST..."
echo ""

# Run the SQL file
PGPASSWORD=$RDS_PASSWORD psql \
    "host=$RDSHOST port=$RDSPORT dbname=$RDSDB user=$RDSUSER sslmode=require" \
    -f database/create_user_profiles.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database setup completed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Add RDS_PASSWORD to your .env.local file"
    echo "2. Test the API endpoints:"
    echo "   - POST /api/user/profile (create user)"
    echo "   - GET /api/user/profile (fetch user)"
    echo "   - PUT /api/user/profile (update onboarding)"
else
    echo ""
    echo "❌ Database setup failed. Check the error above."
    echo ""
    echo "Common issues:"
    echo "- Wrong password"
    echo "- RDS security group not allowing your IP"
    echo "- VPN/network issues"
fi
