# CulinAI User Profile Database Setup

This guide explains how to set up the user profile system that integrates Cognito authentication with RDS PostgreSQL storage.

## 🎯 Architecture Overview

```
User Signs Up with Cognito
         ↓
JWT Token Generated
         ↓
User Profile Created in RDS  ← POST /api/user/profile
         ↓
User Completes Onboarding
         ↓
Profile Updated in RDS       ← PUT /api/user/profile
         ↓
App Loads User Data          ← GET /api/user/profile
```

## 📁 Files Created

### Database
- `database/create_user_profiles.sql` - SQL schema for user_profiles table
- `database/setup.sh` - Automated setup script

### API Endpoints
- `src/app/api/user/profile/route.ts` - POST, GET, PUT handlers

### Libraries
- `src/lib/db.ts` - PostgreSQL connection pooling

### Hooks
- `src/hooks/useUserProfile.ts` - React hook for profile management

### Documentation
- `ENV_SETUP.md` - Environment variable guide
- `database/README.md` - This file

## 🚀 Setup Instructions

### Step 1: Install Dependencies

```bash
npm install pg @types/pg
```

✅ Already done!

### Step 2: Configure Environment Variables

Add to your `.env.local`:

```bash
RDS_HOST=culinai-db.csn2c4yowuvc.us-east-1.rds.amazonaws.com
RDS_PORT=5432
RDS_DATABASE=culinAI_DB
RDS_USER=culinAI_DB
RDS_PASSWORD=YOUR_ACTUAL_PASSWORD  # ⚠️ Replace this!
```

### Step 3: Run Database Setup

**Option A: From your local machine (if RDS allows your IP)**

```bash
# Set your RDS password
export RDS_PASSWORD='your-actual-password'

# Run the setup script
./database/setup.sh
```

**Option B: From AWS CloudShell or EC2**

Since your RDS is in a VPC, you'll likely need to run this from:
- AWS CloudShell
- An EC2 instance in the same VPC
- Through a VPN connection

```bash
# In CloudShell/EC2
cd /path/to/culinAI
export RDS_PASSWORD='your-actual-password'
./database/setup.sh
```

**Option C: Manual Setup via RDS Query Editor**

1. Go to AWS Console → RDS → Query Editor
2. Connect to `culinai-db`
3. Copy and paste the contents of `database/create_user_profiles.sql`
4. Run the query

### Step 4: Verify Setup

```bash
# Connect to your database
export RDSHOST="culinai-db.csn2c4yowuvc.us-east-1.rds.amazonaws.com"
PGPASSWORD=$RDS_PASSWORD psql "host=$RDSHOST port=5432 dbname=culinAI_DB user=culinAI_DB sslmode=require"

# Check if table exists
\dt user_profiles

# Check table structure
\d user_profiles

# Exit
\q
```

## 🔌 API Endpoints

### POST /api/user/profile
**Create a new user profile**

Called automatically after Cognito signup.

```bash
curl -X POST http://localhost:3000/api/user/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "displayName": "John Doe"
  }'
```

Response:
```json
{
  "success": true,
  "message": "User profile created successfully",
  "profile": {
    "user_id": "cognito-user-id",
    "email": "user@example.com",
    "display_name": "John Doe",
    "onboarding_completed": false,
    "created_at": "2026-02-26T...",
    "updated_at": "2026-02-26T..."
  }
}
```

### GET /api/user/profile
**Fetch current user's profile**

```bash
curl -X GET http://localhost:3000/api/user/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### PUT /api/user/profile
**Update profile with onboarding data**

```bash
curl -X PUT http://localhost:3000/api/user/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "height": 175,
    "weight": 70,
    "sex": "M",
    "goals": ["lose_fat", "build_muscle"],
    "healthConditions": ["none"],
    "dietaryRestrictions": ["vegetarian"],
    "targetCalories": 2000,
    "targetProtein": 150,
    "targetCarbs": 200,
    "targetFat": 65,
    "onboardingCompleted": true
  }'
```

## 💻 Frontend Usage

### Using the `useUserProfile` Hook

```typescript
import { useUserProfile } from '@/hooks/useUserProfile';

function OnboardingPage() {
  const { profile, updateProfile, loading, error } = useUserProfile();

  const handleOnboardingComplete = async () => {
    try {
      await updateProfile({
        height: 175,
        weight: 70,
        sex: 'M',
        goals: ['lose_fat'],
        health_conditions: [],
        dietary_restrictions: ['vegetarian'],
        target_calories: 2000,
        onboarding_completed: true,
      });
      
      console.log('Onboarding complete!');
    } catch (err) {
      console.error('Failed to save:', err);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Welcome, {profile?.display_name}!</h1>
      {!profile?.onboarding_completed && (
        <button onClick={handleOnboardingComplete}>
          Complete Onboarding
        </button>
      )}
    </div>
  );
}
```

## 🗄️ Database Schema

```sql
CREATE TABLE user_profiles (
    user_id VARCHAR(255) PRIMARY KEY,          -- Cognito user ID
    email VARCHAR(255) NOT NULL UNIQUE,
    
    -- Basic Info
    display_name VARCHAR(255),
    date_of_birth DATE,
    height INTEGER,                             -- cm
    weight INTEGER,                             -- kg
    sex VARCHAR(10),                            -- 'M', 'F', 'Other'
    
    -- Goals & Health
    goals JSONB,                                -- ["lose_fat", "build_muscle"]
    health_conditions JSONB,                    -- ["diabetes", "high_bp"]
    dietary_restrictions JSONB,                 -- ["vegetarian", "vegan"]
    
    -- Nutrition Targets
    target_calories INTEGER,
    target_protein INTEGER,
    target_carbs INTEGER,
    target_fat INTEGER,
    
    -- Profile
    photo_url TEXT,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🔒 Security

- ✅ JWT token validation via `withAuth` middleware
- ✅ User can only access their own profile (validated via token)
- ✅ SSL required for database connections
- ✅ Passwords stored only in Cognito (not in RDS)
- ✅ RDS in VPC with security group restrictions

## 🐛 Troubleshooting

### "Connection timeout" error

**Problem:** Your IP is not allowed in the RDS security group.

**Solution:**
1. Go to AWS Console → EC2 → Security Groups
2. Find security group `sg-0b59a761379839c71`
3. Add inbound rule: PostgreSQL (5432) from your IP

### "User profile not found" (404)

**Problem:** Profile doesn't exist yet.

**Solution:** The frontend automatically creates profiles on first sign-in. Make sure the POST endpoint is working.

### "Invalid token" (401)

**Problem:** JWT token is expired or invalid.

**Solution:** Sign out and sign in again to get a fresh token.

### "Failed to connect to database"

**Problem:** Environment variables not set or incorrect password.

**Solution:** 
```bash
# Check your .env.local has:
RDS_PASSWORD=correct-password-here

# Restart your dev server
npm run dev
```

## 📊 Testing Checklist

- [ ] Database table created successfully
- [ ] Can connect to RDS from Next.js app
- [ ] User signs up with Cognito
- [ ] Profile auto-created in database (POST)
- [ ] Can fetch profile (GET)
- [ ] Can update profile with onboarding data (PUT)
- [ ] `onboarding_completed` flag updates correctly
- [ ] `updated_at` timestamp updates automatically

## 🎉 Next Steps

1. **Create Onboarding Flow UI**
   - Multi-step form to collect user data
   - Height, weight, sex
   - Health goals
   - Dietary restrictions
   - Target macros

2. **Add Profile Page**
   - Display user info
   - Edit profile
   - Update nutrition targets

3. **Use Profile Data in Chat**
   - Pass user's nutrition goals to AI
   - Personalize meal recommendations
   - Track progress toward targets

## 📝 Notes

- The `useUserProfile` hook automatically fetches the profile when a user signs in
- Profile creation happens asynchronously during sign-in (won't block the UI)
- The database uses JSONB for flexible arrays (goals, conditions, restrictions)
- All timestamps use PostgreSQL's `NOW()` function for consistency
- The `updated_at` field updates automatically via database trigger

---

Need help? Check the main README or reach out to the team!
